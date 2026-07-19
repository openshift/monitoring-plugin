//go:build e2e

package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func strPtr(s string) *string { return &s }

// findPlatformAlertRuleId discovers an existing platform alert rule from
// openshift-monitoring and returns its computed alert rule ID.
func findPlatformAlertRuleId(t *testing.T, f *framework.Framework, ctx context.Context) string {
	t.Helper()

	prList, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list PrometheusRules in %s: %v", k8s.ClusterMonitoringNamespace, err)
	}

	for _, pr := range prList.Items {
		for _, group := range pr.Spec.Groups {
			for i := range group.Rules {
				rule := &group.Rules[i]
				if rule.Alert == "" {
					continue
				}
				id := alertrule.GetAlertingRuleId(rule)
				if id != "" {
					return id
				}
			}
		}
	}

	t.Fatal("No platform alert rules found in openshift-monitoring")
	return ""
}

// createRuleViaAPI sends a create alert rule request using the framework's
// admin token and returns the rule ID. This is the low-level helper used by
// create_alert_rule_test.go and rbac_test.go.
func createRuleViaAPI(ctx context.Context, f *framework.Framework, payload managementrouter.CreateAlertRuleRequest) (string, error) {
	reqBody, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal create request: %w", err)
	}

	createURL, err := url.JoinPath(f.PluginURL, "api/v1/alerting/rules")
	if err != nil {
		return "", fmt.Errorf("build create URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, createURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return "", fmt.Errorf("create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		return "", fmt.Errorf("make create request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", fmt.Errorf("failed to read body: %w", err)
		}
		return "", fmt.Errorf("expected 201, got %d: %s", resp.StatusCode, string(body))
	}

	var createResp managementrouter.CreateAlertRuleResponse
	if err := json.NewDecoder(resp.Body).Decode(&createResp); err != nil {
		return "", fmt.Errorf("decode create response: %w", err)
	}

	if createResp.Id == "" {
		return "", fmt.Errorf("got empty ID")
	}
	return createResp.Id, nil
}

// mustCreateRule is a test convenience wrapper around createRuleViaAPI that
// builds the request from individual parameters and calls t.Fatal on error.
func mustCreateRule(t *testing.T, f *framework.Framework, ctx context.Context, namespace, alertName, prName string) string {
	t.Helper()

	expr := fmt.Sprintf("absent(nonexistent{e2e_rule=%q})", alertName)

	id, err := createRuleViaAPI(ctx, f, managementrouter.CreateAlertRuleRequest{
		AlertingRule: &managementrouter.AlertRuleSpec{
			Alert: &alertName,
			Expr:  &expr,
			For:   strPtr("1m"),
			Labels: &map[string]string{
				"severity": "info",
			},
		},
		PrometheusRule: &managementrouter.PrometheusRuleTarget{
			PrometheusRuleName:      prName,
			PrometheusRuleNamespace: namespace,
		},
	})
	if err != nil {
		t.Fatalf("Failed to create rule %s in %s: %v", alertName, namespace, err)
	}
	return id
}
