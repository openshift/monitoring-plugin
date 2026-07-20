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

	testNamespace, cleanup, err := f.CreateUserNamespace(ctx, "test-delete-rule")
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

// TestRBAC_DeleteAlertRule verifies that the bulk-delete endpoint enforces
// Kubernetes RBAC across three user profiles: anonymous (403),
// namespace-scoped (204 in own namespace, 403 elsewhere), and cluster-admin
// (204 everywhere).
func TestRBAC_DeleteAlertRule(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-rbac-del-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-rbac-del-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	userA, err := f.CreateAnonymousUser(ctx, "e2e-rbac-del-a", "default")
	if err != nil {
		t.Fatalf("Failed to create anonymous user A: %v", err)
	}
	defer func() { _ = userA.Cleanup() }()

	userB, err := f.CreateScopedUser(ctx, "e2e-rbac-del-b", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch", "delete"})
	if err != nil {
		t.Fatalf("Failed to create scoped user B: %v", err)
	}
	defer func() { _ = userB.Cleanup() }()

	ruleInY, err := createRuleViaAPI(ctx, f, managementrouter.CreateAlertRuleRequest{
		AlertingRule: &managementrouter.AlertRuleSpec{
			Alert: new("RBACDelAlertY"),
			Expr:  new(fmt.Sprintf("absent(nonexistent{e2e_rbac_del=%q})", "y")),
			Labels: &map[string]string{
				"severity": "info",
			},
		},
		PrometheusRule: &managementrouter.PrometheusRuleTarget{
			PrometheusRuleName:      "e2e-rbac-del-pr",
			PrometheusRuleNamespace: nsY,
		},
	})
	if err != nil {
		t.Fatalf("Failed to create rule in namespace Y: %v", err)
	}
	t.Logf("Created rule in namespace Y: %s", ruleInY)

	ruleInZ, err := createRuleViaAPI(ctx, f, managementrouter.CreateAlertRuleRequest{
		AlertingRule: &managementrouter.AlertRuleSpec{
			Alert: new("RBACDelAlertZ"),
			Expr:  new(fmt.Sprintf("absent(nonexistent{e2e_rbac_del=%q})", "z")),
			Labels: &map[string]string{
				"severity": "info",
			},
		},
		PrometheusRule: &managementrouter.PrometheusRuleTarget{
			PrometheusRuleName:      "e2e-rbac-del-pr",
			PrometheusRuleNamespace: nsZ,
		},
	})
	if err != nil {
		t.Fatalf("Failed to create rule in namespace Z: %v", err)
	}
	t.Logf("Created rule in namespace Z: %s", ruleInZ)

	ruleInY2, err := createRuleViaAPI(ctx, f, managementrouter.CreateAlertRuleRequest{
		AlertingRule: &managementrouter.AlertRuleSpec{
			Alert: new("RBACDelAlertY2"),
			Expr:  new(fmt.Sprintf("absent(nonexistent{e2e_rbac_del=%q})", "y2")),
			Labels: &map[string]string{
				"severity": "info",
			},
		},
		PrometheusRule: &managementrouter.PrometheusRuleTarget{
			PrometheusRuleName:      "e2e-rbac-del-pr",
			PrometheusRuleNamespace: nsY,
		},
	})
	if err != nil {
		t.Fatalf("Failed to create second rule in namespace Y: %v", err)
	}
	t.Logf("Created second rule in namespace Y: %s", ruleInY2)

	waitForCacheSync(t, f, ctx, userA.Token, ruleInY)

	cases := []struct {
		name       string
		token      string
		ruleID     string
		wantStatus int
	}{
		{"UserA_NoPerms_DeniedNamespaceY", userA.Token, ruleInY, http.StatusForbidden},
		{"UserB_ScopedPerms_SucceedsNamespaceY", userB.Token, ruleInY, http.StatusNoContent},
		{"UserB_ScopedPerms_DeniedNamespaceZ", userB.Token, ruleInZ, http.StatusForbidden},
		{"UserC_Admin_SucceedsNamespaceY", f.BearerToken, ruleInY2, http.StatusNoContent},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status := deleteAlertRuleWithToken(t, f, ctx, tc.token, tc.ruleID)
			if status != tc.wantStatus {
				t.Fatalf("Expected per-rule status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

// waitForCacheSync polls until the relabeled-rules cache has synced by
// attempting a bulk-delete probe. A 403 (Forbidden) or 204 (NoContent)
// per-rule status indicates the rule was found in cache and RBAC was evaluated.
func waitForCacheSync(t *testing.T, f *framework.Framework, ctx context.Context, token, ruleID string) {
	t.Helper()
	const timeout = 30 * time.Second
	const interval = time.Second
	deadline := time.Now().Add(timeout)
	for {
		status, err := tryDeleteAlertRule(f, ctx, token, ruleID)
		if err == nil && (status == http.StatusForbidden || status == http.StatusNoContent) {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("Cache sync timed out after %v (last status=%d, err=%v)", timeout, status, err)
		}
		if err != nil {
			t.Logf("Cache sync: %v, retrying...", err)
		} else {
			t.Logf("Cache sync: per-rule status %d, retrying...", status)
		}
		time.Sleep(interval)
	}
}

// tryDeleteAlertRule attempts a single-rule bulk-delete and returns the per-rule
// status code without calling t.Fatal, making it suitable for polling loops.
func tryDeleteAlertRule(f *framework.Framework, ctx context.Context, token, ruleID string) (int, error) {
	payload := managementrouter.BulkDeleteAlertRulesRequest{
		RuleIds: []string{ruleID},
	}
	reqBody, err := json.Marshal(payload)
	if err != nil {
		return 0, fmt.Errorf("marshal delete request: %w", err)
	}
	deleteURL, err := url.JoinPath(f.PluginURL, "api/v1/alerting/rules")
	if err != nil {
		return 0, fmt.Errorf("build URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return 0, fmt.Errorf("create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		return 0, fmt.Errorf("make delete request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, fmt.Errorf("expected bulk response 200, got %d: %s", resp.StatusCode, string(body))
	}

	var deleteResp managementrouter.BulkDeleteAlertRulesResponse
	if err := json.NewDecoder(resp.Body).Decode(&deleteResp); err != nil {
		return 0, fmt.Errorf("decode delete response: %w", err)
	}
	if len(deleteResp.Rules) != 1 {
		return 0, fmt.Errorf("expected 1 per-rule result, got %d", len(deleteResp.Rules))
	}
	return deleteResp.Rules[0].StatusCode, nil
}

// deleteAlertRuleWithToken sends a bulk-delete request for a single rule ID
// using the given bearer token and returns the per-rule HTTP status code.
func deleteAlertRuleWithToken(t *testing.T, f *framework.Framework, ctx context.Context, token, ruleID string) int {
	t.Helper()

	status, err := tryDeleteAlertRule(f, ctx, token, ruleID)
	if err != nil {
		t.Fatalf("Delete request for rule %s failed: %v", ruleID, err)
	}
	return status
}
