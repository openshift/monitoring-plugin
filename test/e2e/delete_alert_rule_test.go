//go:build e2e

package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func TestDeleteAlertRule(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-delete-rule", false)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	ruleNames := []string{"DeleteAlert1", "DeleteAlert2", "KeepAlert3"}
	ruleIDs := make([]string, 0, len(ruleNames))

	for _, name := range ruleNames {
		expr := fmt.Sprintf("absent(nonexistent{e2e_rule=%q})", name)
		id, err := createRuleViaAPI(ctx, f, managementrouter.CreateAlertRuleRequest{
			AlertingRule: &managementrouter.AlertRuleSpec{
				Alert: new(name),
				Expr:  &expr,
				For:   new("1m"),
				Labels: &map[string]string{
					"severity": "info",
				},
			},
			PrometheusRule: &managementrouter.PrometheusRuleTarget{
				PrometheusRuleName:      "e2e-delete-pr",
				PrometheusRuleNamespace: testNamespace,
			},
		})
		if err != nil {
			t.Fatalf("Failed to create alert rule %s: %v", name, err)
		}
		ruleIDs = append(ruleIDs, id)
	}

	t.Logf("Created 3 rules with IDs: %v", ruleIDs)

	time.Sleep(2 * time.Second)

	deleteReq := managementrouter.BulkDeleteAlertRulesRequest{
		RuleIds: []string{ruleIDs[0], ruleIDs[1]},
	}
	reqBody, err := json.Marshal(deleteReq)
	if err != nil {
		t.Fatalf("Failed to marshal delete request: %v", err)
	}

	deleteURL := f.PluginURL + "/api/v1/alerting/rules"
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, bytes.NewBuffer(reqBody))
	if err != nil {
		t.Fatalf("Failed to create delete request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		t.Fatalf("Failed to make delete request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status 200, got %d. Body: %s", resp.StatusCode, string(body))
	}

	var deleteResp managementrouter.BulkDeleteAlertRulesResponse
	if err := json.NewDecoder(resp.Body).Decode(&deleteResp); err != nil {
		t.Fatalf("Failed to decode delete response: %v", err)
	}

	if len(deleteResp.Rules) != 2 {
		t.Fatalf("Expected 2 results, got %d", len(deleteResp.Rules))
	}
	for _, result := range deleteResp.Rules {
		if result.StatusCode != http.StatusNoContent {
			t.Errorf("Rule %s deletion failed with status %d: %v", result.Id, result.StatusCode, result.Message)
		}
	}

	promRule, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(testNamespace).Get(
		ctx, "e2e-delete-pr", metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to get PrometheusRule after deletion: %v", err)
	}

	var remainingAlerts []string
	for _, group := range promRule.Spec.Groups {
		for _, rule := range group.Rules {
			remainingAlerts = append(remainingAlerts, rule.Alert)
		}
	}

	if len(remainingAlerts) != 1 {
		t.Fatalf("Expected 1 remaining rule, got %d: %v", len(remainingAlerts), remainingAlerts)
	}
	if remainingAlerts[0] != "KeepAlert3" {
		t.Errorf("Expected remaining rule 'KeepAlert3', got %q", remainingAlerts[0])
	}

	t.Log("Delete alert rule e2e test passed successfully")
}
