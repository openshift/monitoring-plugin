package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/sirupsen/logrus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/openshift/monitoring-plugin/pkg/monitoring"
)

var log = logrus.WithField("module", "api")

type TempoResource struct {
	Kind      KindType `json:"kind"`
	Namespace string   `json:"namespace"`
	Name      string   `json:"name"`
	// A list of tenant names for multi-tenant instances, or an empty list for single-tenant instances.
	Tenants []string `json:"tenants,omitempty"`
	// Ready reports if all components of the instance are up and the instance can be queried.
	Ready bool `json:"ready"`
	// A human readable message explaining why the instance is not ready, if the operator reported one.
	StatusMessage string `json:"statusMessage,omitempty"`
}

type KindType string

const (
	KindTempoStack      KindType = "TempoStack"
	KindTempoMonolithic KindType = "TempoMonolithic"
)

// ConditionReady is the status condition the Tempo operator sets once all components of an instance are up.
const ConditionReady = "Ready"

var (
	tempostackGVR = schema.GroupVersionResource{
		Group:    "tempo.grafana.com",
		Version:  "v1alpha1",
		Resource: "tempostacks",
	}
	tempomonolithicGVR = schema.GroupVersionResource{
		Group:    "tempo.grafana.com",
		Version:  "v1alpha1",
		Resource: "tempomonolithics",
	}
)

func ListTempoResourcesHandler(k8sclient *dynamic.DynamicClient) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resources, err := ListTempoResources(r.Context(), k8sclient)
		if err != nil {
			if apierrors.IsNotFound(err) {
				log.WithError(err).Error("Tempo CRDs not found")
				writeResponse(w, http.StatusNotFound, Response{
					Status:    StatusError,
					ErrorType: "TempoCRDNotFound",
					Error:     "Tempo resource types not found, is the Tempo Operator installed?",
				})
				return
			}

			// Transport errors embed the API server address.
			log.WithFields(logrus.Fields{
				"reason":     apierrors.ReasonForError(err),
				"error_kind": monitoring.ErrorKind(err),
			}).Error("cannot list Tempo resources")
			writeResponse(w, http.StatusInternalServerError, Response{
				Status: StatusError,
				Error:  "cannot list Tempo resources",
			})
			return
		}

		writeResponse(w, http.StatusOK, Response{
			Status: StatusSuccess,
			Data:   resources,
		})
	})
}

func ListTempoResources(ctx context.Context, k8sclient *dynamic.DynamicClient) ([]TempoResource, error) {
	// For local development, return a list of mock Tempo instances
	// return []TempoResource{
	// 	{"TempoStack", "namespace1", "instance1", []string{"tenant1", "tenant2"}},
	// 	{"TempoStack", "namespace1", "instance2", []string{"prod", "dev"}},
	// }, nil
	tempostacks, err := listTempos(ctx, k8sclient, tempostackGVR)
	if err != nil {
		return nil, err
	}

	tempomonolithics, err := listTempos(ctx, k8sclient, tempomonolithicGVR)
	if err != nil {
		return nil, err
	}

	return append(tempostacks, tempomonolithics...), nil
}

func listTempos(ctx context.Context, k8sclient *dynamic.DynamicClient, gvr schema.GroupVersionResource) ([]TempoResource, error) {
	resources := []TempoResource{}

	resourceList, err := k8sclient.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("cannot list %s resource: %w", gvr.String(), err)
	}
	for _, resource := range resourceList.Items {
		itemLogger := log.WithFields(logrus.Fields{"namespace": resource.GetNamespace(), "tempo": resource.GetName()})

		tenants, err := readTenantsFromCR(&resource)
		if err != nil {
			itemLogger.Error(err)
			continue
		}

		// Fix for https://issues.redhat.com/browse/OU-467
		if len(tenants) == 0 {
			itemLogger.Debug("skipping Tempo instance without multi-tenancy")
			continue
		}

		ready, statusMessage := readStatusFromCR(&resource)

		resources = append(resources, TempoResource{
			Kind:          KindType(resource.GetKind()),
			Namespace:     resource.GetNamespace(),
			Name:          resource.GetName(),
			Tenants:       tenants,
			Ready:         ready,
			StatusMessage: statusMessage,
		})
	}

	return resources, nil
}

func readTenantsFromCR(spec *unstructured.Unstructured) ([]string, error) {
	switch KindType(spec.GetKind()) {
	case KindTempoStack:
		found, err := validateTenancyMode(spec, "spec", "tenants", "mode")
		if err != nil {
			return nil, err
		}
		if !found {
			// no tenants mode set: instance without multitenancy
			return []string{}, nil
		}

		tenants, err := extractTenantNames(spec, "spec", "tenants", "authentication")
		if err != nil {
			return nil, err
		}
		return tenants, nil

	case KindTempoMonolithic:
		enabled, found, err := unstructured.NestedBool(spec.Object, "spec", "multitenancy", "enabled")
		if err != nil {
			return nil, err
		}
		if !found || !enabled {
			return []string{}, nil
		}

		found, err = validateTenancyMode(spec, "spec", "multitenancy", "mode")
		if err != nil {
			return nil, err
		}
		if !found {
			// multitenancy enabled but mode not set.
			// mode is a required field, this condition should not happen.
			return []string{}, nil
		}

		tenants, err := extractTenantNames(spec, "spec", "multitenancy", "authentication")
		if err != nil {
			return nil, err
		}
		return tenants, nil

	default:
		return nil, fmt.Errorf("invalid Tempo resource with kind '%s'", spec.GetKind())
	}
}

// readStatusFromCR reports if the Tempo instance is ready, i.e. if it has a status condition of
// type 'Ready' set to 'True'. If the instance is not ready, the message of the condition which is
// currently active ('Pending', 'Failed' or 'ConfigurationError') is returned as well, to explain
// why the instance cannot be queried yet.
//
// TempoStack and TempoMonolithic both report the health of the deployment as a list of
// metav1.Condition in status.conditions:
// https://github.com/grafana/tempo-operator/blob/main/api/tempo/v1alpha1/tempostack_types.go
// An instance without any condition has not been reconciled by the operator yet, i.e. it is not ready.
func readStatusFromCR(spec *unstructured.Unstructured) (bool, string) {
	conditions, found, err := unstructured.NestedSlice(spec.Object, "status", "conditions")
	if err != nil || !found {
		return false, ""
	}

	message := ""
	for _, condition := range conditions {
		conditionMap, ok := condition.(map[string]interface{})
		if !ok {
			continue
		}
		if conditionMap["status"] != string(metav1.ConditionTrue) {
			continue
		}

		if conditionMap["type"] == ConditionReady {
			return true, ""
		}

		// the first active condition other than 'Ready' explains why the instance is not ready
		if message == "" {
			message, _ = conditionMap["message"].(string)
		}
	}

	return false, message
}

func validateTenancyMode(spec *unstructured.Unstructured, fields ...string) (bool, error) {
	mode, found, err := unstructured.NestedString(spec.Object, fields...)
	if err != nil {
		return false, err
	}
	if !found {
		// instance without multitenancy
		return false, nil
	}
	if mode == "openshift" {
		return true, nil
	}
	return true, fmt.Errorf("multitenancy mode '%s' is not supported", mode)
}

func extractTenantNames(spec *unstructured.Unstructured, fields ...string) ([]string, error) {
	tenants, found, err := unstructured.NestedSlice(spec.Object, fields...)
	if err != nil {
		return nil, err
	}
	if !found {
		return []string{}, nil
	}

	// iterate over spec.tenants.authentication[].tenantName (TempoStack) or spec.multitenancy.authentication[].tenantName (TempoMonolithic)
	// https://github.com/grafana/tempo-operator/blob/bf2ef62df9784947edd668195c8fda00a35eb02b/docs/spec/tempo.grafana.com_tempostacks.yaml#L208-L218
	// https://github.com/grafana/tempo-operator/blob/bf2ef62df9784947edd668195c8fda00a35eb02b/docs/spec/tempo.grafana.com_tempomonolithics.yaml#L59-L70
	tenantNames := []string{}
	for _, tenant := range tenants {
		tenantMap, ok := tenant.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid tenant spec: %v", tenant)
		}

		name, ok := tenantMap["tenantName"]
		if !ok {
			return nil, fmt.Errorf("tenantName not found in tenant spec: %v", tenant)
		}

		str, ok := name.(string)
		if !ok {
			return nil, fmt.Errorf("tenantName is not a string in tenant spec: %v", tenant)
		}

		tenantNames = append(tenantNames, str)
	}
	return tenantNames, nil
}
