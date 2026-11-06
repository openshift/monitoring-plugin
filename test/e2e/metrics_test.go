//go:build e2e

package e2e

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func fetchMetrics(ctx context.Context, f *framework.Framework) (metricsBody string, err error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if !strings.HasPrefix(f.PluginURL, "https://") {
		return "", fmt.Errorf("metrics tests require an HTTPS PLUGIN_URL with client certificate authentication")
	}
	secret, err := f.Clientset.CoreV1().Secrets(k8s.ClusterMonitoringNamespace).Get(ctx, "metrics-client-certs", metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("read Prometheus metrics client certificate: %w", err)
	}
	certificate, err := tls.X509KeyPair(secret.Data["tls.crt"], secret.Data["tls.key"])
	if err != nil {
		return "", fmt.Errorf("parse Prometheus metrics client certificate: %w", err)
	}
	transport := f.HTTPClient().Transport.(*http.Transport).Clone()
	transport.TLSClientConfig = transport.TLSClientConfig.Clone()
	transport.TLSClientConfig.Certificates = []tls.Certificate{certificate}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 30 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.PluginURL+"/metrics", nil)
	if err != nil {
		return "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("closing response body: %w", closeErr)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func TestMetricEndpointExposesGeneralMetrics(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}
	body, err := fetchMetrics(context.Background(), f)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"go_goroutines", "process_start_time_seconds"} {
		found := false
		for _, line := range strings.Split(body, "\n") {
			if strings.HasPrefix(line, name+" ") || strings.HasPrefix(line, name+"{") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("general metric %s has no sample line", name)
		}
	}
}

func TestMetricEndpointRequiresClientCertificate(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	request, err := f.AuthorizedRequest(ctx, http.MethodGet, f.PluginURL+"/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	response, err := f.HTTPClient().Do(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusUnauthorized {
		t.Errorf("bearer-only scrape status %d, want 401", response.StatusCode)
	}
	if err := response.Body.Close(); err != nil {
		t.Errorf("closing response: %v", err)
	}
}
