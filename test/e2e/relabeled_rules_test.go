package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

type listRulesResponse struct {
	Data   listRulesResponseData `json:"data"`
	Status string                `json:"status"`
}

type listRulesResponseData struct {
	Rules []monitoringv1.Rule `json:"rules"`
}

func listRules(ctx context.Context, pluginURL string) ([]monitoringv1.Rule, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pluginURL+"/api/v1/alerting/rules", nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var listResp listRulesResponse
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, err
	}

	return listResp.Data.Rules, nil
}

func TestPrometheusRuleAppearsInMemory(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-prometheus-rule", false)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	testAlertName := "TestAlert"
	forDuration := monitoringv1.Duration("5m")
	testRule := monitoringv1.Rule{
		Alert: testAlertName,
		Expr:  intstr.FromString("up == 0"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "warning",
		},
		Annotations: map[string]string{
			"description": "Test alert for e2e testing",
			"summary":     "Test alert",
		},
	}

	_, err = createPrometheusRule(ctx, f, testNamespace, testRule)
	if err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	err = wait.PollUntilContextTimeout(ctx, 2*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		rules, err := listRules(ctx, f.PluginURL)
		if err != nil {
			t.Logf("Failed to list rules: %v", err)
			return false, nil
		}

		for _, rule := range rules {
			if rule.Alert == testAlertName {
				expectedLabels := map[string]string{
					k8s.PrometheusRuleLabelNamespace: testNamespace,
					k8s.PrometheusRuleLabelName:      "test-prometheus-rule",
				}

				if err := compareRuleLabels(t, testAlertName, rule.Labels, expectedLabels); err != nil {
					return false, err
				}

				if _, ok := rule.Labels[k8s.AlertRuleLabelId]; !ok {
					t.Errorf("Alert %s missing openshift_io_alert_rule_id label", testAlertName)
					return false, fmt.Errorf("alert missing openshift_io_alert_rule_id label")
				}

				t.Logf("Found alert %s in memory with all expected labels", testAlertName)
				return true, nil
			}
		}

		t.Logf("Alert %s not found in memory yet (found %d rules)", testAlertName, len(rules))
		return false, nil
	})

	if err != nil {
		t.Fatalf("Timeout waiting for alert to appear in memory: %v", err)
	}
}

func TestRelabelAlert(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-relabel-alert", true)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	forDuration := monitoringv1.Duration("5m")

	criticalRule := monitoringv1.Rule{
		Alert: "TestRelabelAlert",
		Expr:  intstr.FromString("up == 0"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "critical",
			"team":     "web",
		},
		Annotations: map[string]string{
			"description": "Critical alert for relabel testing",
			"summary":     "Critical test alert",
		},
	}

	warningRule := monitoringv1.Rule{
		Alert: "TestRelabelAlert",
		Expr:  intstr.FromString("up == 1"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "warning",
			"team":     "web",
		},
		Annotations: map[string]string{
			"description": "Warning alert for relabel testing",
			"summary":     "Warning test alert",
		},
	}

	_, err = createPrometheusRule(ctx, f, testNamespace, criticalRule, warningRule)
	if err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	relabelConfigName := "change-critical-team"
	arc := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      relabelConfigName,
			Namespace: k8s.ClusterMonitoringNamespace,
		},
		Spec: osmv1.AlertRelabelConfigSpec{
			Configs: []osmv1.RelabelConfig{
				{
					SourceLabels: []osmv1.LabelName{"alertname", "severity"},
					Regex:        "TestRelabelAlert;critical",
					Separator:    ";",
					TargetLabel:  "team",
					Replacement:  "ops",
					Action:       "Replace",
				},
			},
		},
	}

	_, err = f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Create(
		ctx,
		arc,
		metav1.CreateOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to create AlertRelabelConfig: %v", err)
	}
	defer func() {
		err = f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Delete(ctx, relabelConfigName, metav1.DeleteOptions{})
		if err != nil {
			t.Fatalf("Failed to delete AlertRelabelConfig: %v", err)
		}
	}()

	err = wait.PollUntilContextTimeout(ctx, 2*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		rules, err := listRules(ctx, f.PluginURL)
		if err != nil {
			t.Logf("Failed to list rules: %v", err)
			return false, nil
		}

		foundCriticalWithOps := false
		foundWarningWithWeb := false

		for _, rule := range rules {
			if rule.Alert == "TestRelabelAlert" {
				if rule.Labels["team"] == "ops" && rule.Labels["severity"] == "critical" {
					t.Logf("Found critical alert with team=ops (relabeling successful)")
					foundCriticalWithOps = true
				}

				if rule.Labels["team"] == "web" && rule.Labels["severity"] == "warning" {
					t.Logf("Found warning alert with team=web")
					foundWarningWithWeb = true
				}
			}
		}

		if foundCriticalWithOps {
			t.Logf("Relabeling verified: critical alert has team=ops, warning alert has team=web")
			return true, nil
		}

		t.Logf("Waiting for relabeling to take effect (critical with ops=%v, warning with web=%v)", foundCriticalWithOps, foundWarningWithWeb)
		return false, nil
	})

	if err != nil {
		t.Fatalf("Timeout waiting for relabeling to take effect: %v", err)
	}
}

func createPrometheusRule(ctx context.Context, f *framework.Framework, namespace string, rules ...monitoringv1.Rule) (*monitoringv1.PrometheusRule, error) {
	interval := monitoringv1.Duration("30s")
	prometheusRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-prometheus-rule",
			Namespace: namespace,
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{
				{
					Name:     "test-group",
					Interval: &interval,
					Rules:    rules,
				},
			},
		},
	}

	return f.Monitoringv1clientset.MonitoringV1().PrometheusRules(namespace).Create(
		ctx,
		prometheusRule,
		metav1.CreateOptions{},
	)
}

func compareRuleLabels(t *testing.T, alertName string, foundLabels map[string]string, wantedLabels map[string]string) error {
	if foundLabels == nil {
		t.Errorf("Alert %s has no labels", alertName)
		return fmt.Errorf("alert has no labels")
	}

	for key, wantValue := range wantedLabels {
		if gotValue, ok := foundLabels[key]; !ok {
			t.Errorf("Alert %s missing %s label", alertName, key)
			return fmt.Errorf("alert missing %s label", key)
		} else if gotValue != wantValue {
			t.Errorf("Alert %s has wrong %s label. Expected %s, got %s",
				alertName, key, wantValue, gotValue)
			return fmt.Errorf("alert has wrong %s label", key)
		}
	}

	return nil
}
