package k8s

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

// thanosQuerierLabelSelector matches the cluster-monitoring-operator
// thanos-querier deployment.
const thanosQuerierLabelSelector = "app.kubernetes.io/name=thanos-query,app.kubernetes.io/instance=thanos-querier"

// thanosPortForward is a shared API port-forward to thanos-querier:9093
// on the cluster selected by KUBECONFIG.
type thanosPortForward struct {
	mu         sync.Mutex
	addr       string
	generation uint64
}

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

func hasOutOfClusterKubeconfig() bool {
	return strings.TrimSpace(os.Getenv("KUBECONFIG")) != ""
}

func (pa *prometheusAlerts) thanosTenancyForwardAddress(ctx context.Context) (string, error) {
	pa.thanosTunnel.mu.Lock()
	defer pa.thanosTunnel.mu.Unlock()

	if pa.thanosTunnel.addr != "" {
		return pa.thanosTunnel.addr, nil
	}

	generation := pa.thanosTunnel.generation + 1
	localAddress, err := pa.openThanosForward(ctx, generation)
	if err != nil {
		return "", err
	}
	pa.thanosTunnel.generation = generation
	pa.thanosTunnel.addr = localAddress
	return localAddress, nil
}

func (pa *prometheusAlerts) openThanosForward(ctx context.Context, generation uint64) (string, error) {
	if pa.transport.config == nil || pa.transport.coreClient == nil {
		return "", fmt.Errorf("kubernetes client is not configured")
	}

	podName, err := pa.readyThanosPod(ctx)
	if err != nil {
		return "", err
	}

	roundTripper, upgrader, err := spdy.RoundTripperFor(pa.transport.config)
	if err != nil {
		return "", fmt.Errorf("thanos port-forward transport: %w", err)
	}
	forwardURL := pa.transport.coreClient.RESTClient().Post().
		Resource("pods").
		Namespace(ClusterMonitoringNamespace).
		Name(podName).
		SubResource("portforward").
		URL()
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: roundTripper}, http.MethodPost, forwardURL)

	stop := make(chan struct{})
	ready := make(chan struct{})
	forwarder, err := portforward.NewOnAddresses(
		dialer,
		[]string{"127.0.0.1"},
		[]string{fmt.Sprintf("0:%d", DefaultThanosQuerierTenancyRulesPort)},
		stop,
		ready,
		io.Discard,
		io.Discard,
	)
	if err != nil {
		return "", fmt.Errorf("thanos port-forward: %w", err)
	}

	errCh := make(chan error, 1)
	go func() {
		forwardErr := forwarder.ForwardPorts()
		errCh <- forwardErr
		pa.endThanosForward(generation, forwardErr)
	}()

	select {
	case <-ready:
		ports, err := forwarder.GetPorts()
		if err != nil {
			close(stop)
			return "", fmt.Errorf("thanos port-forward local port: %w", err)
		}
		if len(ports) == 0 || ports[0].Local == 0 {
			close(stop)
			return "", fmt.Errorf("thanos port-forward has no local port")
		}
		localAddr := net.JoinHostPort("127.0.0.1", strconv.Itoa(int(ports[0].Local)))
		prometheusLog.WithField("pod", podName).WithField("address", localAddr).Info("forwarding thanos tenancy to the kubeconfig cluster")
		return localAddr, nil
	case forwardErr := <-errCh:
		return "", fmt.Errorf("port-forward thanos-querier pod %s: %w", podName, forwardErr)
	case <-ctx.Done():
		close(stop)
		return "", fmt.Errorf("port-forward thanos-querier pod %s: %w", podName, ctx.Err())
	}
}

func (pa *prometheusAlerts) endThanosForward(generation uint64, err error) {
	pa.thanosTunnel.mu.Lock()
	if pa.thanosTunnel.generation == generation {
		pa.thanosTunnel.addr = ""
	}
	pa.thanosTunnel.mu.Unlock()
	if err != nil {
		prometheusLog.WithError(err).Warn("thanos-querier port-forward ended")
	}
}

func (pa *prometheusAlerts) readyThanosPod(ctx context.Context) (string, error) {
	pods, err := pa.transport.coreClient.Pods(ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{
		LabelSelector: thanosQuerierLabelSelector,
	})
	if err != nil {
		return "", fmt.Errorf("list thanos-querier pods: %w", err)
	}
	return readyThanosPodName(pods.Items)
}

func readyThanosPodName(pods []corev1.Pod) (string, error) {
	for _, pod := range pods {
		if pod.Name == "" || pod.DeletionTimestamp != nil || pod.Status.Phase != corev1.PodRunning {
			continue
		}
		if !podIsReady(pod) {
			continue
		}
		return pod.Name, nil
	}
	return "", fmt.Errorf("no ready thanos-querier pod (%s) in %s", thanosQuerierLabelSelector, ClusterMonitoringNamespace)
}

func podIsReady(pod corev1.Pod) bool {
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
			return true
		}
	}
	return false
}
