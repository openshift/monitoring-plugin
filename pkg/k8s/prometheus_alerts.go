package k8s

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	prometheusRouteNamespace = "openshift-monitoring"
	prometheusAPIPath        = "/api/v1/alerts"
	thanosRouteName          = "thanos-querier"
	thanosAPIV1AlertsPath    = "/v1/alerts"
	defaultServiceCAPath     = "/var/run/configmaps/service-ca/service-ca.crt"
	envSSLCertFile           = "SSL_CERT_FILE"
	prometheusServiceHost    = "prometheus-k8s.openshift-monitoring.svc"
	prometheusServiceTLSPort = "9091"
	prometheusServiceHTTPPort = "9090"
	// In-cluster fallbacks (service DNS) if route lookup is not available
	inClusterPrometheusURL = "https://" + prometheusServiceHost + ":" + prometheusServiceTLSPort + prometheusAPIPath
	// Some environments expose Prometheus on 9090 (plain HTTP)
	inClusterPrometheusHTTPURL = "http://" + prometheusServiceHost + ":" + prometheusServiceHTTPPort + prometheusAPIPath
	// Thanos exposes API under /api; full alerts endpoint becomes /api/v1/alerts
	inClusterThanosURL = "https://thanos-querier.openshift-monitoring.svc:9091" + prometheusAPIPath
)

func buildRoutePath(routeName string) string {
	return fmt.Sprintf("/apis/route.openshift.io/v1/namespaces/%s/routes/%s", prometheusRouteNamespace, routeName)
}

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
	// Optional enrichment populated by management layer
	AlertRuleId    string `json:"openshift_io_alert_rule_id,omitempty"`
	AlertComponent string `json:"openshift_io_alert_component,omitempty"`
	AlertLayer     string `json:"openshift_io_alert_layer,omitempty"`
}

type prometheusAlertsData struct {
	Alerts []PrometheusAlert `json:"alerts"`
}

type prometheusAlertsResponse struct {
	Status string `json:"status"`
	Data   prometheusAlertsData `json:"data"`
}

type prometheusRouteSpec struct {
	Host string `json:"host"`
	Path string `json:"path"`
}

type prometheusRoute struct {
	Spec prometheusRouteSpec `json:"spec"`
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
	// Try multiple candidates to keep Prometheus API compatibility:
	// 1) In-cluster prometheus service (most reliable inside the cluster)
	// 2) Route to prometheus-k8s (if available)
	candidates := pa.buildCandidateURLs(ctx)
	client, err := pa.createHTTPClient()
	if err != nil {
		return nil, err
	}

	var lastErr error
	logrus.Debugf("prometheus alerts: candidate URLs: %+v", candidates)
	for _, url := range candidates {
		if url == "" {
			continue
		}
		logrus.Debugf("prometheus alerts: querying %s", url)
		if raw, err := pa.executeRequest(ctx, client, url); err == nil {
			return raw, nil
		} else {
			logrus.Debugf("prometheus alerts: %s failed: %v", url, err)
			lastErr = err
		}
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no candidate URLs to query alerts")
	}
	return nil, fmt.Errorf("failed to get prometheus alerts: %w", lastErr)
}

func (pa prometheusAlerts) buildCandidateURLs(ctx context.Context) []string {
	var urls []string

	buildPrometheusCandidates := func() []string {
		var c []string
		// In-cluster Prometheus first (9091 TLS)
		c = append(c, inClusterPrometheusURL)
		// Some environments expose Prometheus on 9090 (plain HTTP)
		c = append(c, inClusterPrometheusHTTPURL)
		// Prometheus Route if exists
		if route, err := pa.fetchPrometheusRoute(ctx, "prometheus-k8s"); err == nil && route != nil && route.Spec.Host != "" {
			c = append(c, fmt.Sprintf("https://%s%s%s", route.Spec.Host, route.Spec.Path, prometheusAPIPath))
		}
		return c
	}

	buildThanosCandidates := func() []string {
		var c []string
		// Thanos Route (oauth-proxied): route path is /api, final endpoint /api/v1/alerts
		if route, err := pa.fetchPrometheusRoute(ctx, thanosRouteName); err == nil && route != nil && route.Spec.Host != "" {
			c = append(c, fmt.Sprintf("https://%s%s%s", route.Spec.Host, route.Spec.Path, thanosAPIV1AlertsPath))
		}
		// In-cluster Thanos service as fallback
		c = append(c, inClusterThanosURL)
		return c
	}

	// Align with alerts-ui-management: prefer Thanos route first (aggregated alerts),
	// then fall back to in-cluster Prometheus and its route.
	urls = append(urls, buildThanosCandidates()...)
	urls = append(urls, buildPrometheusCandidates()...)
	// Log candidates at debug to avoid noisy logs and leaking internal URLs at info level
	logrus.Debugf("prometheus alerts: candidates=%v", urls)
	return urls
}

func (pa prometheusAlerts) fetchPrometheusRoute(ctx context.Context, routeName string) (*prometheusRoute, error) {
	routeData, err := pa.clientset.CoreV1().RESTClient().
		Get().
		AbsPath(buildRoutePath(routeName)).
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

	// Prefer explicitly provided CA data/file from rest.Config
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

	// If an explicit SSL_CERT_FILE is set, append it (commonly pointed to service-ca)
	if sslCA := os.Getenv(envSSLCertFile); sslCA != "" {
		if b, err := os.ReadFile(sslCA); err == nil {
			caCertPool.AppendCertsFromPEM(b)
		}
	}
	// Append default mounted service-ca if present
	if _, err := os.Stat(defaultServiceCAPath); err == nil {
		if b, err := os.ReadFile(filepath.Clean(defaultServiceCAPath)); err == nil {
			caCertPool.AppendCertsFromPEM(b)
		}
	}

	return caCertPool, nil
}

func (pa prometheusAlerts) executeRequest(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	req, err := pa.createAuthenticatedRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	raw, err := pa.performRequest(client, req)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", url, err)
	}
	return raw, nil
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
		return "", errors.New("no bearer token or token file configured")
	}

	tokenBytes, err := os.ReadFile(pa.config.BearerTokenFile)
	if err != nil {
		return "", fmt.Errorf("load bearer token file: %w", err)
	}

	return strings.TrimSpace(string(tokenBytes)), nil
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
