package k8s

import (
	"context"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
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

	// PrometheusAlerts retrieves active Prometheus alerts
	PrometheusAlerts() PrometheusAlertsInterface

	// PrometheusRules returns the PrometheusRule interface
	PrometheusRules() PrometheusRuleInterface

	// PrometheusRuleInformer returns the PrometheusRuleInformer interface
	PrometheusRuleInformer() PrometheusRuleInformerInterface

	// AlertRelabelConfigs returns the AlertRelabelConfig interface
	AlertRelabelConfigs() AlertRelabelConfigInterface

	// AlertRelabelConfigInformer returns the AlertRelabelConfigInformer interface
	AlertRelabelConfigInformer() AlertRelabelConfigInformerInterface
}

// PrometheusAlertsInterface defines operations for managing PrometheusAlerts
type PrometheusAlertsInterface interface {
	// GetAlerts retrieves Prometheus alerts with optional state filtering
	GetAlerts(ctx context.Context, req GetAlertsRequest) ([]PrometheusAlert, error)
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

// PrometheusRuleInformerInterface defines operations for PrometheusRules informers
type PrometheusRuleInformerInterface interface {
	// Run starts the informer and sets up the provided callbacks for add, update, and delete events
	Run(ctx context.Context, callbacks PrometheusRuleInformerCallback) error
}

// PrometheusRuleInformerCallback holds the callback functions for informer events
type PrometheusRuleInformerCallback struct {
	// OnAdd is called when a new PrometheusRule is added
	OnAdd func(pr *monitoringv1.PrometheusRule)

	// OnUpdate is called when an existing PrometheusRule is updated
	OnUpdate func(pr *monitoringv1.PrometheusRule)

	// OnDelete is called when a PrometheusRule is deleted
	OnDelete func(pr *monitoringv1.PrometheusRule)
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

// AlertRelabelConfigInformerInterface defines operations for AlertRelabelConfig informers
type AlertRelabelConfigInformerInterface interface {
	// Run starts the informer and sets up the provided callbacks for add, update, and delete events
	Run(ctx context.Context, callbacks AlertRelabelConfigInformerCallback) error
}

// AlertRelabelConfigInformerCallback holds the callback functions for informer events
type AlertRelabelConfigInformerCallback struct {
	// OnAdd is called when a new AlertRelabelConfig is added
	OnAdd func(arc *osmv1.AlertRelabelConfig)

	// OnUpdate is called when an existing AlertRelabelConfig is updated
	OnUpdate func(arc *osmv1.AlertRelabelConfig)

	// OnDelete is called when an AlertRelabelConfig is deleted
	OnDelete func(arc *osmv1.AlertRelabelConfig)
}
