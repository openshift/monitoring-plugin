//go:build e2e

package framework

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	monitoringclient "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

const (
	monitoringConfigMapName    = "cluster-monitoring-config"
	monitoringConfigKey        = "config.yaml"
	userWorkloadPrometheusName = "user-workload"
	userWorkloadReadyTimeout   = 15 * time.Minute
	userWorkloadPollInterval   = 10 * time.Second
	userWorkloadUpdateAttempts = 5
)

// EnsureUserWorkloadMonitoring turns on user workload monitoring and waits
// until the user-workload Prometheus condition Available is True.
// User-namespace rules and alerts are evaluated only by that Prometheus.
// The e2e-management-api step does not enable it. The returned cleanup
// restores the previous config.
func EnsureUserWorkloadMonitoring() (CleanupFunc, error) {
	_, _, err := e2eEnvironment()
	if err != nil {
		return nil, err
	}

	config, err := loadE2EConfig()
	if err != nil {
		return nil, err
	}
	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("create kubernetes client: %w", err)
	}
	promClient, err := monitoringclient.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("create prometheus client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), userWorkloadReadyTimeout+time.Minute)
	defer cancel()
	return ensureUserWorkloadMonitoring(ctx, client, promClient)
}

func ensureUserWorkloadMonitoring(ctx context.Context, client kubernetes.Interface, promClient monitoringclient.Interface) (CleanupFunc, error) {
	change, err := applyEnableUserWorkloadWithRetry(ctx, client)
	if err != nil {
		return nil, err
	}
	var cleanup CleanupFunc = func() error { return nil }
	if change != nil {
		cleanup = func() error {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), time.Minute)
			defer cancel()
			return restoreUserWorkloadMonitoring(cleanupCtx, client, change)
		}
		fmt.Fprintf(os.Stderr, "set enableUserWorkload: true in %s/%s\n", k8s.ClusterMonitoringNamespace, monitoringConfigMapName)
	} else {
		fmt.Fprintf(os.Stderr, "user workload monitoring is already enabled\n")
	}
	if err := waitForUserWorkload(ctx, promClient); err != nil {
		return nil, errors.Join(err, cleanup())
	}
	return cleanup, nil
}

type userWorkloadConfigChange struct {
	original *corev1.ConfigMap
	applied  *corev1.ConfigMap
}

func applyEnableUserWorkloadWithRetry(ctx context.Context, client kubernetes.Interface) (*userWorkloadConfigChange, error) {
	var change *userWorkloadConfigChange
	err := retry(userWorkloadUpdateAttempts, func() error {
		var applyErr error
		change, applyErr = applyEnableUserWorkload(ctx, client)
		if applyErr != nil {
			time.Sleep(time.Second)
		}
		return applyErr
	})
	if err != nil {
		return nil, fmt.Errorf("enable user workload monitoring: %w", err)
	}
	return change, nil
}

func applyEnableUserWorkload(ctx context.Context, client kubernetes.Interface) (*userWorkloadConfigChange, error) {
	configMaps := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace)
	configMap, err := configMaps.Get(ctx, monitoringConfigMapName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		created, createErr := configMaps.Create(ctx, &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      monitoringConfigMapName,
				Namespace: k8s.ClusterMonitoringNamespace,
			},
			Data: map[string]string{
				monitoringConfigKey: "enableUserWorkload: true\n",
			},
		}, metav1.CreateOptions{})
		if createErr != nil {
			return nil, createErr
		}
		return &userWorkloadConfigChange{applied: created}, nil
	}
	if err != nil {
		return nil, err
	}
	original := configMap.DeepCopy()
	if configMap.Data == nil {
		configMap.Data = map[string]string{}
	}

	merged, changed, err := mergeEnableUserWorkload(configMap.Data[monitoringConfigKey])
	if err != nil || !changed {
		return nil, err
	}
	configMap.Data[monitoringConfigKey] = merged
	applied, err := configMaps.Update(ctx, configMap, metav1.UpdateOptions{})
	if err != nil {
		return nil, err
	}
	return &userWorkloadConfigChange{original: original, applied: applied}, nil
}

func restoreUserWorkloadMonitoring(ctx context.Context, client kubernetes.Interface, change *userWorkloadConfigChange) error {
	configMaps := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace)
	current, err := configMaps.Get(ctx, monitoringConfigMapName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) && change.original == nil {
		return nil
	}
	if err != nil {
		return fmt.Errorf("get cluster monitoring config for cleanup: %w", err)
	}
	if change.applied.UID != "" && current.UID != change.applied.UID ||
		change.applied.ResourceVersion != "" && current.ResourceVersion != change.applied.ResourceVersion {
		return fmt.Errorf("cluster monitoring config changed after e2e setup; refusing to overwrite it")
	}
	if change.original == nil {
		preconditions := &metav1.Preconditions{}
		if current.UID != "" {
			preconditions.UID = &current.UID
		}
		if current.ResourceVersion != "" {
			preconditions.ResourceVersion = &current.ResourceVersion
		}
		if err := configMaps.Delete(ctx, monitoringConfigMapName, metav1.DeleteOptions{Preconditions: preconditions}); err != nil {
			return fmt.Errorf("delete e2e cluster monitoring config: %w", err)
		}
		return nil
	}
	current.Data = change.original.Data
	if _, err := configMaps.Update(ctx, current, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("restore cluster monitoring config: %w", err)
	}
	return nil
}

func mergeEnableUserWorkload(configYAML string) (string, bool, error) {
	config := map[string]interface{}{}
	if strings.TrimSpace(configYAML) != "" {
		if err := yaml.Unmarshal([]byte(configYAML), &config); err != nil {
			return "", false, fmt.Errorf("parse cluster monitoring config: %w", err)
		}
	}
	if config == nil {
		config = map[string]interface{}{}
	}
	enabled, found, err := unstructured.NestedBool(config, "enableUserWorkload")
	if err != nil {
		return "", false, fmt.Errorf("parse enableUserWorkload: %w", err)
	}
	if found && enabled {
		return configYAML, false, nil
	}
	if err := unstructured.SetNestedField(config, true, "enableUserWorkload"); err != nil {
		return "", false, fmt.Errorf("set enableUserWorkload: %w", err)
	}
	out, err := yaml.Marshal(config)
	if err != nil {
		return "", false, fmt.Errorf("serialize cluster monitoring config: %w", err)
	}
	return string(out), true, nil
}

func waitForUserWorkload(ctx context.Context, client monitoringclient.Interface) error {
	fmt.Fprintf(os.Stderr, "waiting up to %s for prometheus %s/%s Available=True\n", userWorkloadReadyTimeout, k8s.UserWorkloadMonitoringNamespace, userWorkloadPrometheusName)
	var lastErr error
	err := wait.PollUntilContextTimeout(ctx, userWorkloadPollInterval, userWorkloadReadyTimeout, true, func(ctx context.Context) (bool, error) {
		prometheus, getErr := client.MonitoringV1().Prometheuses(k8s.UserWorkloadMonitoringNamespace).Get(ctx, userWorkloadPrometheusName, metav1.GetOptions{})
		if getErr != nil {
			lastErr = getErr
			fmt.Fprintf(os.Stderr, "user workload monitoring: %v\n", getErr)
			return false, nil
		}
		if readyErr := userWorkloadPrometheusReady(prometheus); readyErr != nil {
			lastErr = readyErr
			fmt.Fprintf(os.Stderr, "user workload monitoring: %v\n", readyErr)
			return false, nil
		}
		return true, nil
	})
	if err != nil && lastErr != nil {
		return fmt.Errorf("prometheus %s/%s not ready: %w", k8s.UserWorkloadMonitoringNamespace, userWorkloadPrometheusName, lastErr)
	}
	return err
}

func userWorkloadPrometheusReady(prometheus *monitoringv1.Prometheus) error {
	if prometheus == nil {
		return fmt.Errorf("prometheus %s/%s is missing", k8s.UserWorkloadMonitoringNamespace, userWorkloadPrometheusName)
	}
	for _, condition := range prometheus.Status.Conditions {
		if condition.Type == monitoringv1.Available && condition.Status == monitoringv1.ConditionTrue {
			return nil
		}
	}
	return fmt.Errorf("prometheus %s/%s condition Available is not True", k8s.UserWorkloadMonitoringNamespace, userWorkloadPrometheusName)
}
