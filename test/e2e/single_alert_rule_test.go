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
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func TestUpdateAlertRule_Single_DropRestore(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	ruleID := findPlatformAlertRuleId(ctx, t, f)
	t.Logf("Using platform rule with ID: %s", ruleID)
	defer cleanupARCsForRule(t, f, ctx, k8s.ClusterMonitoringNamespace, ruleID)

	patchDropSingle(ctx, t, f, ruleID, false)

	arcList, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list ARCs: %v", err)
	}
	foundDropARC := false
	for _, arc := range arcList.Items {
		if hasDropActionForRule(arc, ruleID) {
			foundDropARC = true
			break
		}
	}
	if !foundDropARC {
		t.Fatal("Expected ARC with drop action after single-rule disable")
	}

	patchDropSingle(ctx, t, f, ruleID, true)

	arcList, err = f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list ARCs after restore: %v", err)
	}
	for _, arc := range arcList.Items {
		if hasDropActionForRule(arc, ruleID) {
			t.Errorf("ARC %s/%s still has drop action after single-rule restore", arc.Namespace, arc.Name)
		}
	}
}

func TestUpdateAlertRule_Single_Classification(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	ruleID := findPlatformAlertRuleId(ctx, t, f)
	defer cleanupARCsForRule(t, f, ctx, k8s.ClusterMonitoringNamespace, ruleID)

	component := "networking"
	layer := "cluster"
	status, err := tryUpdateAlertRuleSingle(ctx, f, f.BearerToken, ruleID, managementrouter.UpdateAlertRuleRequest{
		Classification: &managementrouter.AlertRuleClassificationPatch{
			Component:    &component,
			ComponentSet: true,
			Layer:        &layer,
			LayerSet:     true,
		},
	})
	if err != nil {
		t.Fatalf("single classification update failed: %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", status)
	}

	arcList, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list ARCs after classification: %v", err)
	}
	found := false
	for _, arc := range arcList.Items {
		if hasClassificationForRule(arc, "networking", "cluster") {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("Expected ARC with classification labels after single-rule PATCH")
	}
}

// TestRBAC_UpdateAlertRule_Single mirrors TestRBAC_UpdateAlertRule against
// PATCH /rules/{ruleId} (HTTP status codes, not bulk per-rule envelopes).
func TestRBAC_UpdateAlertRule_Single(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}
	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-rbac-upd1-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-rbac-upd1-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	anonymousUser, err := f.CreateAnonymousUser(ctx, "e2e-rbac-upd1-a", "default")
	if err != nil {
		t.Fatalf("Failed to create anonymous user: %v", err)
	}
	defer func() { _ = anonymousUser.Cleanup() }()

	scopedUser, err := f.CreateScopedUser(ctx, "e2e-rbac-upd1-b", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch"})
	if err != nil {
		t.Fatalf("Failed to create scoped user: %v", err)
	}
	defer func() { _ = scopedUser.Cleanup() }()

	ruleInY := mustCreateRule(ctx, t, f, nsY, "RBACUpd1AlertY", "e2e-rbac-upd1-pr")
	ruleInZ := mustCreateRule(ctx, t, f, nsZ, "RBACUpd1AlertZ", "e2e-rbac-upd1-pr")
	ruleInY2 := mustCreateRule(ctx, t, f, nsY, "RBACUpd1AlertY2", "e2e-rbac-upd1-pr")

	waitForSingleUpdateCacheSync(ctx, t, f, anonymousUser.Token, ruleInY)
	waitForSingleUpdateCacheSync(ctx, t, f, anonymousUser.Token, ruleInY2)
	waitForSingleUpdateCacheSync(ctx, t, f, anonymousUser.Token, ruleInZ)

	cases := []struct {
		name       string
		token      string
		ruleID     string
		wantStatus int
	}{
		{"AnonymousUser_DeniedNamespaceY", anonymousUser.Token, ruleInY, http.StatusForbidden},
		{"AnonymousUser_DeniedNamespaceZ", anonymousUser.Token, ruleInZ, http.StatusForbidden},
		{"ScopedUser_SucceedsNamespaceY", scopedUser.Token, ruleInY, http.StatusOK},
		{"ScopedUser_DeniedNamespaceZ", scopedUser.Token, ruleInZ, http.StatusForbidden},
		{"ClusterAdmin_SucceedsNamespaceZ", f.BearerToken, ruleInZ, http.StatusOK},
		{"ClusterAdmin_SucceedsNamespaceY", f.BearerToken, ruleInY2, http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status := updateAlertRuleSingleWithToken(ctx, t, f, tc.token, tc.ruleID)
			if status != tc.wantStatus {
				t.Fatalf("Expected HTTP status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

func TestDeleteAlertRule_Single(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}
	ctx := context.Background()

	ns, cleanup, err := f.CreateUserNamespace(ctx, "test-delete-single")
	if err != nil {
		t.Fatalf("Failed to create namespace: %v", err)
	}
	defer func() { _ = cleanup() }()

	keepID := mustCreateRule(ctx, t, f, ns, "KeepSingleAlert", "e2e-delete-single-pr")
	deleteID := mustCreateRule(ctx, t, f, ns, "DeleteSingleAlert", "e2e-delete-single-pr")

	err = framework.Poll(time.Second, time.Minute, func() error {
		status, err := tryDeleteAlertRuleSingle(ctx, f, f.BearerToken, deleteID)
		if err != nil {
			return err
		}
		if status != http.StatusNoContent && status != http.StatusNotFound {
			return fmt.Errorf("expected 204 or 404, got %d", status)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("single delete failed: %v", err)
	}

	err = framework.Poll(time.Second, 20*time.Second, func() error {
		status, _, err := tryPreviewAlertRule(ctx, f, f.BearerToken, previewUpdateProbeRequest(keepID))
		if err != nil {
			return err
		}
		if status != http.StatusOK {
			return fmt.Errorf("sibling rule %s not resolvable via API after delete: expected HTTP 200, got %d", keepID, status)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("sibling rule API resolution after single delete: %v", err)
	}

	err = framework.Poll(time.Second, 20*time.Second, func() error {
		promRule, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(ns).Get(
			ctx, "e2e-delete-single-pr", metav1.GetOptions{},
		)
		if err != nil {
			return err
		}
		var remaining []string
		for _, group := range promRule.Spec.Groups {
			for _, rule := range group.Rules {
				remaining = append(remaining, rule.Alert)
			}
		}
		if len(remaining) != 1 || remaining[0] != "KeepSingleAlert" {
			return fmt.Errorf("expected only KeepSingleAlert, got %v", remaining)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("prometheusrule state after single delete: %v", err)
	}
}

// TestRBAC_DeleteAlertRule_Single mirrors TestRBAC_DeleteAlertRule against
// DELETE /rules/{ruleId}.
func TestRBAC_DeleteAlertRule_Single(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}
	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-rbac-del1-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-rbac-del1-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	anonymousUser, err := f.CreateAnonymousUser(ctx, "e2e-rbac-del1-a", "default")
	if err != nil {
		t.Fatalf("Failed to create anonymous user: %v", err)
	}
	defer func() { _ = anonymousUser.Cleanup() }()

	scopedUser, err := f.CreateScopedUser(ctx, "e2e-rbac-del1-b", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch", "delete"})
	if err != nil {
		t.Fatalf("Failed to create scoped user: %v", err)
	}
	defer func() { _ = scopedUser.Cleanup() }()

	ruleInY := mustCreateRule(ctx, t, f, nsY, "RBACDel1AlertY", "e2e-rbac-del1-pr")
	ruleInZ := mustCreateRule(ctx, t, f, nsZ, "RBACDel1AlertZ", "e2e-rbac-del1-pr")
	ruleInY2 := mustCreateRule(ctx, t, f, nsY, "RBACDel1AlertY2", "e2e-rbac-del1-pr")

	for _, ruleID := range []string{ruleInY, ruleInY2, ruleInZ} {
		waitForSingleDeleteCacheSync(ctx, t, f, anonymousUser.Token, ruleID)
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
			status := deleteAlertRuleSingleWithToken(ctx, t, f, tc.token, tc.ruleID)
			if status != tc.wantStatus {
				t.Fatalf("Expected HTTP status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

func patchDropSingle(ctx context.Context, t *testing.T, f *framework.Framework, ruleID string, enable bool) {
	t.Helper()
	status, err := tryUpdateAlertRuleSingle(ctx, f, f.BearerToken, ruleID, managementrouter.UpdateAlertRuleRequest{
		AlertingRuleEnabled: &enable,
	})
	if err != nil {
		t.Fatalf("single drop/restore request failed: %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("single drop/restore: expected HTTP 200, got %d", status)
	}
}

func waitForSingleUpdateCacheSync(ctx context.Context, t *testing.T, f *framework.Framework, token, ruleID string) {
	t.Helper()
	err := framework.Poll(time.Second, 30*time.Second, func() error {
		status, err := tryUpdateAlertRuleSingle(ctx, f, token, ruleID, probeLabelUpdateRequest())
		if err != nil {
			return err
		}
		if status == http.StatusForbidden || status == http.StatusOK {
			return nil
		}
		return fmt.Errorf("HTTP status %d, waiting for cache sync", status)
	})
	if err != nil {
		t.Fatalf("single-update cache sync timed out for %s: %v", ruleID, err)
	}
}

func waitForSingleDeleteCacheSync(ctx context.Context, t *testing.T, f *framework.Framework, token, ruleID string) {
	t.Helper()
	err := framework.Poll(time.Second, 30*time.Second, func() error {
		status, err := tryDeleteAlertRuleSingle(ctx, f, token, ruleID)
		if err != nil {
			return err
		}
		if status == http.StatusForbidden {
			return nil
		}
		return fmt.Errorf("HTTP status %d, waiting for cache sync", status)
	})
	if err != nil {
		t.Fatalf("single-delete cache sync timed out for %s: %v", ruleID, err)
	}
}

func probeLabelUpdateRequest() managementrouter.UpdateAlertRuleRequest {
	labelVal := "true"
	return managementrouter.UpdateAlertRuleRequest{
		Labels: &map[string]*string{"e2e_rbac_probe": &labelVal},
	}
}

func tryUpdateAlertRuleSingle(
	ctx context.Context,
	f *framework.Framework,
	token, ruleID string,
	payload managementrouter.UpdateAlertRuleRequest,
) (int, error) {
	reqBody, err := json.Marshal(payload)
	if err != nil {
		return 0, fmt.Errorf("marshal update request: %w", err)
	}
	updateURL, err := url.JoinPath(f.PluginURL, "api/v1/alerting/rules", ruleID)
	if err != nil {
		return 0, fmt.Errorf("build URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, updateURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return 0, fmt.Errorf("create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		return 0, fmt.Errorf("make update request: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)
	return resp.StatusCode, nil
}

func updateAlertRuleSingleWithToken(ctx context.Context, t *testing.T, f *framework.Framework, token, ruleID string) int {
	t.Helper()
	status, err := tryUpdateAlertRuleSingle(ctx, f, token, ruleID, probeLabelUpdateRequest())
	if err != nil {
		t.Fatalf("single update for rule %s failed: %v", ruleID, err)
	}
	return status
}

func tryDeleteAlertRuleSingle(ctx context.Context, f *framework.Framework, token, ruleID string) (int, error) {
	deleteURL, err := url.JoinPath(f.PluginURL, "api/v1/alerting/rules", ruleID)
	if err != nil {
		return 0, fmt.Errorf("build URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, nil)
	if err != nil {
		return 0, fmt.Errorf("create HTTP request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		return 0, fmt.Errorf("make delete request: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)
	return resp.StatusCode, nil
}

func deleteAlertRuleSingleWithToken(ctx context.Context, t *testing.T, f *framework.Framework, token, ruleID string) int {
	t.Helper()
	status, err := tryDeleteAlertRuleSingle(ctx, f, token, ruleID)
	if err != nil {
		t.Fatalf("single delete for rule %s failed: %v", ruleID, err)
	}
	return status
}
