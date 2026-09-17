package e2e

import "testing"

func TestMetricSampleValueGaugePositive(t *testing.T) {
	body := `# HELP monitoring_plugin_alert_relabel_config_gitops_orphans GitOps orphans
# TYPE monitoring_plugin_alert_relabel_config_gitops_orphans gauge
monitoring_plugin_alert_relabel_config_gitops_orphans 2
`
	got, err := metricSampleValue(body, "monitoring_plugin_alert_relabel_config_gitops_orphans")
	if err != nil {
		t.Fatalf("metricSampleValue: %v", err)
	}
	if got != 2 {
		t.Fatalf("got %v, want 2", got)
	}
}

func TestMetricSampleValueZeroIsFound(t *testing.T) {
	body := `# TYPE monitoring_plugin_alert_relabel_config_gitops_orphans gauge
monitoring_plugin_alert_relabel_config_gitops_orphans 0
`
	got, err := metricSampleValue(body, "monitoring_plugin_alert_relabel_config_gitops_orphans")
	if err != nil {
		t.Fatalf("metricSampleValue: %v", err)
	}
	if got != 0 {
		t.Fatalf("got %v, want 0", got)
	}
}

func TestMetricSampleValueMissing(t *testing.T) {
	body := `# TYPE other_metric gauge
other_metric 1
`
	_, err := metricSampleValue(body, "monitoring_plugin_alert_relabel_config_gitops_orphans")
	if err == nil {
		t.Fatal("expected error for missing metric")
	}
}
