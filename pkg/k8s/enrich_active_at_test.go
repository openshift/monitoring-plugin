package k8s

import (
	"testing"
	"time"
)

func TestEnrichActiveAt_ReplacesAlertmanagerTimestamp(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)
	promTime := time.Date(2026, 3, 9, 8, 0, 0, 0, time.UTC)

	amAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU", "severity": "critical", AlertSourceLabel: "platform", AlertBackendLabel: "am"},
		ActiveAt: amTime,
	}}
	promAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU", "severity": "critical", AlertSourceLabel: "platform", AlertBackendLabel: "prom"},
		ActiveAt: promTime,
	}}

	enrichActiveAt(amAlerts, promAlerts)

	if !amAlerts[0].ActiveAt.Equal(promTime) {
		t.Errorf("expected ActiveAt=%v, got %v", promTime, amAlerts[0].ActiveAt)
	}
}

func TestEnrichActiveAt_NoMatchKeepsOriginal(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)

	amAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU", "severity": "critical"},
		ActiveAt: amTime,
	}}
	promAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "DiskFull", "severity": "warning"},
		ActiveAt: time.Date(2026, 3, 9, 8, 0, 0, 0, time.UTC),
	}}

	enrichActiveAt(amAlerts, promAlerts)

	if !amAlerts[0].ActiveAt.Equal(amTime) {
		t.Errorf("expected ActiveAt to stay %v, got %v", amTime, amAlerts[0].ActiveAt)
	}
}

func TestEnrichActiveAt_EmptyPromAlerts(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)

	amAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU"},
		ActiveAt: amTime,
	}}

	enrichActiveAt(amAlerts, nil)

	if !amAlerts[0].ActiveAt.Equal(amTime) {
		t.Errorf("expected ActiveAt to stay %v, got %v", amTime, amAlerts[0].ActiveAt)
	}
}

func TestEnrichActiveAt_SkipsZeroPromActiveAt(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)

	amAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU"},
		ActiveAt: amTime,
	}}
	promAlerts := []PrometheusAlert{{
		Labels: map[string]string{"alertname": "HighCPU"},
	}}

	enrichActiveAt(amAlerts, promAlerts)

	if !amAlerts[0].ActiveAt.Equal(amTime) {
		t.Errorf("expected ActiveAt to stay %v when prom has zero time, got %v", amTime, amAlerts[0].ActiveAt)
	}
}

func TestAlertFingerprint_IgnoresMetadataLabels(t *testing.T) {
	fp1 := alertFingerprint(map[string]string{
		"alertname":       "HighCPU",
		"severity":        "critical",
		AlertSourceLabel:  "platform",
		AlertBackendLabel: "am",
	})
	fp2 := alertFingerprint(map[string]string{
		"alertname":       "HighCPU",
		"severity":        "critical",
		AlertSourceLabel:  "platform",
		AlertBackendLabel: "prom",
	})

	if fp1 != fp2 {
		t.Errorf("fingerprints should match when only metadata labels differ:\n  fp1=%q\n  fp2=%q", fp1, fp2)
	}
}

func TestAlertFingerprint_DifferentLabelsProduceDifferentKeys(t *testing.T) {
	fp1 := alertFingerprint(map[string]string{"alertname": "HighCPU", "severity": "critical"})
	fp2 := alertFingerprint(map[string]string{"alertname": "HighCPU", "severity": "warning"})

	if fp1 == fp2 {
		t.Error("fingerprints should differ when label values differ")
	}
}
