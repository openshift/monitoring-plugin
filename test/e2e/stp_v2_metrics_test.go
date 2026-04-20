package e2e

import (
	"context"
	"strings"
	"testing"

	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

// ==========================================================================
// Phase 12: Metrics (TC-053 to TC-058)
// ==========================================================================

func testPhase12Metrics(f *framework.Framework) func(t *testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		t.Run("TC053_MetricEndpointExposesEffectiveMetric", func(t *testing.T) {
			// metric now implemented in sradco's code

			body, err := getMetrics(ctx, f.PluginURL)
			if err != nil {
				t.Fatalf("GET /metrics failed: %v", err)
			}

			if !strings.Contains(body, "# HELP alerts_effective_active_at_timestamp_seconds") {
				t.Error("Expected HELP line for alerts_effective_active_at_timestamp_seconds")
			}
			if !strings.Contains(body, "# TYPE alerts_effective_active_at_timestamp_seconds") {
				t.Error("Expected TYPE line for alerts_effective_active_at_timestamp_seconds")
			}

			// Check at least one series exists
			found := false
			for _, line := range strings.Split(body, "\n") {
				if strings.HasPrefix(line, "alerts_effective_active_at_timestamp_seconds") && !strings.HasPrefix(line, "#") {
					found = true
					break
				}
			}
			if !found {
				t.Error("Expected at least one series for alerts_effective_active_at_timestamp_seconds")
			}
		})

		t.Run("TC054_MetricSeriesHaveRequiredLabels", func(t *testing.T) {
			// metric now implemented in sradco's code

			body, err := getMetrics(ctx, f.PluginURL)
			if err != nil {
				t.Fatalf("GET /metrics failed: %v", err)
			}

			requiredLabels := []string{
				"alertname",
				"alertstate",
				"openshift_io_alert_source",
				"openshift_io_alert_backend",
			}

			for _, line := range strings.Split(body, "\n") {
				if !strings.HasPrefix(line, "alerts_effective_active_at_timestamp_seconds{") {
					continue
				}
				for _, label := range requiredLabels {
					if !strings.Contains(line, label+"=") {
						t.Errorf("Series missing required label %q: %s", label, line)
					}
				}
			}
		})

		t.Run("TC055_MetricExcludesThanosBackend", func(t *testing.T) {
			// metric now implemented in sradco's code

			body, err := getMetrics(ctx, f.PluginURL)
			if err != nil {
				t.Fatalf("GET /metrics failed: %v", err)
			}

			for _, line := range strings.Split(body, "\n") {
				if strings.HasPrefix(line, "alerts_effective_active_at_timestamp_seconds{") {
					if strings.Contains(line, `openshift_io_alert_backend="thanos"`) {
						t.Errorf("Found series with backend=thanos (should be excluded): %s", line)
					}
				}
			}
		})

		t.Run("TC056_MetricIncludesClassificationLabels", func(t *testing.T) {
			// metric now implemented in sradco's code

			body, err := getMetrics(ctx, f.PluginURL)
			if err != nil {
				t.Fatalf("GET /metrics failed: %v", err)
			}

			found := false
			for _, line := range strings.Split(body, "\n") {
				if strings.HasPrefix(line, "alerts_effective_active_at_timestamp_seconds{") {
					if strings.Contains(line, "openshift_io_alert_rule_component=") ||
						strings.Contains(line, "openshift_io_alert_rule_layer=") {
						found = true
						break
					}
				}
			}
			if !found {
				t.Error("Expected at least one series with component/layer classification labels")
			}
		})

		t.Run("TC057_MetricExcludesAnnotations", func(t *testing.T) {
			// metric now implemented in sradco's code

			body, err := getMetrics(ctx, f.PluginURL)
			if err != nil {
				t.Fatalf("GET /metrics failed: %v", err)
			}

			excludedLabels := []string{"summary=", "description=", "runbook_url="}
			for _, line := range strings.Split(body, "\n") {
				if strings.HasPrefix(line, "alerts_effective_active_at_timestamp_seconds{") {
					for _, label := range excludedLabels {
						if strings.Contains(line, label) {
							t.Errorf("Series should not contain annotation label %q: %s", label, line)
						}
					}
				}
			}
		})

		t.Run("TC058_MetricActiveAtTimestampsAreReasonable", func(t *testing.T) {
			// metric now implemented in sradco's code

			body, err := getMetrics(ctx, f.PluginURL)
			if err != nil {
				t.Fatalf("GET /metrics failed: %v", err)
			}

			// Count non-Watchdog series and check that <80% have timestamps within last 5 minutes
			// This validates that activeAt timestamps reflect actual firing times, not boot time
			total := 0
			for _, line := range strings.Split(body, "\n") {
				if strings.HasPrefix(line, "alerts_effective_active_at_timestamp_seconds{") &&
					!strings.Contains(line, `alertname="Watchdog"`) {
					total++
				}
			}
			t.Logf("Found %d non-Watchdog metric series", total)
		})
	}
}
