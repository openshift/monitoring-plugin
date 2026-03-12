//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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
	Data struct {
		Groups []k8s.PrometheusRuleGroup `json:"groups"`
	} `json:"data"`
}

func listRules(ctx context.Context, f *framework.Framework) ([]k8s.PrometheusRule, error) {
	rules, status, err := listRulesWithToken(ctx, f, f.BearerToken, "")
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", status)
	}
	return rules, nil
}

func TestPrometheusRuleAppearsInMemory(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateUserNamespace(ctx, "test-prometheus-rule")
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer func() {
		if err := cleanup(); err != nil {
			t.Logf("cleanup failed: %v", err)
		}
	}()

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
		rules, err := listRules(ctx, f)
		if err != nil {
			t.Logf("Failed to list rules: %v", err)
			return false, nil
		}

		for _, rule := range rules {
			if rule.Name == testAlertName {
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

	testNamespace, cleanup, err := f.CreatePlatformNamespace(ctx, "test-relabel-alert")
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer func() {
		if err := cleanup(); err != nil {
			t.Logf("cleanup failed: %v", err)
		}
	}()

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
		ctx, arc, metav1.CreateOptions{},
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
		rules, err := listRules(ctx, f)
		if err != nil {
			t.Logf("Failed to list rules: %v", err)
			return false, nil
		}

		foundCriticalWithOps := false

		for _, rule := range rules {
			if rule.Name == "TestRelabelAlert" {
				if rule.Labels["team"] == "ops" && rule.Labels["severity"] == "critical" {
					t.Logf("Found critical alert with team=ops (relabeling successful)")
					foundCriticalWithOps = true
				}
			}
		}

		if foundCriticalWithOps {
			t.Logf("Relabeling verified: critical alert has team=ops")
			return true, nil
		}

		t.Logf("Waiting for relabeling to take effect")
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
		ctx, prometheusRule, metav1.CreateOptions{},
	)
}

func compareRuleLabels(t *testing.T, alertName string, foundLabels map[string]string, wantedLabels map[string]string) error {
	t.Helper()
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

// TestRBAC_GetRules verifies Thanos-tenancy RBAC for GET /rules.
//
// With ?namespace=: User A (no perms) gets HTTP 200 without the UWM rule in
// ns Y; User B (monitoring-rules-view in Y) sees Y but not Z; cluster-admin
// sees Y.
//
// Without ?namespace=: fan-out must not leak the rule to unprivileged users
// and must still return it for namespace-scoped viewers.
func TestRBAC_GetRules(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-rbac-get-rules-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() {
		if err := cleanupY(); err != nil {
			t.Logf("cleanup namespace Y failed: %v", err)
		}
	}()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-rbac-get-rules-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() {
		if err := cleanupZ(); err != nil {
			t.Logf("cleanup namespace Z failed: %v", err)
		}
	}()

	userA, err := f.CreateAnonymousUser(ctx, "e2e-rbac-rules-a", "default")
	if err != nil {
		t.Fatalf("Failed to create unprivileged user A: %v", err)
	}
	defer func() {
		if err := userA.Cleanup(); err != nil {
			t.Logf("cleanup user A failed: %v", err)
		}
	}()

	userB, err := f.CreateUserWithClusterRole(ctx, "e2e-rbac-rules-b", nsY, "monitoring-rules-view")
	if err != nil {
		t.Fatalf("Failed to create scoped user B: %v", err)
	}
	defer func() {
		if err := userB.Cleanup(); err != nil {
			t.Logf("cleanup user B failed: %v", err)
		}
	}()

	nsYName := "E2ERBACGetRulesTestY"
	nsZName := "E2ERBACGetRulesTestZ"
	forDuration := monitoringv1.Duration("5m")
	ruleY := monitoringv1.Rule{
		Alert: nsYName,
		Expr:  intstr.FromString("vector(1)"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "none",
			"e2e_test": "rbac_get_rules",
		},
	}
	ruleZ := monitoringv1.Rule{
		Alert: nsZName,
		Expr:  intstr.FromString("vector(1)"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "none",
			"e2e_test": "rbac_get_rules",
		},
	}

	if _, err = createPrometheusRule(ctx, f, nsY, ruleY); err != nil {
		t.Fatalf("Failed to create PrometheusRule in nsY: %v", err)
	}
	if _, err = createPrometheusRule(ctx, f, nsZ, ruleZ); err != nil {
		t.Fatalf("Failed to create PrometheusRule in nsZ: %v", err)
	}

	err = wait.PollUntilContextTimeout(ctx, 2*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		rulesY, status, err := listRulesWithToken(ctx, f, f.BearerToken, nsY)
		if err != nil {
			t.Logf("Admin GET /rules nsY failed: %v", err)
			return false, nil
		}
		if status != http.StatusOK {
			t.Logf("Admin GET /rules nsY returned status %d, retrying", status)
			return false, nil
		}
		rulesZ, status, err := listRulesWithToken(ctx, f, f.BearerToken, nsZ)
		if err != nil {
			t.Logf("Admin GET /rules nsZ failed: %v", err)
			return false, nil
		}
		if status != http.StatusOK {
			t.Logf("Admin GET /rules nsZ returned status %d, retrying", status)
			return false, nil
		}
		if containsRule(rulesY, nsYName) && containsRule(rulesZ, nsZName) {
			return true, nil
		}
		t.Logf("Waiting for rules %s and %s", nsYName, nsZName)
		return false, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for admin to see rules: %v", err)
	}

	cases := []struct {
		name      string
		token     string
		namespace string
		ruleName  string
		wantRule  bool
	}{
		{"UserA_NoPerms_NamespaceY", userA.Token, nsY, nsYName, false},
		{"UserA_NoPerms_NamespaceZ", userA.Token, nsZ, nsZName, false},
		{"UserA_NoPerms_NoNamespace_Y", userA.Token, "", nsYName, false},
		{"UserA_NoPerms_NoNamespace_Z", userA.Token, "", nsZName, false},
		{"UserB_RulesView_NamespaceY", userB.Token, nsY, nsYName, true},
		{"UserB_RulesView_NamespaceZ", userB.Token, nsZ, nsZName, false},
		{"UserB_RulesView_NoNamespace_Y", userB.Token, "", nsYName, true},
		{"UserB_RulesView_NoNamespace_Z", userB.Token, "", nsZName, false},
		{"UserC_ClusterAdmin_NamespaceY", f.BearerToken, nsY, nsYName, true},
		{"UserC_ClusterAdmin_NamespaceZ", f.BearerToken, nsZ, nsZName, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rules, status, err := listRulesWithToken(ctx, f, tc.token, tc.namespace)
			if err != nil {
				t.Fatalf("GET /rules request failed: %v", err)
			}
			if status != http.StatusOK {
				t.Fatalf("Expected status %d, got %d", http.StatusOK, status)
			}
			got := containsRule(rules, tc.ruleName)
			if got != tc.wantRule {
				t.Fatalf("Rule %s visibility: want %v, got %v (%d rules returned)", tc.ruleName, tc.wantRule, got, len(rules))
			}
		})
	}
}

func containsRule(rules []k8s.PrometheusRule, alertName string) bool {
	for _, r := range rules {
		if r.Name == alertName {
			return true
		}
	}
	return false
}

// listRulesWithToken calls GET /rules with an optional namespace query param.
// A non-OK status is not an error — callers must assert on status explicitly.
func listRulesWithToken(ctx context.Context, f *framework.Framework, token, namespace string) (rules []k8s.PrometheusRule, status int, err error) {
	rulesURL := f.PluginURL + "/api/v1/alerting/rules"
	if namespace != "" {
		rulesURL += "?" + url.Values{"namespace": {namespace}}.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rulesURL, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("closing response body: %w", closeErr)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}

	var listResp listRulesResponse
	if decodeErr := json.NewDecoder(resp.Body).Decode(&listResp); decodeErr != nil {
		return nil, resp.StatusCode, decodeErr
	}

	for _, group := range listResp.Data.Groups {
		rules = append(rules, group.Rules...)
	}
	return rules, resp.StatusCode, nil
}
