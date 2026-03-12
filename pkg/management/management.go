package management

import (
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type client struct {
	k8sClient k8s.Client
}

// isPlatformManagedPrometheusRule returns true when the target
// PrometheusRule lives in a namespace labeled
// openshift.io/cluster-monitoring=true. CMO's platform Prometheus
// evaluates every PrometheusRule in those namespaces regardless of
// who created it, so the namespace boundary is the correct routing
// check. Rules in platform namespaces must be managed via AlertingRule
// CRs rather than direct PrometheusRule manipulation.
func (c *client) isPlatformManagedPrometheusRule(nn types.NamespacedName) bool {
	return c.k8sClient.Namespace().IsClusterMonitoringNamespace(nn.Namespace)
}
