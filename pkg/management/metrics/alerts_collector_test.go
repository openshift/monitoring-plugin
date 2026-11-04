package metrics

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type mockAlertsFetcher struct {
	alerts []k8s.PrometheusAlert
	err    error
	fetch  func(context.Context, k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error)
}

func (m *mockAlertsFetcher) EnrichAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
	if m.fetch != nil {
		return m.fetch(ctx, req)
	}
	return m.alerts, nil, m.err
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

func newCollector(t *testing.T, mock *mockAlertsFetcher) prometheus.Collector {
	t.Helper()
	collector := NewAlertsCollector(mock, DefaultSyncInterval)
	collector.leading = true
	collector.term = 1
	collector.sync(context.Background())
	return collector
}

func TestAlertsCollector_InitialSync(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	collector := NewAlertsCollector(&mockAlertsFetcher{alerts: []k8s.PrometheusAlert{
		{Labels: map[string]string{"alertname": "InitialSync"}, State: "firing", ActiveAt: time.Now()},
	}}, time.Hour)
	collector.startLeading(ctx)
	require.Eventually(t, func() bool {
		return findFamily(collectMetrics(t, collector), MetricName) != nil
	}, 5*time.Second, 10*time.Millisecond)
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

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

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
			{Labels: map[string]string{"alertname": "TestAlert"}, Annotations: map[string]string{"summary": "test summary", "description": "test description", "runbook_url": "https://example.invalid/runbook"}, State: "firing", ActiveAt: time.Now()},
		},
	}

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

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

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

	if family != nil && len(family.GetMetric()) != 0 {
		t.Errorf("expected no metrics for zero ActiveAt, got %d", len(family.GetMetric()))
	}
}

func TestAlertsCollector_EmptyAlerts(t *testing.T) {
	mock := &mockAlertsFetcher{alerts: []k8s.PrometheusAlert{}}

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

	if family != nil && len(family.GetMetric()) != 0 {
		t.Errorf("expected no metrics for empty alerts, got %d", len(family.GetMetric()))
	}
}

func TestAlertsCollector_FetcherErrorProducesNoMetrics(t *testing.T) {
	mock := &mockAlertsFetcher{err: errors.New("connection refused")}

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

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

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

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

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

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

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

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

func TestAlertsCollector_RetainsThanosUserAlerts(t *testing.T) {
	now := time.Now()
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "HighCPU", k8s.AlertBackendLabel: k8s.AlertBackendAM, k8s.AlertSourceLabel: k8s.AlertSourcePlatform}, State: "firing", ActiveAt: now},
			{Labels: map[string]string{"alertname": "HighCPU", k8s.AlertBackendLabel: k8s.AlertBackendThanos, k8s.AlertSourceLabel: k8s.AlertSourceUser}, State: "firing", ActiveAt: now},
			{Labels: map[string]string{"alertname": "PendingAlert", k8s.AlertBackendLabel: k8s.AlertBackendProm, k8s.AlertSourceLabel: k8s.AlertSourcePlatform}, State: "pending", ActiveAt: now},
		},
	}

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

	if family == nil || len(family.GetMetric()) != 3 {
		t.Fatalf("expected all 3 alerts, including the Thanos-only user alert, got %v", family)
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

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

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

	collector := newCollector(t, mock)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

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

func TestAlertsCollector_FollowerExposesNoMetrics(t *testing.T) {
	mock := &mockAlertsFetcher{
		alerts: []k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "HighCPU"}, State: "firing", ActiveAt: time.Now()},
		},
	}
	collector := NewAlertsCollector(mock, time.Hour)
	families := collectMetrics(t, collector)
	family := findFamily(families, MetricName)

	if family != nil && len(family.GetMetric()) != 0 {
		t.Errorf("follower should expose no metrics, got %d", len(family.GetMetric()))
	}
}

func TestAlertsCollector_DeduplicatesEffectiveLabels(t *testing.T) {
	activeAt := time.Date(2026, 3, 5, 10, 0, 0, 0, time.UTC)
	mock := &mockAlertsFetcher{alerts: []k8s.PrometheusAlert{
		{Labels: map[string]string{"alertname": "SameAlert", "severity": "warning"}, State: "firing", ActiveAt: activeAt},
		{Labels: map[string]string{"alertname": "SameAlert", "severity": "warning"}, State: "firing", ActiveAt: activeAt.Add(-time.Hour)},
		{Labels: map[string]string{"alertname": "SameAlert", "severity": "critical"}, State: "firing", ActiveAt: activeAt},
		{Labels: map[string]string{"alertname": "SameAlert", "severity": "warning"}, State: "pending", ActiveAt: activeAt},
	}}
	collector := newCollector(t, mock)
	family := findFamily(collectMetrics(t, collector), MetricName)
	if family == nil || len(family.Metric) != 3 {
		t.Fatalf("want three distinct series, got %v", family)
	}
	for _, sample := range family.Metric {
		if labelValue(sample, "severity") == "warning" && labelValue(sample, "alertstate") == "firing" {
			if sample.GetGauge().GetValue() != float64(activeAt.Add(-time.Hour).Unix()) {
				t.Fatal("duplicate series did not retain earliest activeAt")
			}
		}
	}
}

func TestAlertsCollector_OverridesInputAlertStateLabel(t *testing.T) {
	mock := &mockAlertsFetcher{alerts: []k8s.PrometheusAlert{{
		Labels: map[string]string{"alertname": "StateLabel", "alertstate": "untrusted"},
		State:  "firing", ActiveAt: time.Now(),
	}}}
	collector := newCollector(t, mock)
	family := findFamily(collectMetrics(t, collector), MetricName)
	if family == nil || len(family.Metric) != 1 {
		t.Fatalf("want one valid series, got %v", family)
	}
	if labelValue(family.Metric[0], "alertstate") != "firing" {
		t.Fatal("alert state was not authoritative")
	}
}

func TestAlertsCollector_ExpiresFailedRefresh(t *testing.T) {
	mock := &mockAlertsFetcher{alerts: []k8s.PrometheusAlert{{Labels: map[string]string{"alertname": "ResolvedDuringOutage"}, State: "firing", ActiveAt: time.Now()}}}
	collector := newCollector(t, mock).(*AlertsCollector)
	lastSync := collector.snapshots[""].fetchedAt
	mock.err = errors.New("upstream unavailable")
	collector.sync(context.Background())
	require.Equal(t, lastSync, collector.snapshots[""].fetchedAt, "failed fetch must not extend freshness")
	require.NotNil(t, findFamily(collectMetrics(t, collector), MetricName), "fresh snapshots remain available")
	snapshot := collector.snapshots[""]
	snapshot.fetchedAt = time.Now().Add(-collector.syncInterval - time.Second)
	collector.snapshots[""] = snapshot
	require.Nil(t, findFamily(collectMetrics(t, collector), MetricName), "expired snapshots must disappear")
}

func TestAlertsCollector_ClearsSnapshotAcrossLeadershipTerms(t *testing.T) {
	mock := &mockAlertsFetcher{alerts: []k8s.PrometheusAlert{{Labels: map[string]string{"alertname": "PreviousTerm"}, State: "firing", ActiveAt: time.Now()}}}
	collector := newCollector(t, mock).(*AlertsCollector)
	collector.stopLeading()
	require.Empty(t, collector.snapshots)
	require.Nil(t, findFamily(collectMetrics(t, collector), MetricName))
	mock.err = errors.New("upstream unavailable on reacquisition")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	collector.startLeading(ctx)
	require.Nil(t, findFamily(collectMetrics(t, collector), MetricName), "reacquisition cannot expose the previous term")
}

func TestAlertsCollector_DiscardsFetchFromPreviousTerm(t *testing.T) {
	started, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	mock := &mockAlertsFetcher{fetch: func(context.Context, k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
		if calls.Add(1) == 1 {
			close(started)
			<-release
			return []k8s.PrometheusAlert{{Labels: map[string]string{"alertname": "OldTerm"}, State: "firing", ActiveAt: time.Now()}}, nil, nil
		}
		return nil, nil, errors.New("new term fetch failed")
	}}
	collector := NewAlertsCollector(mock, time.Hour)
	collector.leading, collector.term = true, 1
	go func() {
		defer close(done)
		collector.sync(context.Background())
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("fetch did not start")
	}
	collector.stopLeading()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	collector.startLeading(ctx)
	close(release)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("old fetch did not finish")
	}
	require.Nil(t, findFamily(collectMetrics(t, collector), MetricName))
}

func TestAlertsCollector_IgnoresCanceledLeadershipCallback(t *testing.T) {
	collector := NewAlertsCollector(&mockAlertsFetcher{}, time.Hour)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	collector.startLeading(ctx)
	require.False(t, collector.leading)
}

func TestAlertsCollector_DeduplicatesOverlappingBackends(t *testing.T) {
	activeAt := time.Now().Truncate(time.Second)
	for _, backends := range [][]string{
		{k8s.AlertBackendThanos, k8s.AlertBackendAM, k8s.AlertBackendProm},
		{k8s.AlertBackendAM, k8s.AlertBackendProm, k8s.AlertBackendThanos},
	} {
		mock := &mockAlertsFetcher{}
		for i, backend := range backends {
			mock.alerts = append(mock.alerts, k8s.PrometheusAlert{
				Labels: map[string]string{"alertname": "SameUserAlert", k8s.AlertSourceLabel: k8s.AlertSourceUser, k8s.AlertBackendLabel: backend},
				State:  "firing", ActiveAt: activeAt.Add(-time.Duration(i) * time.Minute),
			})
		}
		family := findFamily(collectMetrics(t, newCollector(t, mock)), MetricName)
		require.NotNil(t, family)
		require.Len(t, family.Metric, 1)
		require.Equal(t, k8s.AlertBackendAM, labelValue(family.Metric[0], k8s.AlertBackendLabel))
		require.Equal(t, float64(activeAt.Add(-2*time.Minute).Unix()), family.Metric[0].GetGauge().GetValue())
	}
}

func TestAlertsCollector_RequestsAndExposesDroppedAlerts(t *testing.T) {
	activeAt := time.Now().Add(-time.Hour).Truncate(time.Second)
	mock := &mockAlertsFetcher{fetch: func(_ context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
		require.True(t, req.IncludeDropped)
		return []k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "SameIdentity"}, State: "firing", ActiveAt: activeAt},
			{Labels: map[string]string{"alertname": "SameIdentity"}, State: "firing", ActiveAt: activeAt, Dropped: true},
			{Labels: map[string]string{"alertname": "SameIdentity"}, State: "firing", ActiveAt: activeAt.Add(-30 * time.Second), Dropped: true},
			{Labels: map[string]string{"alertname": "PendingDrop"}, State: "pending", ActiveAt: activeAt.Add(-time.Minute), Dropped: true},
			{Labels: map[string]string{"alertname": "SilencedDrop"}, State: "silenced", ActiveAt: activeAt, Dropped: true},
			{Labels: map[string]string{"alertname": "NoTimestamp"}, State: "firing", Dropped: true},
		}, nil, nil
	}}
	families := collectMetrics(t, newCollector(t, mock))
	effective := findFamily(families, MetricName)
	require.NotNil(t, effective)
	require.Len(t, effective.Metric, 1, "dropped instances must not enter the effective family")
	require.Equal(t, "SameIdentity", labelValue(effective.Metric[0], "alertname"))
	require.Equal(t, float64(activeAt.Unix()), effective.Metric[0].GetGauge().GetValue())
	dropped := findFamily(families, DroppedMetricName)
	require.NotNil(t, dropped)
	require.Len(t, dropped.Metric, 2)
	for _, metric := range dropped.Metric {
		switch labelValue(metric, "alertname") {
		case "SameIdentity":
			require.Equal(t, "firing", labelValue(metric, "alertstate"))
			require.Equal(t, float64(activeAt.Add(-30*time.Second).Unix()), metric.GetGauge().GetValue())
		case "PendingDrop":
			require.Equal(t, "pending", labelValue(metric, "alertstate"))
			require.Equal(t, float64(activeAt.Add(-time.Minute).Unix()), metric.GetGauge().GetValue())
		default:
			t.Fatalf("unexpected dropped series: %s", metric)
		}
	}
}

func TestAlertsCollector_TransitionsBetweenMetricFamilies(t *testing.T) {
	activeAt := time.Now().Add(-time.Hour).Truncate(time.Second)
	mock := &mockAlertsFetcher{alerts: []k8s.PrometheusAlert{{Labels: map[string]string{"alertname": "Transitions"}, State: "pending", ActiveAt: activeAt}}}
	collector := newCollector(t, mock).(*AlertsCollector)
	for _, dropped := range []bool{false, true, false} {
		mock.alerts[0].Dropped = dropped
		collector.sync(context.Background())
		families := collectMetrics(t, collector)
		present, absent := MetricName, DroppedMetricName
		if dropped {
			present, absent = absent, present
		}
		family := findFamily(families, present)
		require.NotNil(t, family)
		require.Len(t, family.Metric, 1)
		require.Equal(t, "pending", labelValue(family.Metric[0], "alertstate"))
		require.Equal(t, float64(activeAt.Unix()), family.Metric[0].GetGauge().GetValue())
		require.Nil(t, findFamily(families, absent))
	}
	mock.alerts[0].Dropped = true
	collector.sync(context.Background())
	snapshot := collector.snapshots[""]
	snapshot.fetchedAt = time.Now().Add(-collector.syncInterval - time.Second)
	collector.snapshots[""] = snapshot
	require.Empty(t, collectMetrics(t, collector), "expired dropped snapshots must disappear")
	collector.sync(context.Background())
	collector.stopLeading()
	require.Empty(t, collectMetrics(t, collector), "followers expose neither family")
}
