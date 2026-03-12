package management

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/rest"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/metrics"
)

type client struct {
	k8sClient              k8s.Client
	enableUserWorkloadARCs bool
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

func (c *client) MetricsHandler(ctx context.Context, kubeConfig *rest.Config) (http.Handler, error) {
	return metrics.NewHandler(ctx, c, kubeConfig)
}
