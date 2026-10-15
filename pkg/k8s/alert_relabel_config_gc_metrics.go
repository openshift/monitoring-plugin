package k8s

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	MetricAlertRelabelConfigGCListErrorsTotal   = "monitoring_plugin_alert_relabel_config_gc_list_errors_total"
	MetricAlertRelabelConfigGCDeleteErrorsTotal = "monitoring_plugin_alert_relabel_config_gc_delete_errors_total"
	MetricAlertRelabelConfigGitOpsOrphans       = "monitoring_plugin_alert_relabel_config_gitops_orphans"
)

type alertRelabelConfigGCMetrics struct {
	listErrors    prometheus.Counter
	deleteErrors  prometheus.Counter
	gitopsOrphans prometheus.Gauge
}

func newAlertRelabelConfigGCMetrics() *alertRelabelConfigGCMetrics {
	return &alertRelabelConfigGCMetrics{
		listErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Name: MetricAlertRelabelConfigGCListErrorsTotal,
			Help: "Count of failed List calls while cleaning up orphaned AlertRelabelConfigs.",
		}),
		deleteErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Name: MetricAlertRelabelConfigGCDeleteErrorsTotal,
			Help: "Count of failed Delete calls while cleaning up orphaned AlertRelabelConfigs.",
		}),
		gitopsOrphans: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: MetricAlertRelabelConfigGitOpsOrphans,
			Help: "Number of GitOps-managed AlertRelabelConfigs that are orphaned and were not deleted.",
		}),
	}
}

func (m *alertRelabelConfigGCMetrics) mustRegister(reg prometheus.Registerer) {
	reg.MustRegister(m.listErrors, m.deleteErrors, m.gitopsOrphans)
}

func (m *alertRelabelConfigGCMetrics) observeListError() {
	if m == nil {
		return
	}
	m.listErrors.Inc()
}

func (m *alertRelabelConfigGCMetrics) observeDeleteError() {
	if m == nil {
		return
	}
	m.deleteErrors.Inc()
}

func (m *alertRelabelConfigGCMetrics) setGitOpsOrphans(n float64) {
	if m == nil {
		return
	}
	m.gitopsOrphans.Set(n)
}

var (
	alertRelabelConfigGCMetricsRegistry = prometheus.NewRegistry()
	defaultAlertRelabelConfigGCMetrics  = newAlertRelabelConfigGCMetrics()
)

func init() {
	defaultAlertRelabelConfigGCMetrics.mustRegister(alertRelabelConfigGCMetricsRegistry)
}

// AlertRelabelConfigGCMetricsRegistry is the registry served at /metrics
// when alert-management-api is enabled. Additional collectors should
// register here so a single scrape endpoint exposes all series.
func AlertRelabelConfigGCMetricsRegistry() *prometheus.Registry {
	return alertRelabelConfigGCMetricsRegistry
}

// AlertRelabelConfigGCMetricsHandler serves the GC metrics registry.
func AlertRelabelConfigGCMetricsHandler() http.Handler {
	return promhttp.HandlerFor(alertRelabelConfigGCMetricsRegistry, promhttp.HandlerOpts{})
}

// EmptyMetricsHandler serves an empty Prometheus registry so /metrics
// still returns 200 when alert-management-api is off.
func EmptyMetricsHandler() http.Handler {
	return promhttp.HandlerFor(prometheus.NewRegistry(), promhttp.HandlerOpts{})
}
