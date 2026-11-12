package metrics

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func TestCleanupMetricsSurviveLeaderElectionInitializationFailure(t *testing.T) {
	for _, tc := range []struct {
		name   string
		config *rest.Config
	}{
		{name: "missing configuration"},
		{name: "invalid configuration", config: &rest.Config{Host: "://invalid"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			registry := prometheus.NewRegistry()
			require.Error(t, Register(context.Background(), registry, nil, tc.config))
			families, err := registry.Gather()
			require.NoError(t, err)
			for _, name := range []string{
				k8s.MetricAlertRelabelConfigGCListTotal,
				k8s.MetricAlertRelabelConfigGCListErrorsTotal,
				k8s.MetricAlertRelabelConfigGCDeleteTotal,
				k8s.MetricAlertRelabelConfigGCDeleteErrorsTotal,
				k8s.MetricAlertRelabelConfigGitOpsOrphans,
			} {
				require.NotNil(t, findFamily(families, name))
			}
			require.Nil(t, findFamily(families, MetricName))
		})
	}
}

func TestCollectorPreservesOnlyFreshUnavailableSources(t *testing.T) {
	now := time.Now()
	activeAt := now.Add(-time.Hour)
	partial := false
	platformName := "PlatformBeforeOutage"
	mock := &mockAlertsFetcher{fetch: func(_ context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
		alerts := []k8s.PrometheusAlert{{Labels: map[string]string{"alertname": platformName, k8s.AlertSourceLabel: k8s.AlertSourcePlatform}, State: "firing", ActiveAt: activeAt}}
		if partial {
			req.FetchStatus.UserUnavailable = true
			return alerts, []string{"user workload unavailable"}, nil
		}
		alerts = append(alerts, k8s.PrometheusAlert{Labels: map[string]string{"alertname": "UserAlert", k8s.AlertSourceLabel: k8s.AlertSourceUser}, State: "firing", ActiveAt: activeAt})
		return alerts, nil, nil
	}}
	collector := NewAlertsCollector(mock, DefaultSyncInterval)
	collector.now = func() time.Time { return now }
	collector.leading, collector.term = true, 1
	collector.sync(context.Background())
	userFetchedAt := collector.snapshots[k8s.AlertSourceUser].fetchedAt
	partial, platformName = true, "PlatformDuringOutage"
	now = now.Add(DefaultSyncInterval / 2)
	collector.sync(context.Background())
	family := findFamily(collectMetrics(t, collector), MetricName)
	require.NotNil(t, family)
	require.Len(t, family.Metric, 2)
	for _, metric := range family.Metric {
		require.NotEqual(t, "PlatformBeforeOutage", labelValue(metric, "alertname"), "healthy platform data must refresh during user-workload outages")
	}
	require.Equal(t, userFetchedAt, collector.snapshots[k8s.AlertSourceUser].fetchedAt)
	now = now.Add(DefaultSyncInterval)
	collector.sync(context.Background())
	family = findFamily(collectMetrics(t, collector), MetricName)
	require.NotNil(t, family)
	require.Len(t, family.Metric, 1, "cached user-workload data expires despite successful platform refreshes")
	require.Equal(t, "PlatformDuringOutage", labelValue(family.Metric[0], "alertname"))
	partial = false
	collector.sync(context.Background())
	family = findFamily(collectMetrics(t, collector), MetricName)
	require.Len(t, family.Metric, 2, "user-workload metrics resume after recovery")
	mock.alerts = nil
	mock.fetch = nil
	collector.sync(context.Background())
	require.Empty(t, collectMetrics(t, collector), "a successful empty result clears both sources")
}

func TestCollectorExpiresFromFetchStart(t *testing.T) {
	now := time.Now()
	started := now
	mock := &mockAlertsFetcher{fetch: func(context.Context, k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
		now = now.Add(DefaultSyncInterval + time.Second)
		return []k8s.PrometheusAlert{{Labels: map[string]string{"alertname": "SlowFetch"}, State: "firing", ActiveAt: started.Add(-time.Hour)}}, nil, nil
	}}
	collector := NewAlertsCollector(mock, DefaultSyncInterval)
	collector.now = func() time.Time { return now }
	collector.leading, collector.term = true, 1
	collector.sync(context.Background())
	require.Empty(t, collectMetrics(t, collector), "slow fetches cannot extend snapshot freshness")
	require.Equal(t, started, collector.snapshots[""].fetchedAt)
}
