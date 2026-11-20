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
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

// portForwardTunnel caches a shared API port-forward to a service pod on the
// cluster selected by KUBECONFIG.
type portForwardTunnel struct {
	mu         sync.Mutex
	addr       string
	generation uint64
}

// address reuses the current forward or opens one. The completion callback
// invalidates only its own generation, so an old forward cannot clear a new one.
func (t *portForwardTunnel) address(targetName string, openForward func(onEnd func(error)) (string, error)) (string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.addr != "" {
		return t.addr, nil
	}

	t.generation++
	generation := t.generation
	localAddress, err := openForward(func(err error) {
		t.invalidateAddress(generation)
		if err != nil {
			transportLog.WithError(err).Warnf("%s port-forward ended", targetName)
		}
	})
	if err != nil {
		return "", err
	}
	t.addr = localAddress
	return localAddress, nil
}

func (t *portForwardTunnel) invalidateAddress(generation uint64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.generation == generation {
		t.addr = ""
	}
}

func (mt *transport) portForwardHTTPClient(ctx context.Context, localAddress string) (*http.Client, error) {
	tlsConfig, err := mt.outOfClusterServiceTLSConfig(ctx)
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
				return dialer.DialContext(ctx, network, localAddress)
			},
		},
	}, nil
}

func hasOutOfClusterKubeconfig() bool {
	return strings.TrimSpace(os.Getenv("KUBECONFIG")) != ""
}

// openServicePortForward opens a pod forward using the Kubernetes connection.
// The caller owns address caching and handles completion through onEnd.
func (mt *transport) openServicePortForward(ctx context.Context, namespace, podLabelSelector string, remotePort int, onEnd func(error)) (string, error) {
	if mt.config == nil || mt.coreClient == nil {
		return "", fmt.Errorf("kubernetes client is not configured")
	}

	podName, err := mt.readyPodForLabelSelector(ctx, namespace, podLabelSelector)
	if err != nil {
		return "", err
	}

	roundTripper, upgrader, err := spdy.RoundTripperFor(mt.config)
	if err != nil {
		return "", fmt.Errorf("service port-forward transport: %w", err)
	}
	forwardURL := mt.coreClient.RESTClient().Post().
		Resource("pods").
		Namespace(namespace).
		Name(podName).
		SubResource("portforward").
		URL()
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: roundTripper}, http.MethodPost, forwardURL)

	stop := make(chan struct{})
	ready := make(chan struct{})
	forwarder, err := portforward.NewOnAddresses(
		dialer,
		[]string{"127.0.0.1"},
		[]string{fmt.Sprintf("0:%d", remotePort)},
		stop,
		ready,
		io.Discard,
		io.Discard,
	)
	if err != nil {
		return "", fmt.Errorf("service port-forward: %w", err)
	}

	errCh := make(chan error, 1)
	go func() {
		forwardErr := forwarder.ForwardPorts()
		errCh <- forwardErr
		onEnd(forwardErr)
	}()

	select {
	case <-ready:
		ports, err := forwarder.GetPorts()
		if err != nil {
			close(stop)
			return "", fmt.Errorf("service port-forward local port: %w", err)
		}
		if len(ports) == 0 || ports[0].Local == 0 {
			close(stop)
			return "", fmt.Errorf("service port-forward has no local port")
		}
		localAddr := net.JoinHostPort("127.0.0.1", strconv.Itoa(int(ports[0].Local)))
		transportLog.WithField("pod", podName).WithField("address", localAddr).Info("forwarding service to the kubeconfig cluster")
		return localAddr, nil
	case forwardErr := <-errCh:
		return "", fmt.Errorf("port-forward service pod %s: %w", podName, forwardErr)
	case <-ctx.Done():
		close(stop)
		return "", fmt.Errorf("port-forward service pod %s: %w", podName, ctx.Err())
	}
}

func (mt *transport) readyPodForLabelSelector(ctx context.Context, namespace, podLabelSelector string) (string, error) {
	pods, err := mt.coreClient.Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: podLabelSelector})
	if err != nil {
		return "", fmt.Errorf("list service pods: %w", err)
	}
	podName, err := readyPodName(pods.Items)
	if err != nil {
		return "", fmt.Errorf("no ready service pod in %s for %s: %w", namespace, podLabelSelector, err)
	}
	return podName, nil
}

func readyPodName(pods []corev1.Pod) (string, error) {
	for _, pod := range pods {
		if pod.Name == "" || pod.DeletionTimestamp != nil || pod.Status.Phase != corev1.PodRunning {
			continue
		}
		if !podIsReady(pod) {
			continue
		}
		return pod.Name, nil
	}
	return "", fmt.Errorf("no ready pod")
}

func podIsReady(pod corev1.Pod) bool {
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
			return true
		}
	}
	return false
}
