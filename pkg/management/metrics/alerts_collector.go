package metrics

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/rest"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

var metricsLog = logrus.WithField("module", "metrics")

const (
	MetricName = "alerts_effective_active_at_timestamp_seconds"
	metricHelp = "The activeAt timestamp of effective alerts that survive ARC relabeling. " +
		"Value is the Unix timestamp when the alert became active."
	DroppedMetricName = "alerts_dropped_active_at_timestamp_seconds"
	droppedMetricHelp = "The activeAt timestamp of active or pending alerts rejected by ARC relabeling. " +
		"Value is the Unix timestamp when the alert became active."

	DefaultSyncInterval = 30 * time.Second

	labelAlertState = "alertstate"
)

// AlertsFetcher retrieves enriched alerts for both metrics. The management.Client
// satisfies this interface — it applies ARC relabeling and computes
// classification (AlertComponent / AlertLayer) on every alert.
type AlertsFetcher interface {
	EnrichAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error)
}

// alertMetric holds a single alert's pre-built metric data.
// The prometheus.Desc is created once during sync, not on every scrape.
type alertMetric struct {
	desc            *prometheus.Desc
	labelValues     []string
	activeAtSec     float64
	backendPriority int
	source          string
}

type alertSnapshot struct {
	metrics   []alertMetric
	fetchedAt time.Time
}

// AlertsCollector implements prometheus.Collector. It periodically fetches
// alerts via the management client's EnrichAlerts (which applies ARC relabeling
// and computes classification) and exposes them as the
// alerts_effective_active_at_timestamp_seconds gauge. ARC-rejected instances
// use alerts_dropped_active_at_timestamp_seconds, retaining their pending or
// firing state and original activation timestamp.
//
// Only the leader pod (determined via Lease-based leader election) runs the
// sync loop and exposes metrics. Follower pods return nothing on Collect,
// ensuring each alert appears exactly once in Prometheus.
//
// Each alert produces one time series whose value is the alert's activeAt
// Unix timestamp. Labels are the alert's enriched labels (post-ARC, source,
// backend, component, layer) plus "alertstate". Overlapping backends are
// deduplicated within each family by labels and state. Annotations are excluded
// because they are available from the alert rule definition.
type AlertsCollector struct {
	fetcher      AlertsFetcher
	syncInterval time.Duration
	now          func() time.Time

	mu        sync.RWMutex
	snapshots map[string]alertSnapshot
	leading   bool
	term      uint64

	sentinelDescs []*prometheus.Desc
}

// Register adds cleanup metrics and a leader-elected alert collector
// to the server's registry when alert management is enabled.
func Register(ctx context.Context, registry *prometheus.Registry, fetcher AlertsFetcher, kubeConfig *rest.Config) error {
	k8s.RegisterAlertRelabelConfigGCMetrics(registry)
	if kubeConfig == nil {
		return fmt.Errorf("metrics leader election requires Kubernetes configuration")
	}
	collector := NewAlertsCollector(fetcher, DefaultSyncInterval)
	if err := startLeaderElection(ctx, kubeConfig, k8s.ClusterMonitoringNamespace, collector.startLeading, collector.stopLeading); err != nil {
		return fmt.Errorf("start metrics leader election: %w", err)
	}
	registry.MustRegister(collector)
	return nil
}

// NewAlertsCollector creates a collector. Leader election starts and stops its
// sync loop; followers expose no alert samples from either family.
func NewAlertsCollector(fetcher AlertsFetcher, syncInterval time.Duration) *AlertsCollector {
	return &AlertsCollector{
		fetcher:      fetcher,
		syncInterval: syncInterval,
		now:          time.Now,
		sentinelDescs: []*prometheus.Desc{
			prometheus.NewDesc(MetricName, metricHelp, nil, nil),
			prometheus.NewDesc(DroppedMetricName, droppedMetricHelp, nil, nil),
		},
	}
}

func (c *AlertsCollector) startLeading(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if ctx.Err() != nil {
		return
	}
	c.term++
	c.leading = true
	c.snapshots = nil
	metricsLog.Info("became leader for alert management metrics")
	go c.syncLoop(ctx)
}

func (c *AlertsCollector) stopLeading() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.term++
	c.leading = false
	c.snapshots = nil
	metricsLog.Info("lost leadership for alert management metrics")
}

// Describe sends a sentinel descriptor for each metric family.
func (c *AlertsCollector) Describe(ch chan<- *prometheus.Desc) {
	for _, desc := range c.sentinelDescs {
		ch <- desc
	}
}

// Collect emits the current set of alert metrics using pre-built Descs.
// Returns nothing if this replica is not the leader.
func (c *AlertsCollector) Collect(ch chan<- prometheus.Metric) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if !c.leading {
		return
	}

	now := c.now()
	for _, snapshot := range c.snapshots {
		// Each source expires independently from the start of its fetch. A
		// partial result cannot refresh the unavailable source's old samples.
		if now.Sub(snapshot.fetchedAt) > c.syncInterval {
			continue
		}
		for _, m := range snapshot.metrics {
			metric, err := prometheus.NewConstMetric(m.desc, prometheus.GaugeValue, m.activeAtSec, m.labelValues...)
			if err != nil {
				metricsLog.WithError(err).Warn("failed to create metric")
				continue
			}
			ch <- metric
		}
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
	c.mu.RLock()
	term, leading := c.term, c.leading
	c.mu.RUnlock()
	if !leading || ctx.Err() != nil {
		return
	}

	fetchStarted := c.now()
	var status k8s.AlertFetchStatus
	alerts, _, err := c.fetcher.EnrichAlerts(ctx, k8s.GetAlertsRequest{IncludeDropped: true, FetchStatus: &status})
	if err != nil {
		metricsLog.WithError(err).Warn("failed to fetch alerts for metrics")
		return
	}

	built := make([]alertMetric, 0, len(alerts))
	seen := make(map[string]int, len(alerts))
	for i := range alerts {
		alert := &alerts[i]

		enrichClassificationLabels(alert)

		m := buildAlertMetric(alert)
		if m != nil {
			identity := labels.NewBuilder(labels.FromMap(alert.Labels))
			identity.Del(k8s.AlertBackendLabel)
			identity.Set(labelAlertState, alert.State)
			key := fmt.Sprintf("%t:%s", alert.Dropped, identity.Labels().String())
			if index, exists := seen[key]; exists {
				earliest := min(m.activeAtSec, built[index].activeAtSec)
				if m.backendPriority > built[index].backendPriority {
					built[index] = *m
				}
				built[index].activeAtSec = earliest
				continue
			}
			seen[key] = len(built)
			built = append(built, *m)
		}
	}

	unavailable := map[string]bool{
		k8s.AlertSourcePlatform: status.PlatformUnavailable,
		k8s.AlertSourceUser:     status.UserUnavailable,
	}
	next := make(map[string]alertSnapshot)
	for _, metric := range built {
		source := metric.source
		if !unavailable[source] {
			snapshot := next[source]
			snapshot.fetchedAt = fetchStarted
			snapshot.metrics = append(snapshot.metrics, metric)
			next[source] = snapshot
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.leading || c.term != term || ctx.Err() != nil {
		return
	}
	for source, snapshot := range c.snapshots {
		if unavailable[source] {
			next[source] = snapshot
		}
	}
	c.snapshots = next

	metricsLog.Debugf("synced %d alerts for metrics", len(built))
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
	name, help := MetricName, metricHelp
	if alert.Dropped {
		if alert.State != "pending" && alert.State != "firing" {
			return nil
		}
		name, help = DroppedMetricName, droppedMetricHelp
	}

	labelNames := make([]string, 0, len(alert.Labels)+1)
	for k := range alert.Labels {
		if k != labelAlertState {
			labelNames = append(labelNames, k)
		}
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
		desc:            prometheus.NewDesc(name, help, labelNames, nil),
		labelValues:     labelValues,
		activeAtSec:     float64(alert.ActiveAt.Unix()),
		backendPriority: alertBackendPriority(alert.Labels[k8s.AlertBackendLabel]),
		source:          alert.Labels[k8s.AlertSourceLabel],
	}
}

// Prefer Alertmanager's delivery labels and state when sources overlap, while
// retaining alerts that are available only from Prometheus or Thanos tenancy.
func alertBackendPriority(backend string) int {
	switch backend {
	case k8s.AlertBackendAM:
		return 3
	case k8s.AlertBackendProm:
		return 2
	case k8s.AlertBackendThanos:
		return 1
	default:
		return 0
	}
}
