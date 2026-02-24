package k8s

import (
	"context"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/prometheus/model/relabel"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
)

// ClientOptions holds configuration options for creating a Kubernetes client
type ClientOptions struct {
	// KubeconfigPath specifies the path to the kubeconfig file for remote connections
	// If empty, will try default locations or in-cluster config
	KubeconfigPath string
}

// Client defines the contract for Kubernetes client operations
type Client interface {
	// TestConnection tests the connection to the Kubernetes cluster
	TestConnection(ctx context.Context) error

	// AlertingHealth returns alerting route and stack health details
	AlertingHealth(ctx context.Context) (AlertingHealth, error)

	// PrometheusAlerts retrieves active Prometheus alerts
	PrometheusAlerts() PrometheusAlertsInterface

	// PrometheusRules returns the PrometheusRule interface
	PrometheusRules() PrometheusRuleInterface

	// AlertRelabelConfigs returns the AlertRelabelConfig interface
	AlertRelabelConfigs() AlertRelabelConfigInterface

	// AlertingRules returns the AlertingRule interface
	AlertingRules() AlertingRuleInterface

	// RelabeledRules returns the RelabeledRules interface
	RelabeledRules() RelabeledRulesInterface

	// Namespace returns the Namespace interface
	Namespace() NamespaceInterface

	// ConfigMaps returns the ConfigMap interface
	ConfigMaps() ConfigMapInterface
}

// RouteStatus describes the availability state of a monitoring route.
type RouteStatus string

const (
	RouteNotFound    RouteStatus = "notFound"
	RouteUnreachable RouteStatus = "unreachable"
	RouteReachable   RouteStatus = "reachable"
)

// AlertingRouteHealth describes route availability and reachability.
type AlertingRouteHealth struct {
	Name              string      `json:"name"`
	Namespace         string      `json:"namespace"`
	Status            RouteStatus `json:"status"`
	FallbackReachable bool        `json:"fallbackReachable,omitempty"`
	Error             string      `json:"error,omitempty"`
}

// AlertingStackHealth describes alerting health for a monitoring stack.
type AlertingStackHealth struct {
	Prometheus   AlertingRouteHealth `json:"prometheus"`
	Alertmanager AlertingRouteHealth `json:"alertmanager"`
}

// AlertingHealth provides alerting health details for platform and user workload stacks.
type AlertingHealth struct {
	Platform            *AlertingStackHealth `json:"platform"`
	UserWorkloadEnabled bool                 `json:"userWorkloadEnabled"`
	UserWorkload        *AlertingStackHealth `json:"userWorkload"`
}

// PrometheusAlertsInterface defines operations for managing PrometheusAlerts
type PrometheusAlertsInterface interface {
	// GetAlerts retrieves Prometheus alerts with optional state filtering
	GetAlerts(ctx context.Context, req GetAlertsRequest) ([]PrometheusAlert, error)
	// GetRules retrieves Prometheus alerting rules and active alerts
	GetRules(ctx context.Context, req GetRulesRequest) ([]PrometheusRuleGroup, error)
}

// PrometheusRuleInterface defines operations for managing PrometheusRules
type PrometheusRuleInterface interface {
	// List lists all PrometheusRules in the cluster
	List(ctx context.Context, namespace string) ([]monitoringv1.PrometheusRule, error)

	// Get retrieves a PrometheusRule by namespace and name
	Get(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error)

	// Update updates an existing PrometheusRule
	Update(ctx context.Context, pr monitoringv1.PrometheusRule) error

	// Delete deletes a PrometheusRule by namespace and name
	Delete(ctx context.Context, namespace string, name string) error

	// AddRule adds a new rule to the specified PrometheusRule
	AddRule(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error
}

// AlertRelabelConfigInterface defines operations for managing AlertRelabelConfigs
type AlertRelabelConfigInterface interface {
	// List lists all AlertRelabelConfigs in the cluster
	List(ctx context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error)

	// Get retrieves an AlertRelabelConfig by namespace and name
	Get(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error)

	// Create creates a new AlertRelabelConfig
	Create(ctx context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error)

	// Update updates an existing AlertRelabelConfig
	Update(ctx context.Context, arc osmv1.AlertRelabelConfig) error

	// Delete deletes an AlertRelabelConfig by namespace and name
	Delete(ctx context.Context, namespace string, name string) error
}

// AlertingRuleInterface defines operations for managing AlertingRules
// in the cluster monitoring namespace
type AlertingRuleInterface interface {
	// List lists all AlertingRules in the cluster
	List(ctx context.Context) ([]osmv1.AlertingRule, error)

	// Get retrieves an AlertingRule by name
	Get(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error)

	// Create creates a new AlertingRule
	Create(ctx context.Context, ar osmv1.AlertingRule) (*osmv1.AlertingRule, error)

	// Update updates an existing AlertingRule
	Update(ctx context.Context, ar osmv1.AlertingRule) error

	// Delete deletes an AlertingRule by name
	Delete(ctx context.Context, name string) error
}

// RelabeledRulesInterface defines operations for managing relabeled rules
type RelabeledRulesInterface interface {
	// List retrieves the relabeled rules for a given PrometheusRule
	List(ctx context.Context) []monitoringv1.Rule

	// Get retrieves the relabeled rule for a given id
	Get(ctx context.Context, id string) (monitoringv1.Rule, bool)

	// Config returns the list of alert relabel configs
	Config() []*relabel.Config
}

// NamespaceInterface defines operations for Namespaces
type NamespaceInterface interface {
	// IsClusterMonitoringNamespace checks if a namespace has the openshift.io/cluster-monitoring=true label
	IsClusterMonitoringNamespace(name string) bool
}

// ConfigMapInterface defines minimal operations used for classification updates
type ConfigMapInterface interface {
	// Get retrieves a ConfigMap by namespace and name
	Get(ctx context.Context, namespace string, name string) (*corev1.ConfigMap, bool, error)
	// Update updates an existing ConfigMap
	Update(ctx context.Context, cm corev1.ConfigMap) error
	// Create creates a new ConfigMap
	Create(ctx context.Context, cm corev1.ConfigMap) (*corev1.ConfigMap, error)
}
