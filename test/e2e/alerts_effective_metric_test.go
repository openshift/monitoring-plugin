//go:build e2e

package e2e

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/metrics"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

const (
	metricPollInterval = 5 * time.Second
	metricPollTimeout  = 3 * time.Minute
)

func fetchMetrics(ctx context.Context, f *framework.Framework) (metricsBody string, err error) {
	req, err := f.AuthorizedRequest(ctx, http.MethodGet, f.PluginURL+"/metrics", nil)
	if err != nil {
		return "", err
	}

	resp, err := f.HTTPClient().Do(req)
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

func parseMetricLines(body string) []string {
	var lines []string
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, metrics.MetricName+"{") {
			lines = append(lines, line)
		}
	}
	return lines
}

func extractLabel(metricLine, labelName string) string {
	key := labelName + `="`
	idx := strings.Index(metricLine, key)
	if idx < 0 {
		return ""
	}
	start := idx + len(key)
	end := strings.Index(metricLine[start:], `"`)
	if end < 0 {
		return ""
	}
	return metricLine[start : start+end]
}

func parseGaugeValue(line string) (float64, error) {
	idx := strings.LastIndex(line, " ")
	if idx < 0 {
		return 0, fmt.Errorf("metric line has no value: %s", line)
	}
	var ts float64
	if _, err := fmt.Sscanf(line[idx+1:], "%g", &ts); err != nil {
		return 0, fmt.Errorf("unparseable value %q: %w", line[idx+1:], err)
	}
	return ts, nil
}

func waitForMetricLines(t *testing.T, f *framework.Framework, match func(string) bool) []string {
	t.Helper()
	ctx := context.Background()
	var matched []string
	err := framework.Poll(metricPollInterval, metricPollTimeout, func() error {
		body, err := fetchMetrics(ctx, f)
		if err != nil {
			return err
		}
		var found []string
		for _, line := range parseMetricLines(body) {
			if match == nil || match(line) {
				found = append(found, line)
			}
		}
		if len(found) == 0 {
			return fmt.Errorf("no matching %s series yet", metrics.MetricName)
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

func assertRequiredMetricLabels(t *testing.T, line string) {
	t.Helper()
	requiredLabels := []string{
		"alertname",
		"alertstate",
		k8s.AlertSourceLabel,
		k8s.AlertBackendLabel,
	}
	for _, label := range requiredLabels {
		if extractLabel(line, label) == "" {
			t.Errorf("missing required label %q: %s", label, line)
		}
	}

	state := extractLabel(line, "alertstate")
	switch state {
	case "firing", "pending", "silenced":
	default:
		t.Errorf("unexpected alertstate=%q: %s", state, line)
	}

	ts, err := parseGaugeValue(line)
	if err != nil {
		t.Errorf("%v", err)
		return
	}
	if ts < 9.46e+08 {
		t.Errorf("suspiciously low timestamp value: %g (before year 2000): %s", ts, line)
	}
}

func assertNoAnnotationLabels(t *testing.T, line string) {
	t.Helper()
	for _, annLabel := range []string{"summary", "description", "runbook_url"} {
		if extractLabel(line, annLabel) != "" {
			t.Errorf("contains annotation label %q (annotations should be excluded): %s",
				annLabel, line)
		}
	}
}

func assertClassificationLabels(t *testing.T, line string) {
	t.Helper()
	if extractLabel(line, k8s.AlertRuleClassificationComponentKey) == "" {
		t.Errorf("missing %s label: %s", k8s.AlertRuleClassificationComponentKey, line)
	}
	if extractLabel(line, k8s.AlertRuleClassificationLayerKey) == "" {
		t.Errorf("missing %s label: %s", k8s.AlertRuleClassificationLayerKey, line)
	}
}

// TestMetricEndpointExposesEffectiveMetric verifies that /metrics exposes
// alerts_effective_active_at_timestamp_seconds as a gauge.
func TestMetricEndpointExposesEffectiveMetric(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	var metricBody string
	err = framework.Poll(metricPollInterval, metricPollTimeout, func() error {
		body, err := fetchMetrics(ctx, f)
		if err != nil {
			return err
		}
		if !strings.Contains(body, metrics.MetricName) {
			return fmt.Errorf("metric %s not found yet (leader election may be in progress)", metrics.MetricName)
		}
		metricBody = body
		return nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for metric to appear: %v", err)
	}

	if !strings.Contains(metricBody, "# HELP "+metrics.MetricName) {
		t.Error("Missing HELP line for metric")
	}
	if !strings.Contains(metricBody, "# TYPE "+metrics.MetricName+" gauge") {
		t.Error("Missing or incorrect TYPE line for metric (expected gauge)")
	}

	lines := parseMetricLines(metricBody)
	if len(lines) == 0 {
		t.Fatal("Expected at least one metric series, got none")
	}
	t.Logf("Found %d metric series for %s", len(lines), metrics.MetricName)
}

// TestMetricSeriesHaveRequiredLabels verifies every series has alertname,
// alertstate, source, backend, and a valid timestamp.
func TestMetricSeriesHaveRequiredLabels(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	lines := waitForMetricLines(t, f, nil)
	for _, line := range lines {
		assertRequiredMetricLabels(t, line)
	}
	t.Logf("All %d series have required labels and valid values", len(lines))
}

// TestMetricIncludesClassificationLabels verifies component and layer labels.
func TestMetricIncludesClassificationLabels(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	lines := waitForMetricLines(t, f, nil)
	for _, line := range lines {
		assertClassificationLabels(t, line)
	}
	t.Logf("All %d series have classification labels (component + layer)", len(lines))
}

// TestMetricExcludesAnnotations verifies summary/description/runbook_url are
// not metric labels.
func TestMetricExcludesAnnotations(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	lines := waitForMetricLines(t, f, nil)
	for _, line := range lines {
		assertNoAnnotationLabels(t, line)
	}
	t.Logf("Verified %d series - none contain annotation labels", len(lines))
}

// TestMetricIncludesCreatedFiringAlert creates a unique always-firing alert
// and checks it appears on the effective metric with expected labels and a
// timestamp that matches GET /alerts ActiveAt.
func TestMetricIncludesCreatedFiringAlert(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

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

	lines := waitForMetricLines(t, f, func(line string) bool {
		return extractLabel(line, "alertname") == alertName
	})
	line := lines[0]
	assertRequiredMetricLabels(t, line)
	assertClassificationLabels(t, line)
	assertNoAnnotationLabels(t, line)

	if got := extractLabel(line, "team"); got != "e2e" {
		t.Errorf("expected team=e2e, got %q", got)
	}
	state := extractLabel(line, "alertstate")
	if state != "firing" && state != "pending" {
		t.Errorf("expected alertstate firing or pending, got %q", state)
	}

	metricTS, err := parseGaugeValue(line)
	if err != nil {
		t.Fatalf("%v", err)
	}

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
// value.
func TestMetricReflectsAlertRelabelConfig(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

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

	lines := waitForMetricLines(t, f, func(line string) bool {
		return extractLabel(line, "alertname") == alertName && extractLabel(line, "team") == "ops"
	})
	assertRequiredMetricLabels(t, lines[0])
	assertNoAnnotationLabels(t, lines[0])
	t.Logf("Relabeling verified on metric: %s", lines[0])
}
