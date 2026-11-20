package k8s

import (
	"context"
	"net/http"
)

// thanosQuerierLabelSelector matches the cluster-monitoring-operator
// thanos-querier deployment.
const thanosQuerierLabelSelector = "app.kubernetes.io/name=thanos-query,app.kubernetes.io/instance=thanos-querier"

// thanosTenancyHTTPClient dials Thanos tenancy. In-cluster, that is the service
// DNS name. When KUBECONFIG is set, the process is outside that cluster:
// e2e-management-api runs the plugin in the build cluster, so the service
// DNS name is the build cluster's Thanos and the test-cluster bearer token
// is rejected. Port-forward through the kubeconfig API and trust the test
// cluster service CA instead.
//
// A Route does not replace this forward. The thanos-querier Route
// targets the web port, which authorizes prometheuses/api in
// openshift-monitoring. Namespace-scoped rules and alerts are served
// only on tenancy-rules, and that port is not routed. A passthrough
// Route would present the service certificate, whose DNS name is not
// the route host. A reencrypt Route needs the ingress CA, which is not
// in the kubeconfig. Port-forward uses the API server the kubeconfig
// can already reach, including when the cluster router is not.
func (pa *prometheusAlerts) thanosTenancyHTTPClient(ctx context.Context) (*http.Client, error) {
	if !hasOutOfClusterKubeconfig() {
		return pa.transport.createHTTPClient()
	}

	localAddress, err := pa.thanosTenancyForwardAddress(ctx)
	if err != nil {
		return nil, err
	}
	return pa.transport.portForwardHTTPClient(ctx, localAddress)
}

func (pa *prometheusAlerts) thanosTenancyForwardAddress(ctx context.Context) (string, error) {
	return pa.thanosTunnel.address("thanos-querier", func(onEnd func(error)) (string, error) {
		return pa.transport.openServicePortForward(ctx, ClusterMonitoringNamespace, thanosQuerierLabelSelector, DefaultThanosQuerierTenancyRulesPort, onEnd)
	})
}
