package k8s

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	prometheusRouteNamespace = "openshift-monitoring"
	prometheusRouteName      = "prometheus-k8s"
	prometheusAPIPath        = "/v1/alerts"
)

var (
	prometheusRoutePath = fmt.Sprintf("/apis/route.openshift.io/v1/namespaces/%s/routes/%s", prometheusRouteNamespace, prometheusRouteName)
)

type prometheusAlerts struct {
	clientset *kubernetes.Clientset
	config    *rest.Config
}

// GetAlertsRequest holds parameters for filtering alerts
type GetAlertsRequest struct {
	// Labels filters alerts by labels
	Labels map[string]string
	// State filters alerts by state: "firing", "pending", or "" for all states
	State string
}

type PrometheusAlert struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	State       string            `json:"state"`
	ActiveAt    time.Time         `json:"activeAt"`
	Value       string            `json:"value"`
}

type prometheusAlertsResponse struct {
	Status string `json:"status"`
	Data   struct {
		Alerts []PrometheusAlert `json:"alerts"`
	} `json:"data"`
}

type prometheusRoute struct {
	Spec struct {
		Host string `json:"host"`
		Path string `json:"path"`
	} `json:"spec"`
}

func newPrometheusAlerts(clientset *kubernetes.Clientset, config *rest.Config) *prometheusAlerts {
	return &prometheusAlerts{
		clientset: clientset,
		config:    config,
	}
}

func (pa prometheusAlerts) GetAlerts(ctx context.Context, req GetAlertsRequest) ([]PrometheusAlert, error) {
	raw, err := pa.getAlertsViaProxy(ctx)
	if err != nil {
		return nil, err
	}

	var alertsResp prometheusAlertsResponse
	if err := json.Unmarshal(raw, &alertsResp); err != nil {
		return nil, fmt.Errorf("decode prometheus response: %w", err)
	}

	if alertsResp.Status != "success" {
		return nil, fmt.Errorf("prometheus API returned non-success status: %s", alertsResp.Status)
	}

	out := make([]PrometheusAlert, 0, len(alertsResp.Data.Alerts))
	for _, a := range alertsResp.Data.Alerts {
		// Filter alerts based on state if provided
		if req.State != "" && a.State != req.State {
			continue
		}

		// Filter alerts based on labels if provided
		if !labelsMatch(&req, &a) {
			continue
		}

		out = append(out, a)
	}
	return out, nil
}

func (pa prometheusAlerts) getAlertsViaProxy(ctx context.Context) ([]byte, error) {
	url, err := pa.buildPrometheusURL(ctx)
	if err != nil {
		return nil, err
	}

	client, err := pa.createHTTPClient()
	if err != nil {
		return nil, err
	}

	return pa.executeRequest(ctx, client, url)
}

func (pa prometheusAlerts) buildPrometheusURL(ctx context.Context) (string, error) {
	route, err := pa.fetchPrometheusRoute(ctx)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("https://%s%s%s", route.Spec.Host, route.Spec.Path, prometheusAPIPath), nil
}

func (pa prometheusAlerts) fetchPrometheusRoute(ctx context.Context) (*prometheusRoute, error) {
	routeData, err := pa.clientset.CoreV1().RESTClient().
		Get().
		AbsPath(prometheusRoutePath).
		DoRaw(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get prometheus route: %w", err)
	}

	var route prometheusRoute
	if err := json.Unmarshal(routeData, &route); err != nil {
		return nil, fmt.Errorf("failed to parse route: %w", err)
	}

	return &route, nil
}

func (pa prometheusAlerts) createHTTPClient() (*http.Client, error) {
	tlsConfig, err := pa.buildTLSConfig()
	if err != nil {
		return nil, err
	}

	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		},
	}, nil
}

func (pa prometheusAlerts) buildTLSConfig() (*tls.Config, error) {
	caCertPool, err := pa.loadCACertPool()
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		MinVersion: tls.VersionTLS12,
		RootCAs:    caCertPool,
	}, nil
}

func (pa prometheusAlerts) loadCACertPool() (*x509.CertPool, error) {
	caCertPool, err := x509.SystemCertPool()
	if err != nil {
		caCertPool = x509.NewCertPool()
	}

	if len(pa.config.CAData) > 0 {
		caCertPool.AppendCertsFromPEM(pa.config.CAData)
		return caCertPool, nil
	}

	if pa.config.CAFile != "" {
		caCert, err := os.ReadFile(pa.config.CAFile)
		if err != nil {
			return nil, fmt.Errorf("read CA cert file: %w", err)
		}
		caCertPool.AppendCertsFromPEM(caCert)
	}

	return caCertPool, nil
}

func (pa prometheusAlerts) executeRequest(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	req, err := pa.createAuthenticatedRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	return pa.performRequest(client, req)
}

func (pa prometheusAlerts) createAuthenticatedRequest(ctx context.Context, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	token, err := pa.loadBearerToken()
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	return req, nil
}

func (pa prometheusAlerts) loadBearerToken() (string, error) {
	if pa.config.BearerToken != "" {
		return pa.config.BearerToken, nil
	}

	if pa.config.BearerTokenFile == "" {
		return "", fmt.Errorf("no bearer token or token file configured")
	}

	tokenBytes, err := os.ReadFile(pa.config.BearerTokenFile)
	if err != nil {
		return "", fmt.Errorf("load bearer token file: %w", err)
	}

	return string(tokenBytes), nil
}

func (pa prometheusAlerts) performRequest(client *http.Client, req *http.Request) ([]byte, error) {
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

func labelsMatch(req *GetAlertsRequest, alert *PrometheusAlert) bool {
	for key, value := range req.Labels {
		if alertValue, exists := alert.Labels[key]; !exists || alertValue != value {
			return false
		}
	}

	return true
}
