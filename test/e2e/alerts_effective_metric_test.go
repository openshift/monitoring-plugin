//go:build e2e

package e2e

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	osmv1 "github.com/openshift/api/monitoring/v1"
	routev1 "github.com/openshift/api/route/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

// The e2e suite pins the wire contract of the metric instead of importing
// the backend's unexported constant.
const alertsEffectiveMetricName = "alerts_effective_active_at_timestamp_seconds"

const (
	metricPollInterval = 5 * time.Second
	metricPollTimeout  = 3 * time.Minute
)

// fetchMetrics scrapes the plugin's /metrics endpoint. The endpoint only
// accepts requests authenticated with the prometheus-k8s client certificate,
// the same certificate the cluster-monitoring-operator mounts for the
// ServiceMonitor with the tls-client-certificate-auth scrape class. Reencrypt
// routes terminate TLS at the router and cannot forward that certificate, so
// the scrape goes through a dedicated passthrough route.
func fetchMetrics(ctx context.Context, f *framework.Framework) (string, error) {
	scrapeURL, err := metricsScrapeURL(ctx, f)
	if err != nil {
		return "", err
	}

	secret, err := f.Clientset.CoreV1().Secrets(k8s.ClusterMonitoringNamespace).Get(
		ctx, "metrics-client-certs", metav1.GetOptions{},
	)
	if err != nil {
		return "", fmt.Errorf("reading prometheus-k8s client certificate: %w", err)
	}

	cert, err := tls.X509KeyPair(secret.Data["tls.crt"], secret.Data["tls.key"])
	if err != nil {
		return "", fmt.Errorf("parsing prometheus-k8s client certificate: %w", err)
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{
		Certificates: []tls.Certificate{cert},
		// TLS is terminated at the plugin, but the passthrough route is
		// served by the router's certificate, not the plugin's own.
		InsecureSkipVerify: true,
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: transport}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, scrapeURL, nil)
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GET %s: unexpected status %d: %s",
			scrapeURL, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return string(body), nil
}

// metricsClientCAMissingMsg is the fail-closed 401 body returned when
// TLS is on but no client CA bundle is configured.
const metricsClientCAMissingMsg = "metrics client CA unavailable"

// requireMetricsClientCAWiring skips when the deployed operator has not
// wired the client CA yet (cluster-monitoring-operator#3175), so every
// metrics scrape fails closed with 401.
func requireMetricsClientCAWiring(t *testing.T, f *framework.Framework) {
	if _, err := fetchMetrics(context.Background(), f); err != nil &&
		strings.Contains(err.Error(), "unexpected status 401") &&
		strings.Contains(err.Error(), metricsClientCAMissingMsg) {
		t.Skipf("plugin metrics endpoint has no client CA bundle wired: %v"+
			" (requires the cluster-monitoring-operator change,"+
			" openshift/cluster-monitoring-operator#3175)", err)
	}
}

const (
	// metricsRouteName names the passthrough route the metrics tests create
	// for client-certificate scrapes. The name is fixed so repeated runs
	// reuse it instead of accumulating routes.
	metricsRouteName = "monitoring-plugin-metrics-e2e"

	routePollInterval = 2 * time.Second
	routePollTimeout  = 60 * time.Second
	// Route teardown must stay bounded when the suite's contexts are gone.
	routeCleanupTimeout = 20 * time.Second
)

var (
	metricsRouteMu      sync.Mutex
	metricsRouteHost    string
	metricsRouteCreated bool
)

// metricsScrapeURL returns the /metrics URL served through the passthrough
// route, creating the route on first use.
func metricsScrapeURL(ctx context.Context, f *framework.Framework) (string, error) {
	metricsRouteMu.Lock()
	defer metricsRouteMu.Unlock()

	if metricsRouteHost == "" {
		host, err := ensureMetricsRoute(ctx, f)
		if err != nil {
			return "", err
		}
		metricsRouteHost = host
	}
	return "https://" + metricsRouteHost + "/metrics", nil
}

// ensureMetricsRoute creates the passthrough route to the plugin service and
// returns the host assigned by the router.
func ensureMetricsRoute(ctx context.Context, f *framework.Framework) (string, error) {
	routes := f.Routev1clientset.RouteV1().Routes(k8s.ClusterMonitoringNamespace)

	_, err := routes.Get(ctx, metricsRouteName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		route := &routev1.Route{
			ObjectMeta: metav1.ObjectMeta{
				Name:      metricsRouteName,
				Namespace: k8s.ClusterMonitoringNamespace,
				Annotations: map[string]string{
					"openshift.io/description": "Passthrough route created by the monitoring-plugin e2e tests; safe to delete when no test suite is running.",
				},
			},
			Spec: routev1.RouteSpec{
				To: routev1.RouteTargetReference{
					Kind: "Service",
					Name: "monitoring-plugin",
				},
				Port: &routev1.RoutePort{TargetPort: intstr.FromString("https")},
				TLS:  &routev1.TLSConfig{Termination: routev1.TLSTerminationPassthrough},
			},
		}
		_, err = routes.Create(ctx, route, metav1.CreateOptions{})
		if apierrors.IsAlreadyExists(err) {
			err = nil
		}
	}
	if err != nil {
		return "", fmt.Errorf("creating passthrough route: %w", err)
	}
	metricsRouteCreated = true

	// The router assigns the host asynchronously after route admission.
	var host string
	err = framework.Poll(routePollInterval, routePollTimeout, func() error {
		route, err := routes.Get(ctx, metricsRouteName, metav1.GetOptions{})
		if err != nil {
			return err
		}
		if len(route.Status.Ingress) == 0 || route.Status.Ingress[0].Host == "" {
			return fmt.Errorf("route has no assigned host yet")
		}
		host = route.Status.Ingress[0].Host
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("waiting for route host: %w", err)
	}
	return host, nil
}

// deleteMetricsRoute removes the passthrough route if the tests created it.
func deleteMetricsRoute() error {
	metricsRouteMu.Lock()
	created := metricsRouteCreated
	metricsRouteMu.Unlock()

	if !created {
		return nil
	}

	f, err := framework.New()
	if err != nil {
		return fmt.Errorf("creating framework for route cleanup: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), routeCleanupTimeout)
	defer cancel()
	return f.Routev1clientset.RouteV1().Routes(k8s.ClusterMonitoringNamespace).Delete(
		ctx, metricsRouteName, metav1.DeleteOptions{},
	)
}

// parseMetricFamilies parses a Prometheus text exposition body.
func parseMetricFamilies(body string) (map[string]*dto.MetricFamily, error) {
	// A shared zero-value TextParser panics on concurrent use, and
	// prometheus/common v0.67+ requires explicit UTF-8 validation.
	parser := expfmt.NewTextParser(model.UTF8Validation)
	families, err := parser.TextToMetricFamilies(strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("parse metrics body: %w", err)
	}
	return families, nil
}

// parseMetricSamples returns the samples of the given metric families
// (defaulting to the effective-alerts family) as a model.Vector.
func parseMetricSamples(body string, metricNames ...string) (model.Vector, error) {
	if len(metricNames) == 0 {
		metricNames = []string{alertsEffectiveMetricName}
	}

	families, err := parseMetricFamilies(body)
	if err != nil {
		return nil, err
	}

	wanted := make(map[string]struct{}, len(metricNames))
	for _, name := range metricNames {
		wanted[name] = struct{}{}
	}

	var samples model.Vector
	for name, family := range families {
		if _, ok := wanted[name]; !ok {
			continue
		}
		if family.GetType() != dto.MetricType_GAUGE {
			return nil, fmt.Errorf("metric %s is a %s, only gauges are supported", name, family.GetType())
		}
		for _, m := range family.Metric {
			sample := &model.Sample{
				Metric: model.Metric{model.MetricNameLabel: model.LabelValue(name)},
				Value:  model.SampleValue(m.GetGauge().GetValue()),
			}
			for _, lp := range m.Label {
				sample.Metric[model.LabelName(lp.GetName())] = model.LabelValue(lp.GetValue())
			}
			samples = append(samples, sample)
		}
	}
	return samples, nil
}

// samplesForAlert returns the samples whose alertname label matches.
func samplesForAlert(samples model.Vector, alertName string) model.Vector {
	var filtered model.Vector
	for _, sample := range samples {
		if sample.Metric["alertname"] == model.LabelValue(alertName) {
			filtered = append(filtered, sample)
		}
	}
	return filtered
}

func waitForMetricSamples(t *testing.T, f *framework.Framework, match func(*model.Sample) bool) model.Vector {
	t.Helper()

	ctx := context.Background()
	var matched model.Vector
	err := framework.Poll(metricPollInterval, metricPollTimeout, func() error {
		body, err := fetchMetrics(ctx, f)
		if err != nil {
			return err
		}
		samples, err := parseMetricSamples(body)
		if err != nil {
			return err
		}

		var found model.Vector
		for _, sample := range samples {
			if match == nil || match(sample) {
				found = append(found, sample)
			}
		}
		if len(found) == 0 {
			return fmt.Errorf("no matching %s series yet", alertsEffectiveMetricName)
		}
		matched = found
		return nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for metric series: %v", err)
	}
	return matched
}

func alwaysFiringRule(alertName, exprLabel string, labels map[string]string) monitoringv1.Rule {
	forDuration := monitoringv1.Duration("1s")
	ruleLabels := map[string]string{
		"severity": "none",
	}
	for k, v := range labels {
		ruleLabels[k] = v
	}
	return monitoringv1.Rule{
		Alert:  alertName,
		Expr:   intstr.FromString(fmt.Sprintf(`absent(nonexistent{test_label=%q})`, exprLabel)),
		For:    &forDuration,
		Labels: ruleLabels,
		Annotations: map[string]string{
			"summary":     "e2e effective metric test",
			"description": "should not appear as a metric label",
			"runbook_url": "https://example.invalid/runbook",
		},
	}
}

func assertRequiredMetricLabels(t *testing.T, sample *model.Sample) {
	t.Helper()

	requiredLabels := []model.LabelName{
		"alertname",
		"alertstate",
		k8s.AlertSourceLabel,
		k8s.AlertBackendLabel,
	}
	for _, label := range requiredLabels {
		if sample.Metric[label] == "" {
			t.Errorf("missing required label %q: %s", label, sample.Metric.String())
		}
	}

	state := sample.Metric["alertstate"]
	switch state {
	case "firing", "pending", "silenced":
	default:
		t.Errorf("unexpected alertstate=%q: %s", state, sample.Metric.String())
	}

	if ts := float64(sample.Value); ts < 9.46e+08 {
		t.Errorf("suspiciously low timestamp value: %g (before year 2000): %s", ts, sample.Metric.String())
	}
}

func assertNoAnnotationLabels(t *testing.T, sample *model.Sample) {
	t.Helper()

	for _, annLabel := range []model.LabelName{"summary", "description", "runbook_url"} {
		if sample.Metric[annLabel] != "" {
			t.Errorf("contains annotation label %q (annotations should be excluded): %s",
				annLabel, sample.Metric.String())
		}
	}
}

func assertClassificationLabels(t *testing.T, sample *model.Sample) {
	t.Helper()

	if sample.Metric[k8s.AlertRuleClassificationComponentKey] == "" {
		t.Errorf("missing %s label: %s", k8s.AlertRuleClassificationComponentKey, sample.Metric.String())
	}
	if sample.Metric[k8s.AlertRuleClassificationLayerKey] == "" {
		t.Errorf("missing %s label: %s", k8s.AlertRuleClassificationLayerKey, sample.Metric.String())
	}
}

// TestMetricEndpointExposesEffectiveMetric verifies that /metrics exposes
// alerts_effective_active_at_timestamp_seconds as a gauge.
func TestMetricEndpointExposesEffectiveMetric(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	requireMetricsClientCAWiring(t, f)

	ctx := context.Background()
	var metricBody string
	err = framework.Poll(metricPollInterval, metricPollTimeout, func() error {
		body, err := fetchMetrics(ctx, f)
		if err != nil {
			return err
		}
		if !strings.Contains(body, alertsEffectiveMetricName) {
			return fmt.Errorf("metric %s not found yet (leader election may be in progress)", alertsEffectiveMetricName)
		}
		metricBody = body
		return nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for metric to appear: %v", err)
	}

	families, err := parseMetricFamilies(metricBody)
	if err != nil {
		t.Fatalf("Failed to parse metrics body: %v", err)
	}
	family, ok := families[alertsEffectiveMetricName]
	if !ok {
		t.Fatalf("Expected metric family %s, got none", alertsEffectiveMetricName)
	}
	if family.GetHelp() == "" {
		t.Error("Missing HELP line for metric")
	}
	if family.GetType() != dto.MetricType_GAUGE {
		t.Errorf("Missing or incorrect TYPE line for metric (expected gauge, got %s)", family.GetType())
	}

	samples, err := parseMetricSamples(metricBody)
	if err != nil {
		t.Fatalf("Failed to parse metric samples: %v", err)
	}
	if len(samples) == 0 {
		t.Fatal("Expected at least one metric series, got none")
	}
	t.Logf("Found %d metric series for %s", len(samples), alertsEffectiveMetricName)
}

// TestMetricSeriesHaveRequiredLabels verifies every series has alertname,
// alertstate, source, backend, and a valid timestamp.
func TestMetricSeriesHaveRequiredLabels(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	requireMetricsClientCAWiring(t, f)

	samples := waitForMetricSamples(t, f, nil)
	for _, sample := range samples {
		assertRequiredMetricLabels(t, sample)
	}
	t.Logf("All %d series have required labels and valid values", len(samples))
}

// TestMetricIncludesClassificationLabels verifies component and layer labels.
func TestMetricIncludesClassificationLabels(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	requireMetricsClientCAWiring(t, f)

	samples := waitForMetricSamples(t, f, nil)
	for _, sample := range samples {
		assertClassificationLabels(t, sample)
	}
	t.Logf("All %d series have classification labels (component + layer)", len(samples))
}

// TestMetricExcludesAnnotations verifies summary/description/runbook_url are
// not metric labels.
func TestMetricExcludesAnnotations(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	requireMetricsClientCAWiring(t, f)

	samples := waitForMetricSamples(t, f, nil)
	for _, sample := range samples {
		assertNoAnnotationLabels(t, sample)
	}
	t.Logf("Verified %d series - none contain annotation labels", len(samples))
}

// TestMetricIncludesCreatedFiringAlert creates a unique always-firing alert
// and checks it appears on the effective metric with expected labels and a
// timestamp that matches GET /alerts ActiveAt.
func TestMetricIncludesCreatedFiringAlert(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	requireMetricsClientCAWiring(t, f)

	ctx := context.Background()
	testNamespace, cleanup, err := f.CreateUserNamespace(ctx, "test-effective-metric")
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer func() {
		if err := cleanup(); err != nil {
			t.Logf("cleanup failed: %v", err)
		}
	}()

	alertName := "E2EEffectiveMetricFiring"
	rule := alwaysFiringRule(alertName, "e2e_effective_metric_firing", map[string]string{
		"team": "e2e",
	})
	if _, err := createPrometheusRule(ctx, f, testNamespace, rule); err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	samples := waitForMetricSamples(t, f, func(sample *model.Sample) bool {
		return sample.Metric["alertname"] == model.LabelValue(alertName)
	})
	sample := samples[0]
	assertRequiredMetricLabels(t, sample)
	assertClassificationLabels(t, sample)
	assertNoAnnotationLabels(t, sample)

	if got := sample.Metric["team"]; got != "e2e" {
		t.Errorf("expected team=e2e, got %q", got)
	}
	state := sample.Metric["alertstate"]
	if state != "firing" && state != "pending" {
		t.Errorf("expected alertstate firing or pending, got %q", state)
	}

	metricTS := float64(sample.Value)

	// Collector EnrichAlerts uses the cluster-wide path; match that here so
	// tenancy lag on a brand-new namespace cannot flake the timestamp check.
	alerts, status, err := getAlertsWithToken(f, ctx, f.BearerToken, "")
	if err != nil {
		t.Fatalf("GET /alerts failed: %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("GET /alerts status %d", status)
	}
	var alertActiveAt time.Time
	for _, alert := range alerts {
		if alert.Labels["alertname"] == alertName {
			alertActiveAt = alert.ActiveAt
			break
		}
	}
	if alertActiveAt.IsZero() {
		t.Fatalf("GET /alerts did not return %s", alertName)
	}
	if got := float64(alertActiveAt.Unix()); got != metricTS {
		t.Errorf("metric timestamp %g does not match GET /alerts ActiveAt %g", metricTS, got)
	}
}

// TestMetricReflectsAlertRelabelConfig creates a firing platform alert and an
// ARC that rewrites team, then checks the metric exposes the post-relabel
// value. Instances the ARC rejects have no series in this family.
func TestMetricReflectsAlertRelabelConfig(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	requireMetricsClientCAWiring(t, f)

	ctx := context.Background()
	testNamespace, cleanup, err := f.CreatePlatformNamespace(ctx, "test-effective-metric-relabel")
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer func() {
		if err := cleanup(); err != nil {
			t.Logf("cleanup failed: %v", err)
		}
	}()

	alertName := "E2EEffectiveMetricRelabel"
	rule := alwaysFiringRule(alertName, "e2e_effective_metric_relabel", map[string]string{
		"team": "web",
	})
	if _, err := createPrometheusRule(ctx, f, testNamespace, rule); err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	relabelConfigName := "e2e-effective-metric-team"
	arc := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      relabelConfigName,
			Namespace: k8s.ClusterMonitoringNamespace,
		},
		Spec: osmv1.AlertRelabelConfigSpec{
			Configs: []osmv1.RelabelConfig{
				{
					SourceLabels: []osmv1.LabelName{"alertname"},
					Regex:        alertName,
					TargetLabel:  "team",
					Replacement:  "ops",
					Action:       "Replace",
				},
			},
		},
	}
	_, err = f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Create(
		ctx, arc, metav1.CreateOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to create AlertRelabelConfig: %v", err)
	}
	defer func() {
		err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Delete(
			ctx, relabelConfigName, metav1.DeleteOptions{},
		)
		if err != nil {
			t.Logf("Failed to delete AlertRelabelConfig: %v", err)
		}
	}()

	var effectiveForAlert model.Vector
	err = framework.Poll(metricPollInterval, metricPollTimeout, func() error {
		body, fetchErr := fetchMetrics(ctx, f)
		if fetchErr != nil {
			return fetchErr
		}

		samples, parseErr := parseMetricSamples(body)
		if parseErr != nil {
			return parseErr
		}

		effectiveForAlert = samplesForAlert(samples, alertName)
		for _, sample := range effectiveForAlert {
			if sample.Metric["team"] == "ops" {
				return nil
			}
		}
		return fmt.Errorf("no %s series with team=ops yet", alertName)
	})
	if err != nil {
		t.Fatalf("Timeout waiting for relabeled metric: %v", err)
	}

	for _, sample := range effectiveForAlert {
		if sample.Metric["team"] != "ops" {
			t.Errorf("unexpected pre-relabel series for %s: %s", alertName, sample.Metric.String())
		}
		assertRequiredMetricLabels(t, sample)
		assertNoAnnotationLabels(t, sample)
	}
	t.Logf("Relabeling verified on metric: %s", effectiveForAlert[0].Metric.String())
}
