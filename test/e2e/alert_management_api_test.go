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

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func listRulesForAlertMgmt(ctx context.Context, pluginURL string) ([]monitoringv1.Rule, error) {
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

	var listResp struct {
		Data struct {
			Rules []monitoringv1.Rule `json:"rules"`
		} `json:"data"`
		Status string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, err
	}

	return listResp.Data.Rules, nil
}

func TestBulkDeleteUserDefinedAlertRules(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-bulk-delete", false)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	forDuration := monitoringv1.Duration("5m")

	testRule1 := monitoringv1.Rule{
		Alert: "TestBulkDeleteAlert1",
		Expr:  intstr.FromString("up == 0"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "warning",
		},
		Annotations: map[string]string{
			"description": "Test alert 1 for bulk delete testing",
		},
	}

	testRule2 := monitoringv1.Rule{
		Alert: "TestBulkDeleteAlert2",
		Expr:  intstr.FromString("up == 1"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "info",
		},
		Annotations: map[string]string{
			"description": "Test alert 2 for bulk delete testing",
		},
	}

	testRule3 := monitoringv1.Rule{
		Alert: "TestBulkDeleteAlert3",
		Expr:  intstr.FromString("up == 2"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "critical",
		},
		Annotations: map[string]string{
			"description": "Test alert 3 for bulk delete testing",
		},
	}

	_, err = createPrometheusRule(ctx, f, testNamespace, testRule1, testRule2, testRule3)
	if err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	var ruleIdsToDelete []string
	err = wait.PollUntilContextTimeout(ctx, 2*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		rules, err := listRulesForAlertMgmt(ctx, f.PluginURL)
		if err != nil {
			t.Logf("Failed to list rules: %v", err)
			return false, nil
		}

		foundRuleIds := []string{}
		for _, rule := range rules {
			if rule.Alert == "TestBulkDeleteAlert1" || rule.Alert == "TestBulkDeleteAlert2" {
				ruleId := rule.Labels[k8s.AlertRuleLabelId]
				if ruleId != "" {
					foundRuleIds = append(foundRuleIds, ruleId)
				}
			}
		}

		if len(foundRuleIds) == 2 {
			ruleIdsToDelete = foundRuleIds
			t.Logf("Found rule IDs to delete: %v", ruleIdsToDelete)
			return true, nil
		}

		t.Logf("Found %d/2 test alerts in memory", len(foundRuleIds))
		return false, nil
	})

	if err != nil {
		t.Fatalf("Timeout waiting for alerts to appear in memory: %v", err)
	}

	reqBody := managementrouter.BulkDeleteUserDefinedAlertRulesRequest{
		RuleIds: ruleIdsToDelete,
	}

	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatalf("Failed to marshal request body: %v", err)
	}

	bulkDeleteURL := fmt.Sprintf("%s/api/v1/alerting/rules", f.PluginURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, bulkDeleteURL, bytes.NewBuffer(reqJSON))
	if err != nil {
		t.Fatalf("Failed to create HTTP request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Failed to make bulk delete request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status code %d, got %d. Response body: %s", http.StatusOK, resp.StatusCode, string(body))
	}

	var bulkDeleteResp managementrouter.BulkDeleteUserDefinedAlertRulesResponse
	if err := json.NewDecoder(resp.Body).Decode(&bulkDeleteResp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(bulkDeleteResp.Rules) != 2 {
		t.Fatalf("Expected 2 rules in response, got %d", len(bulkDeleteResp.Rules))
	}

	for _, result := range bulkDeleteResp.Rules {
		if result.StatusCode != http.StatusNoContent {
			t.Errorf("Rule %s deletion failed with status %d: %s", result.Id, result.StatusCode, result.Message)
		} else {
			t.Logf("Rule %s deleted successfully", result.Id)
		}
	}

	promRule, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(testNamespace).Get(
		ctx,
		"test-prometheus-rule",
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to get PrometheusRule after deletion: %v", err)
	}

	if len(promRule.Spec.Groups) != 1 {
		t.Fatalf("Expected 1 rule group, got %d", len(promRule.Spec.Groups))
	}

	ruleGroup := promRule.Spec.Groups[0]
	if len(ruleGroup.Rules) != 1 {
		t.Fatalf("Expected 1 rule remaining, got %d: %+v", len(ruleGroup.Rules), ruleGroup.Rules)
	}

	remainingRule := ruleGroup.Rules[0]
	if remainingRule.Alert != "TestBulkDeleteAlert3" {
		t.Errorf("Expected remaining rule to be TestBulkDeleteAlert3, got %s", remainingRule.Alert)
	}

	if remainingRule.Labels["severity"] != "critical" {
		t.Errorf("Expected severity=critical, got %s", remainingRule.Labels["severity"])
	}

	t.Log("Bulk delete test completed successfully - only TestBulkDeleteAlert3 remains")
}

func TestDeleteUserDefinedAlertRuleById(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-delete-by-id", false)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	forDuration := monitoringv1.Duration("5m")

	testRule1 := monitoringv1.Rule{
		Alert: "TestDeleteByIdAlert1",
		Expr:  intstr.FromString("up == 0"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "warning",
		},
		Annotations: map[string]string{
			"description": "Test alert 1 for delete by id testing",
		},
	}

	testRule2 := monitoringv1.Rule{
		Alert: "TestDeleteByIdAlert2",
		Expr:  intstr.FromString("up == 1"),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "info",
		},
		Annotations: map[string]string{
			"description": "Test alert 2 for delete by id testing",
		},
	}

	_, err = createPrometheusRule(ctx, f, testNamespace, testRule1, testRule2)
	if err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	var ruleIdToDelete string
	err = wait.PollUntilContextTimeout(ctx, 2*time.Second, 2*time.Minute, true, func(ctx context.Context) (bool, error) {
		rules, err := listRulesForAlertMgmt(ctx, f.PluginURL)
		if err != nil {
			t.Logf("Failed to list rules: %v", err)
			return false, nil
		}

		for _, rule := range rules {
			if rule.Alert == "TestDeleteByIdAlert1" {
				ruleIdToDelete = rule.Labels[k8s.AlertRuleLabelId]
				t.Logf("Found rule ID to delete: %s", ruleIdToDelete)
				return true, nil
			}
		}

		t.Logf("Test alert not found yet in memory")
		return false, nil
	})

	if err != nil {
		t.Fatalf("Timeout waiting for alerts to appear in memory: %v", err)
	}

	deleteURL := fmt.Sprintf("%s/api/v1/alerting/rules/%s", f.PluginURL, ruleIdToDelete)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, nil)
	if err != nil {
		t.Fatalf("Failed to create HTTP request: %v", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Failed to make delete request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status code %d, got %d. Response body: %s", http.StatusNoContent, resp.StatusCode, string(body))
	}

	t.Logf("Rule %s deleted successfully", ruleIdToDelete)

	promRule, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(testNamespace).Get(
		ctx,
		"test-prometheus-rule",
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to get PrometheusRule after deletion: %v", err)
	}

	if len(promRule.Spec.Groups) != 1 {
		t.Fatalf("Expected 1 rule group, got %d", len(promRule.Spec.Groups))
	}

	ruleGroup := promRule.Spec.Groups[0]
	if len(ruleGroup.Rules) != 1 {
		t.Fatalf("Expected 1 rule remaining, got %d: %+v", len(ruleGroup.Rules), ruleGroup.Rules)
	}

	remainingRule := ruleGroup.Rules[0]
	if remainingRule.Alert != "TestDeleteByIdAlert2" {
		t.Errorf("Expected remaining rule to be TestDeleteByIdAlert2, got %s", remainingRule.Alert)
	}

	if remainingRule.Labels["severity"] != "info" {
		t.Errorf("Expected severity=info, got %s", remainingRule.Labels["severity"])
	}

	t.Log("Delete by ID test completed successfully - only TestDeleteByIdAlert2 remains")
}
