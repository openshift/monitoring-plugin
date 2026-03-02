package k8s

import (
	"context"

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

	// PrometheusRules returns the PrometheusRule interface
	PrometheusRules() PrometheusRuleInterface

	// Namespace returns the Namespace interface
	Namespace() NamespaceInterface
}

// PrometheusRuleInterface defines operations for managing PrometheusRules
type PrometheusRuleInterface interface {
	// List lists all PrometheusRules from the informer cache
	List() ([]monitoringv1.PrometheusRule, error)

	// Get retrieves a PrometheusRule by namespace and name
	Get(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error)

	// Update updates an existing PrometheusRule
	Update(ctx context.Context, pr monitoringv1.PrometheusRule) error

	// Delete deletes a PrometheusRule by namespace and name
	Delete(ctx context.Context, namespace string, name string) error

	// AddRule adds a new rule to the specified PrometheusRule
	AddRule(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error
}

// NamespaceInterface defines operations for Namespaces
type NamespaceInterface interface {
	// IsClusterMonitoringNamespace checks if a namespace has the openshift.io/cluster-monitoring=true label
	IsClusterMonitoringNamespace(name string) bool
}
