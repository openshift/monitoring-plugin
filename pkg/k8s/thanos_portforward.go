package k8s

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

const (
	// thanosQuerierLabelSelector matches the cluster-monitoring-operator
	// thanos-querier deployment.
	thanosQuerierLabelSelector = "app.kubernetes.io/name=thanos-query,app.kubernetes.io/instance=thanos-querier"

	// openshift-config-managed/openshift-service-ca.crt publishes the
	// cluster service CA under ca-bundle.crt (service-ca-operator
	// BundleDataKey). Injected copies use service-ca.crt.
	openshiftServiceCANamespace   = "openshift-config-managed"
	openshiftServiceCAConfigMap   = "openshift-service-ca.crt"
	openshiftServiceCABundleKey   = "ca-bundle.crt"
	openshiftServiceCAInjectedKey = "service-ca.crt"
)

// thanosPortForward is a shared API port-forward to thanos-querier:9093
// on the cluster selected by KUBECONFIG.
type thanosPortForward struct {
	mu         sync.Mutex
	addr       string
	generation uint64
}

// tenancyHTTPClient dials Thanos tenancy. In-cluster, that is the service
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
func (pa *prometheusAlerts) tenancyHTTPClient(ctx context.Context) (*http.Client, error) {
	if !outOfClusterKubeconfig() {
		return pa.createHTTPClient()
	}

	localAddr, err := pa.thanosForwardAddress(ctx)
	if err != nil {
		return nil, err
	}
	tlsConfig, err := pa.outOfClusterTenancyTLS(ctx)
	if err != nil {
		return nil, err
	}

	dialer := &net.Dialer{Timeout: 5 * time.Second}
	return &http.Client{
		Timeout: serviceRequestTimeout,
		Transport: &http.Transport{
			// Leave Proxy unset. A nil Proxy does not consult HTTP_PROXY;
			// only http.DefaultTransport does. These requests must stay on
			// the local port-forward.
			TLSClientConfig:   tlsConfig,
			DisableKeepAlives: true,
			DialContext: func(ctx context.Context, network, _ string) (net.Conn, error) {
				return dialer.DialContext(ctx, network, localAddr)
			},
		},
	}, nil
}

func outOfClusterKubeconfig() bool {
	return strings.TrimSpace(os.Getenv("KUBECONFIG")) != ""
}

func (pa *prometheusAlerts) thanosForwardAddress(ctx context.Context) (string, error) {
	pa.tunnel.mu.Lock()
	defer pa.tunnel.mu.Unlock()

	if pa.tunnel.addr != "" {
		return pa.tunnel.addr, nil
	}

	generation := pa.tunnel.generation + 1
	localAddr, err := pa.openThanosForward(ctx, generation)
	if err != nil {
		return "", err
	}
	pa.tunnel.generation = generation
	pa.tunnel.addr = localAddr
	return localAddr, nil
}

func (pa *prometheusAlerts) openThanosForward(ctx context.Context, generation uint64) (string, error) {
	if pa.config == nil || pa.coreClient == nil {
		return "", fmt.Errorf("kubernetes client is not configured")
	}

	podName, err := pa.readyThanosPod(ctx)
	if err != nil {
		return "", err
	}

	roundTripper, upgrader, err := spdy.RoundTripperFor(pa.config)
	if err != nil {
		return "", fmt.Errorf("thanos port-forward transport: %w", err)
	}
	forwardURL := pa.coreClient.RESTClient().Post().
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
	pa.tunnel.mu.Lock()
	if pa.tunnel.generation == generation {
		pa.tunnel.addr = ""
	}
	pa.tunnel.mu.Unlock()
	if err != nil {
		prometheusLog.WithError(err).Warn("thanos-querier port-forward ended")
	}
}

func (pa *prometheusAlerts) readyThanosPod(ctx context.Context) (string, error) {
	pods, err := pa.coreClient.Pods(ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{
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

func (pa *prometheusAlerts) outOfClusterTenancyTLS(ctx context.Context) (*tls.Config, error) {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}

	pemBytes, pemErr := pa.outOfClusterServiceCA(ctx)
	if pemErr == nil && !pool.AppendCertsFromPEM(pemBytes) {
		pemErr = fmt.Errorf("parse service CA from configmap %s/%s", openshiftServiceCANamespace, openshiftServiceCAConfigMap)
	}

	_, fileRequired := serviceCAFilePath()
	if fileRequired {
		if err := appendServiceCA(pool); err != nil {
			return nil, err
		}
		if pemErr != nil {
			pa.serviceCAWarn.Do(func() {
				prometheusLog.WithError(pemErr).Warn("using MONITORING_PLUGIN_SERVICE_CA_FILE without the cluster service CA configmap")
			})
		}
	} else if pemErr != nil {
		return nil, pemErr
	}

	return &tls.Config{
		MinVersion: tls.VersionTLS12,
		RootCAs:    pool,
	}, nil
}

func (pa *prometheusAlerts) outOfClusterServiceCA(ctx context.Context) ([]byte, error) {
	pa.serviceCAMu.Lock()
	defer pa.serviceCAMu.Unlock()

	if len(pa.serviceCAPEM) > 0 && time.Now().Before(pa.serviceCAExpiresAt) {
		return append([]byte(nil), pa.serviceCAPEM...), nil
	}
	if pa.coreClient == nil {
		return nil, fmt.Errorf("core client is not configured")
	}

	configMap, err := pa.coreClient.ConfigMaps(openshiftServiceCANamespace).Get(ctx, openshiftServiceCAConfigMap, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get service CA configmap %s/%s: %w", openshiftServiceCANamespace, openshiftServiceCAConfigMap, err)
	}
	pemBytes, err := serviceCAFromConfigMapData(configMap.Data)
	if err != nil {
		return nil, err
	}
	pa.serviceCAPEM = pemBytes
	pa.serviceCAExpiresAt = time.Now().Add(serviceCACacheTTL)
	return append([]byte(nil), pemBytes...), nil
}

func serviceCAFromConfigMapData(data map[string]string) ([]byte, error) {
	for _, key := range []string{openshiftServiceCABundleKey, openshiftServiceCAInjectedKey} {
		pemData := data[key]
		if strings.Contains(pemData, "BEGIN CERTIFICATE") {
			return []byte(pemData), nil
		}
	}
	return nil, fmt.Errorf("configmap %s/%s has no service CA certificate", openshiftServiceCANamespace, openshiftServiceCAConfigMap)
}
