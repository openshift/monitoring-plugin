package framework

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

var f *Framework

type Framework struct {
	Clientset             *kubernetes.Clientset
	Monitoringv1clientset *monitoringv1client.Clientset
	Osmv1clientset        *osmv1client.Clientset

	PluginURL   string
	BearerToken string
	httpClient  *http.Client
}

type CleanupFunc func() error

// ErrSkip is returned by New when required environment variables are not set,
// so callers can distinguish a missing-env skip from a real error.
var ErrSkip = fmt.Errorf("required environment variables not set, skipping e2e test")

func New() (*Framework, error) {
	if f != nil {
		return f, nil
	}

	kubeConfigPath := os.Getenv("KUBECONFIG")
	if kubeConfigPath == "" {
		return nil, fmt.Errorf("%w: KUBECONFIG", ErrSkip)
	}

	pluginURL := os.Getenv("PLUGIN_URL")
	if pluginURL == "" {
		return nil, fmt.Errorf("%w: PLUGIN_URL", ErrSkip)
	}

	config, err := clientcmd.BuildConfigFromFlags("", kubeConfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to build config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	monitoringv1clientset, err := monitoringv1client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create monitoringv1 clientset: %w", err)
	}

	osmv1clientset, err := osmv1client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create osmv1 clientset: %w", err)
	}

	f = &Framework{
		Clientset:             clientset,
		Monitoringv1clientset: monitoringv1clientset,
		Osmv1clientset:        osmv1clientset,
		PluginURL:             pluginURL,
		BearerToken:           config.BearerToken,
	}

	return f, nil
}

// HTTPClient returns a shared *http.Client configured for the plugin URL.
// For HTTPS endpoints it skips certificate verification (self-signed certs
// used by in-cluster deployments behind port-forward). The client is reused
// across calls to keep connections alive and avoid exhausting port-forward tunnels.
func (f *Framework) HTTPClient() *http.Client {
	if f.httpClient != nil {
		return f.httpClient
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if strings.HasPrefix(f.PluginURL, "https://") {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	f.httpClient = &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}
	return f.httpClient
}

func (f *Framework) CreateNamespace(ctx context.Context, name string, isClusterMonitoringNamespace bool) (string, CleanupFunc, error) {
	testNamespace := fmt.Sprintf("%s-%d", name, time.Now().Unix())
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: testNamespace,
			Labels: map[string]string{
				k8s.ClusterMonitoringLabel: strconv.FormatBool(isClusterMonitoringNamespace),
			},
		},
	}

	_, err := f.Clientset.CoreV1().Namespaces().Create(ctx, namespace, metav1.CreateOptions{})
	if err != nil {
		return "", nil, fmt.Errorf("failed to create test namespace: %w", err)
	}

	return testNamespace, func() error {
		return f.Clientset.CoreV1().Namespaces().Delete(ctx, testNamespace, metav1.DeleteOptions{})
	}, nil
}

// AuthorizedRequest creates an HTTP request with the Bearer token set.
func (f *Framework) AuthorizedRequest(ctx context.Context, method, url string, body interface{ Read([]byte) (int, error) }) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}
	return req, nil
}
