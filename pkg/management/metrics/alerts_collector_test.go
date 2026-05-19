package metrics_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/metrics"
)

type mockAlertsFetcher struct {
	alerts []k8s.PrometheusAlert
	err    error
}

func (m *mockAlertsFetcher) GetAlerts(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
	return m.alerts, m.err
}

func collectMetrics(t *testing.T, collector prometheus.Collector) []*dto.MetricFamily {
	t.Helper()
	reg := prometheus.NewRegistry()
	reg.MustRegister(collector)
	families, err := reg.Gather()
	if err != nil {
		t.Fatalf("gather metrics: %v", err)
	}
	return families
}

func findFamily(families []*dto.MetricFamily, name string) *dto.MetricFamily {
	for _, f := range families {
		if f.GetName() == name {
			return f
		}
	}
	return nil
}

func labelValue(m *dto.Metric, name string) string {
	for _, lp := range m.GetLabel() {
		if lp.GetName() == name {
			return lp.GetValue()
		}
	}
	return ""
}

func newCollector(t *testing.T, mock *mockAlertsFetcher) (prometheus.Collector, context.CancelFunc) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	collector := metrics.NewAlertsCollector(ctx, mock, 1*time.Hour, func() bool { return true })
	time.Sleep(100 * time.Millisecond)
	t.Cleanup(cancel)
	return collector, cancel
}

func TestAlertsCollector_FiringAndSilenced(t *testing.T) {
	activeAt := time.Date(2026, 3, 5, 10, 0, 0, 0, time.UTC)
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{
				Labels:   map[string]string{"alertname": "HighCPU", "severity": "critical", "namespace": "production"},
				State:    "firing",
				ActiveAt: activeAt,
			},
			{
				Labels:   map[string]string{"alertname": "DiskFull", "severity": "warning", "namespace": "storage"},
				State:    "silenced",
				ActiveAt: activeAt.Add(-1 * time.Hour),
			},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family == nil {
		t.Fatal("expected metric family, got nil")
	}
	if len(family.GetMetric()) != 2 {
		t.Fatalf("expected 2 metrics, got %d", len(family.GetMetric()))
	}

	var firing, silenced *dto.Metric
	for _, m := range family.GetMetric() {
		switch labelValue(m, "alertname") {
		case "HighCPU":
			firing = m
		case "DiskFull":
			silenced = m
		}
	}

	if firing == nil {
		t.Fatal("expected HighCPU metric")
	}
	if labelValue(firing, "alertstate") != "firing" {
		t.Errorf("alertstate: want firing, got %q", labelValue(firing, "alertstate"))
	}
	if labelValue(firing, "severity") != "critical" {
		t.Errorf("severity: want critical, got %q", labelValue(firing, "severity"))
	}
	if labelValue(firing, "namespace") != "production" {
		t.Errorf("namespace: want production, got %q", labelValue(firing, "namespace"))
	}
	if firing.GetGauge().GetValue() != float64(activeAt.Unix()) {
		t.Errorf("gauge value: want %v, got %v", float64(activeAt.Unix()), firing.GetGauge().GetValue())
	}

	if silenced == nil {
		t.Fatal("expected DiskFull metric")
	}
	if labelValue(silenced, "alertstate") != "silenced" {
		t.Errorf("alertstate: want silenced, got %q", labelValue(silenced, "alertstate"))
	}
	if silenced.GetGauge().GetValue() != float64(activeAt.Add(-1*time.Hour).Unix()) {
		t.Errorf("silenced gauge value mismatch")
	}
}

func TestAlertsCollector_NoAnnotationLabels(t *testing.T) {
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "TestAlert"}, State: "firing", ActiveAt: time.Now()},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family == nil {
		t.Fatal("expected metric family")
	}
	if len(family.GetMetric()) != 1 {
		t.Fatalf("expected 1 metric, got %d", len(family.GetMetric()))
	}
	for _, lp := range family.GetMetric()[0].GetLabel() {
		switch lp.GetName() {
		case "summary", "description", "runbook_url":
			t.Errorf("unexpected annotation label: %s", lp.GetName())
		}
	}
}

func TestAlertsCollector_SkipsZeroActiveAt(t *testing.T) {
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "NoActiveAt"}, State: "firing", ActiveAt: time.Time{}},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family != nil && len(family.GetMetric()) != 0 {
		t.Errorf("expected no metrics for zero ActiveAt, got %d", len(family.GetMetric()))
	}
}

func TestAlertsCollector_EmptyAlerts(t *testing.T) {
	mock := &mockAlertsFetcher{alerts: []k8s.PrometheusAlert{}}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family != nil && len(family.GetMetric()) != 0 {
		t.Errorf("expected no metrics for empty alerts, got %d", len(family.GetMetric()))
	}
}

func TestAlertsCollector_FetcherErrorProducesNoMetrics(t *testing.T) {
	mock := &mockAlertsFetcher{err: errors.New("connection refused")}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family != nil && len(family.GetMetric()) != 0 {
		t.Errorf("expected no metrics on initial failure, got %d", len(family.GetMetric()))
	}
}

func TestAlertsCollector_ClassificationLabels(t *testing.T) {
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{
				Labels: map[string]string{
					"alertname":                             "KubePodCrashLooping",
					"severity":                              "warning",
					"namespace":                             "kube-system",
					k8s.AlertRuleLabelId:                    "abc123",
					k8s.AlertRuleClassificationComponentKey: "kube-controller-manager",
					k8s.AlertRuleClassificationLayerKey:     "cluster",
				},
				State:    "firing",
				ActiveAt: time.Now(),
			},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family == nil || len(family.GetMetric()) != 1 {
		t.Fatalf("expected 1 metric, got family=%v", family)
	}
	m := family.GetMetric()[0]
	checks := map[string]string{
		k8s.AlertRuleLabelId:                    "abc123",
		k8s.AlertRuleClassificationComponentKey: "kube-controller-manager",
		k8s.AlertRuleClassificationLayerKey:     "cluster",
		"alertstate":                            "firing",
	}
	for k, want := range checks {
		if got := labelValue(m, k); got != want {
			t.Errorf("label[%s]: want %q, got %q", k, want, got)
		}
	}
}

func TestAlertsCollector_IncludesPendingAlerts(t *testing.T) {
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "Firing"}, State: "firing", ActiveAt: time.Now()},
			{Labels: map[string]string{"alertname": "Silenced"}, State: "silenced", ActiveAt: time.Now()},
			{Labels: map[string]string{"alertname": "Pending"}, State: "pending", ActiveAt: time.Now()},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family == nil || len(family.GetMetric()) != 3 {
		t.Fatalf("expected 3 metrics, got %v", family)
	}
	states := map[string]bool{}
	for _, m := range family.GetMetric() {
		states[labelValue(m, "alertstate")] = true
	}
	for _, s := range []string{"firing", "silenced", "pending"} {
		if !states[s] {
			t.Errorf("expected state %q in metrics", s)
		}
	}
}

func TestAlertsCollector_SourceAndBackendLabels(t *testing.T) {
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{
				Labels: map[string]string{
					"alertname":           "HighCPU",
					"severity":            "critical",
					k8s.AlertSourceLabel:  k8s.AlertSourcePlatform,
					k8s.AlertBackendLabel: k8s.AlertBackendAM,
				},
				State:    "firing",
				ActiveAt: time.Now(),
			},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family == nil || len(family.GetMetric()) != 1 {
		t.Fatalf("expected 1 metric")
	}
	m := family.GetMetric()[0]
	if got := labelValue(m, k8s.AlertSourceLabel); got != k8s.AlertSourcePlatform {
		t.Errorf("source: want %q, got %q", k8s.AlertSourcePlatform, got)
	}
	if got := labelValue(m, k8s.AlertBackendLabel); got != k8s.AlertBackendAM {
		t.Errorf("backend: want %q, got %q", k8s.AlertBackendAM, got)
	}
}

func TestAlertsCollector_FiltersThanosBackend(t *testing.T) {
	now := time.Now()
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "HighCPU", k8s.AlertBackendLabel: k8s.AlertBackendAM, k8s.AlertSourceLabel: k8s.AlertSourcePlatform}, State: "firing", ActiveAt: now},
			{Labels: map[string]string{"alertname": "HighCPU", k8s.AlertBackendLabel: k8s.AlertBackendThanos, k8s.AlertSourceLabel: k8s.AlertSourceUser}, State: "firing", ActiveAt: now},
			{Labels: map[string]string{"alertname": "PendingAlert", k8s.AlertBackendLabel: k8s.AlertBackendProm, k8s.AlertSourceLabel: k8s.AlertSourcePlatform}, State: "pending", ActiveAt: now},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family == nil || len(family.GetMetric()) != 2 {
		t.Fatalf("expected 2 metrics (thanos filtered), got %v", family)
	}
	for _, m := range family.GetMetric() {
		if labelValue(m, k8s.AlertBackendLabel) == k8s.AlertBackendThanos {
			t.Error("thanos duplicate should be filtered out")
		}
	}
}

func TestAlertsCollector_InjectsClassificationFromFields(t *testing.T) {
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{
				Labels:         map[string]string{"alertname": "TestAlert", k8s.AlertBackendLabel: k8s.AlertBackendAM},
				State:          "firing",
				ActiveAt:       time.Now(),
				AlertComponent: "networking",
				AlertLayer:     "cluster",
			},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family == nil || len(family.GetMetric()) != 1 {
		t.Fatalf("expected 1 metric")
	}
	m := family.GetMetric()[0]
	if got := labelValue(m, k8s.AlertRuleClassificationComponentKey); got != "networking" {
		t.Errorf("component: want networking, got %q", got)
	}
	if got := labelValue(m, k8s.AlertRuleClassificationLayerKey); got != "cluster" {
		t.Errorf("layer: want cluster, got %q", got)
	}
}

func TestAlertsCollector_DoesNotOverwriteARCLabels(t *testing.T) {
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{
				Labels: map[string]string{
					"alertname":                             "TestAlert",
					k8s.AlertBackendLabel:                   k8s.AlertBackendAM,
					k8s.AlertRuleClassificationComponentKey: "arc-component",
					k8s.AlertRuleClassificationLayerKey:     "namespace",
				},
				State:          "firing",
				ActiveAt:       time.Now(),
				AlertComponent: "default-component",
				AlertLayer:     "cluster",
			},
		},
	}
	collector, _ := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, metrics.MetricName)
	if family == nil || len(family.GetMetric()) != 1 {
		t.Fatalf("expected 1 metric")
	}
	m := family.GetMetric()[0]
	if got := labelValue(m, k8s.AlertRuleClassificationComponentKey); got != "arc-component" {
		t.Errorf("component: want arc-component, got %q", got)
	}
	if got := labelValue(m, k8s.AlertRuleClassificationLayerKey); got != "namespace" {
		t.Errorf("layer: want namespace, got %q", got)
	}
}
