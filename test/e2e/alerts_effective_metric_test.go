//go:build e2e

package e2e

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
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

// parseMetricFamilies parses a Prometheus text exposition body.
func parseMetricFamilies(body string) (map[string]*dto.MetricFamily, error) {
	var parser expfmt.TextParser
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
		metricNames = []string{metrics.MetricName}
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

	families, err := parseMetricFamilies(metricBody)
	if err != nil {
		t.Fatalf("Failed to parse metrics body: %v", err)
	}
	family, ok := families[metrics.MetricName]
	if !ok {
		t.Fatalf("Expected metric family %s, got none", metrics.MetricName)
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
	t.Logf("Found %d metric series for %s", len(samples), metrics.MetricName)
}

// TestMetricSeriesHaveRequiredLabels verifies every series has alertname,
// alertstate, source, backend, and a valid timestamp.
func TestMetricSeriesHaveRequiredLabels(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

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
// value and moves to the dropped family when the ARC rejects the instance.
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

	arc, err = f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Get(ctx, relabelConfigName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get AlertRelabelConfig: %v", err)
	}
	arc.Spec.Configs = append(arc.Spec.Configs, osmv1.RelabelConfig{
		SourceLabels: []osmv1.LabelName{"alertname"},
		Regex:        alertName,
		Action:       "Drop",
	})
	if _, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Update(ctx, arc, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("Failed to add Drop to AlertRelabelConfig: %v", err)
	}
	var effectiveSamples, droppedForAlert model.Vector
	err = framework.Poll(metricPollInterval, metricPollTimeout, func() error {
		body, fetchErr := fetchMetrics(ctx, f)
		if fetchErr != nil {
			return fetchErr
		}

		allEffective, parseErr := parseMetricSamples(body)
		if parseErr != nil {
			return parseErr
		}
		allDropped, parseErr := parseMetricSamples(body, metrics.DroppedMetricName)
		if parseErr != nil {
			return parseErr
		}

		effectiveSamples = allEffective
		droppedForAlert = samplesForAlert(allDropped, alertName)

		if len(droppedForAlert) > 0 {
			return nil
		}
		return fmt.Errorf("no %s series in %s yet", alertName, metrics.DroppedMetricName)
	})
	if err != nil {
		t.Fatalf("Timeout waiting for dropped metric: %v", err)
	}

	for _, sample := range samplesForAlert(effectiveSamples, alertName) {
		t.Errorf("rejected alert remains in the effective family: %s", sample.Metric.String())
	}

	for _, sample := range droppedForAlert {
		state := sample.Metric["alertstate"]
		if (state != "pending" && state != "firing") || sample.Metric["team"] != "ops" {
			t.Errorf("expected dropped series retaining native state and team=ops: %s", sample.Metric.String())
		}
		assertRequiredMetricLabels(t, sample)
		assertClassificationLabels(t, sample)
		assertNoAnnotationLabels(t, sample)
	}
}
