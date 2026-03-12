package e2e

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/metrics"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func fetchMetrics(f *framework.Framework) (string, error) {
	resp, err := f.HTTPClient().Get(f.PluginURL + "/metrics")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func parseMetricLines(body string) []string {
	var lines []string
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, metrics.MetricName+"{") {
			lines = append(lines, line)
		}
	}
	return lines
}

func extractLabel(metricLine, labelName string) string {
	key := labelName + `="`
	idx := strings.Index(metricLine, key)
	if idx < 0 {
		return ""
	}
	start := idx + len(key)
	end := strings.Index(metricLine[start:], `"`)
	if end < 0 {
		return ""
	}
	return metricLine[start : start+end]
}

// TestMetricEndpointExposesEffectiveMetric
// Verifies that the /metrics endpoint exposes alerts_effective_active_at_timestamp_seconds.
func TestMetricEndpointExposesEffectiveMetric(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	var metricBody string

	err = wait.PollUntilContextTimeout(ctx, 5*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		body, err := fetchMetrics(f)
		if err != nil {
			t.Logf("Failed to fetch metrics: %v", err)
			return false, nil
		}

		if !strings.Contains(body, metrics.MetricName) {
			t.Logf("Metric %s not found yet (leader election may be in progress)", metrics.MetricName)
			return false, nil
		}

		metricBody = body
		return true, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for metric to appear: %v", err)
	}

	if !strings.Contains(metricBody, "# HELP "+metrics.MetricName) {
		t.Error("Missing HELP line for metric")
	}
	if !strings.Contains(metricBody, "# TYPE "+metrics.MetricName+" gauge") {
		t.Error("Missing or incorrect TYPE line for metric (expected gauge)")
	}

	lines := parseMetricLines(metricBody)
	if len(lines) == 0 {
		t.Fatal("Expected at least one metric series, got none")
	}

	t.Logf("Found %d metric series for %s", len(lines), metrics.MetricName)
}

// TestMetricSeriesHaveRequiredLabels
// Verifies every metric series has alertname, alertstate, openshift_io_alert_source,
// openshift_io_alert_backend, and a valid timestamp value.
func TestMetricSeriesHaveRequiredLabels(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	var lines []string

	err = wait.PollUntilContextTimeout(ctx, 5*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		body, err := fetchMetrics(f)
		if err != nil {
			t.Logf("Failed to fetch metrics: %v", err)
			return false, nil
		}
		lines = parseMetricLines(body)
		return len(lines) > 0, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for metric series: %v", err)
	}

	requiredLabels := []string{
		"alertname",
		"alertstate",
		k8s.AlertSourceLabel,
		k8s.AlertBackendLabel,
	}

	for i, line := range lines {
		for _, label := range requiredLabels {
			val := extractLabel(line, label)
			if val == "" {
				t.Errorf("Series %d missing required label %q: %s", i, label, line)
			}
		}

		state := extractLabel(line, "alertstate")
		validStates := map[string]bool{"firing": true, "pending": true, "silenced": true, "suppressed": true}
		if !validStates[state] {
			t.Errorf("Series %d has unexpected alertstate=%q: %s", i, state, line)
		}

		parts := strings.Split(line, " ")
		if len(parts) < 2 {
			t.Errorf("Series %d has no value: %s", i, line)
			continue
		}
		var ts float64
		if _, err := fmt.Sscanf(parts[len(parts)-1], "%g", &ts); err != nil {
			t.Errorf("Series %d has unparseable value %q: %v", i, parts[len(parts)-1], err)
			continue
		}
		if ts < 9.46e+08 {
			t.Errorf("Series %d has suspiciously low timestamp value: %g (before year 2000)", i, ts)
		}
	}

	t.Logf("All %d series have required labels and valid values", len(lines))
}

// TestMetricIncludesClassificationLabels
// Verifies that all metric series have classification labels
// (openshift_io_alert_rule_component and openshift_io_alert_rule_layer).
func TestMetricIncludesClassificationLabels(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	var lines []string

	err = wait.PollUntilContextTimeout(ctx, 5*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		body, err := fetchMetrics(f)
		if err != nil {
			return false, nil
		}
		lines = parseMetricLines(body)
		return len(lines) > 0, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for metric series: %v", err)
	}

	for i, line := range lines {
		if extractLabel(line, k8s.AlertRuleClassificationComponentKey) == "" {
			t.Errorf("Series %d missing %s label: %s", i, k8s.AlertRuleClassificationComponentKey, line)
		}
		if extractLabel(line, k8s.AlertRuleClassificationLayerKey) == "" {
			t.Errorf("Series %d missing %s label: %s", i, k8s.AlertRuleClassificationLayerKey, line)
		}
	}

	t.Logf("All %d series have classification labels (component + layer)", len(lines))
}

// TestMetricExcludesAnnotations
// Verifies that annotations (summary, description, runbook_url) are not
// included as metric labels.
func TestMetricExcludesAnnotations(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	var lines []string

	err = wait.PollUntilContextTimeout(ctx, 5*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		body, err := fetchMetrics(f)
		if err != nil {
			return false, nil
		}
		lines = parseMetricLines(body)
		return len(lines) > 0, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for metric series: %v", err)
	}

	annotationLabels := []string{"summary", "description", "runbook_url"}

	for i, line := range lines {
		for _, annLabel := range annotationLabels {
			if extractLabel(line, annLabel) != "" {
				t.Errorf("Series %d contains annotation label %q (annotations should be excluded): %s",
					i, annLabel, line)
			}
		}
	}

	t.Logf("Verified %d series - none contain annotation labels", len(lines))
}

// TestMetricActiveAtTimestampsAreReasonable
// Verifies that activeAt timestamps are not too recent.
func TestMetricActiveAtTimestampsAreReasonable(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	var lines []string

	err = wait.PollUntilContextTimeout(ctx, 5*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		body, err := fetchMetrics(f)
		if err != nil {
			return false, nil
		}
		lines = parseMetricLines(body)
		return len(lines) > 0, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for metric series: %v", err)
	}

	now := float64(time.Now().Unix())
	fiveMinutesAgo := now - 300

	recentCount := 0
	for _, line := range lines {
		alertname := extractLabel(line, "alertname")
		if alertname == "Watchdog" {
			continue
		}

		parts := strings.Split(line, " ")
		if len(parts) < 2 {
			continue
		}
		valueStr := parts[len(parts)-1]

		var ts float64
		if _, err := fmt.Sscanf(valueStr, "%e", &ts); err != nil {
			if _, err := fmt.Sscanf(valueStr, "%f", &ts); err != nil {
				continue
			}
		}

		if ts > fiveMinutesAgo {
			recentCount++
			t.Logf("WARN: %s has activeAt within last 5 minutes (ts=%.0f, now=%.0f)", alertname, ts, now)
		}
	}

	totalNonWatchdog := 0
	for _, line := range lines {
		if extractLabel(line, "alertname") != "Watchdog" {
			totalNonWatchdog++
		}
	}

	if totalNonWatchdog > 0 {
		recentPct := float64(recentCount) / float64(totalNonWatchdog) * 100
		if recentPct > 80 {
			t.Errorf("%.0f%% of alerts (%d/%d) have activeAt within last 5 minutes — "+
				"likely using Alertmanager startsAt instead of Prometheus activeAt",
				recentPct, recentCount, totalNonWatchdog)
		}
	}

	t.Logf("Timestamp check: %d/%d non-Watchdog alerts have recent activeAt", recentCount, totalNonWatchdog)
}
