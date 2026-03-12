package metrics

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"k8s.io/client-go/rest"
)

var metricsLog = logrus.WithField("module", "metrics")

const (
	MetricName = "alerts_effective_active_at_timestamp_seconds"
	metricHelp = "The activeAt timestamp of effective (post-ARC) alerts. " +
		"Value is the Unix timestamp when the alert became active."

	DefaultSyncInterval = 30 * time.Second

	labelAlertState = "alertstate"
)

// AlertsFetcher retrieves enriched alerts for the metric. The management.Client
// satisfies this interface — it applies ARC relabeling and computes
// classification (AlertComponent / AlertLayer) on every alert.
type AlertsFetcher interface {
	GetAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error)
}

// alertMetric holds a single alert's pre-built metric data.
// The prometheus.Desc is created once during sync, not on every scrape.
type alertMetric struct {
	desc        *prometheus.Desc
	labelValues []string
	activeAtSec float64
}

// AlertsCollector implements prometheus.Collector. It periodically fetches
// alerts via the management client's GetAlerts (which applies ARC relabeling
// and computes classification) and exposes them as the
// alerts_effective_active_at_timestamp_seconds gauge.
//
// Only the leader pod (determined via Lease-based leader election) runs the
// sync loop and exposes metrics. Follower pods return nothing on Collect,
// ensuring each alert appears exactly once in Prometheus.
//
// Each alert produces one time series whose value is the alert's activeAt
// Unix timestamp. Labels are the alert's enriched labels (post-ARC, source,
// backend, component, layer) plus "alertstate". Thanos-sourced alerts are
// filtered out to avoid duplicates. Annotations are excluded because they
// are available from the alert rule definition.
type AlertsCollector struct {
	fetcher      AlertsFetcher
	syncInterval time.Duration
	isLeader     func() bool

	mu      sync.RWMutex
	metrics []alertMetric

	sentinelDesc *prometheus.Desc
}

// NewHandler creates a metrics HTTP handler that exposes the alerts effective
// metric. It sets up Lease-based leader election internally so that only one
// replica produces metrics, then wires the collector, registry and promhttp
// handler. Callers receive a ready-to-use http.Handler.
func NewHandler(ctx context.Context, fetcher AlertsFetcher, kubeConfig *rest.Config) (http.Handler, error) {
	isLeader, err := startLeaderElection(ctx, kubeConfig, k8s.ClusterMonitoringNamespace)
	if err != nil {
		return nil, fmt.Errorf("start metrics leader election: %w", err)
	}

	collector := NewAlertsCollector(ctx, fetcher, DefaultSyncInterval, isLeader)
	registry := prometheus.NewRegistry()
	registry.MustRegister(collector)
	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{}), nil
}

// NewAlertsCollector creates a collector that periodically syncs alerts and
// exposes them as Prometheus metrics. The isLeader callback controls whether
// this replica actively syncs and exposes metrics (follower pods return nothing).
func NewAlertsCollector(ctx context.Context, fetcher AlertsFetcher, syncInterval time.Duration, isLeader func() bool) *AlertsCollector {
	c := &AlertsCollector{
		fetcher:      fetcher,
		syncInterval: syncInterval,
		isLeader:     isLeader,
		sentinelDesc: prometheus.NewDesc(MetricName, metricHelp, nil, nil),
	}
	go c.syncLoop(ctx)
	return c
}

// Describe sends a sentinel descriptor to satisfy the Collector contract.
func (c *AlertsCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.sentinelDesc
}

// Collect emits the current set of alert metrics using pre-built Descs.
// Returns nothing if this replica is not the leader.
func (c *AlertsCollector) Collect(ch chan<- prometheus.Metric) {
	if !c.isLeader() {
		return
	}

	c.mu.RLock()
	defer c.mu.RUnlock()

	for i := range c.metrics {
		m := &c.metrics[i]
		metric, err := prometheus.NewConstMetric(m.desc, prometheus.GaugeValue, m.activeAtSec, m.labelValues...)
		if err != nil {
			metricsLog.WithError(err).Warn("failed to create metric")
			continue
		}
		ch <- metric
	}
}

func (c *AlertsCollector) syncLoop(ctx context.Context) {
	c.sync(ctx)

	ticker := time.NewTicker(c.syncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.sync(ctx)
		}
	}
}

func (c *AlertsCollector) sync(ctx context.Context) {
	if !c.isLeader() {
		return
	}

	alerts, err := c.fetcher.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		metricsLog.WithError(err).Warn("failed to fetch alerts for effective metric")
		return
	}

	built := make([]alertMetric, 0, len(alerts))
	for i := range alerts {
		alert := &alerts[i]

		// Drop Thanos-sourced alerts: they duplicate what Alertmanager and
		// Prometheus already provide and would inflate the metric cardinality.
		if alert.Labels[k8s.AlertBackendLabel] == k8s.AlertBackendThanos {
			continue
		}

		enrichClassificationLabels(alert)

		m := buildAlertMetric(alert)
		if m != nil {
			built = append(built, *m)
		}
	}

	c.mu.Lock()
	c.metrics = built
	c.mu.Unlock()

	metricsLog.Debugf("synced %d alerts for effective metric", len(built))
}

// enrichClassificationLabels copies the management-computed AlertComponent and
// AlertLayer into the alert's Labels map so they appear on the metric. Labels
// already set (e.g. via ARC) take precedence.
func enrichClassificationLabels(alert *k8s.PrometheusAlert) {
	if alert.AlertComponent != "" {
		if _, exists := alert.Labels[k8s.AlertRuleClassificationComponentKey]; !exists {
			alert.Labels[k8s.AlertRuleClassificationComponentKey] = alert.AlertComponent
		}
	}
	if alert.AlertLayer != "" {
		if _, exists := alert.Labels[k8s.AlertRuleClassificationLayerKey]; !exists {
			alert.Labels[k8s.AlertRuleClassificationLayerKey] = alert.AlertLayer
		}
	}
}

// buildAlertMetric converts a PrometheusAlert into an alertMetric with a
// pre-built prometheus.Desc. Uses the alert's labels plus the alertstate label.
func buildAlertMetric(alert *k8s.PrometheusAlert) *alertMetric {
	if alert.ActiveAt.IsZero() {
		return nil
	}

	labelNames := make([]string, 0, len(alert.Labels)+1)
	for k := range alert.Labels {
		labelNames = append(labelNames, k)
	}
	sort.Strings(labelNames)
	labelNames = append(labelNames, labelAlertState)

	labelValues := make([]string, 0, len(labelNames))
	for _, name := range labelNames {
		if name == labelAlertState {
			labelValues = append(labelValues, alert.State)
		} else {
			labelValues = append(labelValues, alert.Labels[name])
		}
	}

	return &alertMetric{
		desc:        prometheus.NewDesc(MetricName, metricHelp, labelNames, nil),
		labelValues: labelValues,
		activeAtSec: float64(alert.ActiveAt.Unix()),
	}
}
