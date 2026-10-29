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

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

// TestDeleteAlertRule covers bulk-delete success (cluster-admin) and RBAC
// denials/allowances for anonymous and namespace-scoped personas as subtests.
func TestDeleteAlertRule(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-delete-rule-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-delete-rule-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	anonymousUser, err := f.CreateAnonymousUser(ctx, "e2e-delete-anon", "default")
	if err != nil {
		t.Fatalf("Failed to create anonymous user: %v", err)
	}
	defer func() { _ = anonymousUser.Cleanup() }()

	scopedUser, err := f.CreateScopedUser(ctx, "e2e-delete-scoped", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch", "delete"})
	if err != nil {
		t.Fatalf("Failed to create scoped user: %v", err)
	}
	defer func() { _ = scopedUser.Cleanup() }()

	t.Run("ClusterAdmin_BulkDeleteAndVerifyRemaining", func(t *testing.T) {
		ruleNames := []string{"DeleteAlert1", "DeleteAlert2", "KeepAlert3"}
		ruleIDs := make([]string, 0, len(ruleNames))

		for _, name := range ruleNames {
			expr := fmt.Sprintf("absent(nonexistent{e2e_rule=%q})", name)
			alertRuleRequest := managementrouter.CreateAlertRuleRequest{
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
					PrometheusRuleNamespace: nsY,
				},
			}

			id, err := createRuleViaAPIWithRetry(ctx, f, alertRuleRequest)
			if err != nil {
				t.Fatalf("failed to create alert rule %s: %v", name, err)
			}
			ruleIDs = append(ruleIDs, id)
		}

		t.Logf("Created 3 rules with IDs: %v", ruleIDs)

		deleteReq := managementrouter.BulkDeleteAlertRulesRequest{
			RuleIds: []string{ruleIDs[0], ruleIDs[1]},
		}
		reqBody, err := json.Marshal(deleteReq)
		if err != nil {
			t.Fatalf("Failed to marshal delete request: %v", err)
		}

		err = framework.Poll(time.Second, time.Minute, func() error {
			deleteURL := f.PluginURL + "/api/v1/alerting/rules"
			req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, bytes.NewBuffer(reqBody))
			if err != nil {
				return fmt.Errorf("failed to create delete request: %w", err)
			}
			req.Header.Set("Content-Type", "application/json")
			if f.BearerToken != "" {
				req.Header.Set("Authorization", "Bearer "+f.BearerToken)
			}

			resp, err := f.HTTPClient().Do(req)
			if err != nil {
				return fmt.Errorf("failed to make delete request: %w", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					return fmt.Errorf("failed to read body: %w", err)
				}
				return fmt.Errorf("expected status 200, got %d (body: %s)", resp.StatusCode, string(body))
			}

			var deleteResp managementrouter.BulkDeleteAlertRulesResponse
			if err := json.NewDecoder(resp.Body).Decode(&deleteResp); err != nil {
				return fmt.Errorf("failed to decode delete response: %w", err)
			}

			if len(deleteResp.Rules) != 2 {
				return fmt.Errorf("expected 2 results, got %d", len(deleteResp.Rules))
			}
			for _, result := range deleteResp.Rules {
				// http.StatusNotFound can be returned if a previous request was partially successful.
				if result.StatusCode/100 != 2 && result.StatusCode != http.StatusNotFound {
					return fmt.Errorf("rule %s deletion failed with status %d: %v", result.Id, result.StatusCode, result.Message)
				}
			}

			return nil
		})
		require.NoError(t, err)

		err = framework.Poll(time.Second, 20*time.Second, func() error {
			promRule, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(nsY).Get(
				ctx, "e2e-delete-pr", metav1.GetOptions{},
			)
			if err != nil {
				return fmt.Errorf("failed to get PrometheusRule after deletion: %w", err)
			}

			var remainingAlerts []string
			for _, group := range promRule.Spec.Groups {
				for _, rule := range group.Rules {
					remainingAlerts = append(remainingAlerts, rule.Alert)
				}
			}

			if len(remainingAlerts) != 1 {
				return fmt.Errorf("expected 1 remaining rule, got %d: %v", len(remainingAlerts), remainingAlerts)
			}

			if remainingAlerts[0] != "KeepAlert3" {
				return fmt.Errorf("expected remaining rule 'KeepAlert3', got %q", remainingAlerts[0])
			}

			return nil
		})
		require.NoError(t, err)
	})

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

	// Probe with the anonymous user so a successful sync check cannot
	// accidentally delete the rule (expects 403 once the cache has the ID).
	for _, ruleID := range []string{ruleInY, ruleInY2, ruleInZ} {
		waitForCacheSync(ctx, t, f, anonymousUser.Token, ruleID)
	}

	cases := []struct {
		name       string
		token      string
		ruleID     string
		wantStatus int
	}{
		{"AnonymousUser_DeniedNamespaceY", anonymousUser.Token, ruleInY, http.StatusForbidden},
		{"AnonymousUser_DeniedNamespaceZ", anonymousUser.Token, ruleInZ, http.StatusForbidden},
		{"ScopedUser_SucceedsNamespaceY", scopedUser.Token, ruleInY, http.StatusNoContent},
		{"ScopedUser_DeniedNamespaceZ", scopedUser.Token, ruleInZ, http.StatusForbidden},
		{"ClusterAdmin_SucceedsNamespaceZ", f.BearerToken, ruleInZ, http.StatusNoContent},
		{"ClusterAdmin_SucceedsNamespaceY", f.BearerToken, ruleInY2, http.StatusNoContent},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status := deleteAlertRuleWithToken(ctx, t, f, tc.token, tc.ruleID)
			if status != tc.wantStatus {
				t.Fatalf("Expected per-rule status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

// waitForCacheSync polls until the relabeled-rules cache has synced by
// attempting a bulk-delete probe with a non-deleting token. A 403
// (Forbidden) per-rule status indicates the rule was found in cache and
// RBAC was evaluated without mutating the rule.
func waitForCacheSync(ctx context.Context, t *testing.T, f *framework.Framework, token, ruleID string) {
	t.Helper()
	err := framework.Poll(time.Second, 30*time.Second, func() error {
		status, err := tryDeleteAlertRule(ctx, f, token, ruleID)
		if err != nil {
			return err
		}
		if status == http.StatusForbidden {
			return nil
		}
		return fmt.Errorf("per-rule status %d, waiting for cache sync", status)
	})
	if err != nil {
		t.Fatalf("Cache sync timed out for rule %s: %v", ruleID, err)
	}
}

// tryDeleteAlertRule attempts a single-rule bulk-delete and returns the per-rule
// status code without calling t.Fatal, making it suitable for polling loops.
func tryDeleteAlertRule(ctx context.Context, f *framework.Framework, token, ruleID string) (int, error) {
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
func deleteAlertRuleWithToken(ctx context.Context, t *testing.T, f *framework.Framework, token, ruleID string) int {
	t.Helper()

	status, err := tryDeleteAlertRule(ctx, f, token, ruleID)
	if err != nil {
		t.Fatalf("Delete request for rule %s failed: %v", ruleID, err)
	}
	return status
}
