package k8s

import (
	"github.com/prometheus/client_golang/prometheus"
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

var defaultAlertRelabelConfigGCMetrics = newAlertRelabelConfigGCMetrics()

// RegisterAlertRelabelConfigGCMetrics registers cleanup counters and the
// GitOps-orphan gauge with the server's metrics registry.
func RegisterAlertRelabelConfigGCMetrics(reg prometheus.Registerer) {
	m := defaultAlertRelabelConfigGCMetrics
	reg.MustRegister(m.listErrors, m.deleteErrors, m.gitopsOrphans)
}
