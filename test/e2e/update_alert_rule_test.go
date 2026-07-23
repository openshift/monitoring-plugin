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

	osmv1 "github.com/openshift/api/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func TestUpdateAlertRule_DropRestore(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	ruleID := findPlatformAlertRuleId(t, f, ctx)
	t.Logf("Using platform rule with ID: %s", ruleID)

	defer cleanupARCsForRule(t, f, ctx, k8s.ClusterMonitoringNamespace, ruleID)

	patchDrop(t, f, ctx, ruleID, false)

	arcList, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list ARCs: %v", err)
	}

	var foundDropARC bool
	for _, arc := range arcList.Items {
		if hasDropActionForRule(arc, ruleID) {
			foundDropARC = true
			t.Logf("Found ARC %s/%s with drop action for rule %s", arc.Namespace, arc.Name, ruleID)
			break
		}
	}
	if !foundDropARC {
		t.Fatal("Expected to find an ARC with drop action after disabling rule")
	}

	patchDrop(t, f, ctx, ruleID, true)

	arcList, err = f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list ARCs after restore: %v", err)
	}

	for _, arc := range arcList.Items {
		if hasDropActionForRule(arc, ruleID) {
			t.Errorf("ARC %s/%s still has drop action after restore", arc.Namespace, arc.Name)
		}
	}

	t.Log("Drop/restore e2e test passed successfully")
}

func TestUpdateAlertRule_Classification(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	ruleID := findPlatformAlertRuleId(t, f, ctx)
	t.Logf("Using platform rule with ID: %s", ruleID)

	defer cleanupARCsForRule(t, f, ctx, k8s.ClusterMonitoringNamespace, ruleID)

	component := "networking"
	layer := "cluster"
	classificationPatch := managementrouter.AlertRuleClassificationPatch{
		Component:    &component,
		ComponentSet: true,
		Layer:        &layer,
		LayerSet:     true,
	}

	patchReq := managementrouter.BulkUpdateAlertRulesRequest{
		RuleIds:        []string{ruleID},
		Classification: &classificationPatch,
	}

	reqBody, err := json.Marshal(patchReq)
	if err != nil {
		t.Fatalf("Failed to marshal classification patch: %v", err)
	}

	patchURL := f.PluginURL + "/api/v1/alerting/rules"
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, patchURL, bytes.NewBuffer(reqBody))
	if err != nil {
		t.Fatalf("Failed to create patch request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		t.Fatalf("Failed to make classification patch request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status 200, got %d. Body: %s", resp.StatusCode, string(body))
	}

	var patchResp managementrouter.BulkUpdateAlertRulesResponse
	if err := json.NewDecoder(resp.Body).Decode(&patchResp); err != nil {
		t.Fatalf("Failed to decode patch response: %v", err)
	}

	if len(patchResp.Rules) != 1 {
		t.Fatalf("Expected 1 rule result, got %d", len(patchResp.Rules))
	}
	if patchResp.Rules[0].StatusCode != http.StatusNoContent {
		msg := ""
		if patchResp.Rules[0].Message != nil {
			msg = *patchResp.Rules[0].Message
		}
		t.Fatalf("Expected per-rule status 204, got %d: %s",
			patchResp.Rules[0].StatusCode, msg)
	}

	arcList, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list ARCs after classification: %v", err)
	}

	var foundClassificationARC bool
	for _, arc := range arcList.Items {
		if hasClassificationForRule(arc, "networking", "cluster") {
			foundClassificationARC = true
			t.Logf("Found ARC %s/%s with classification labels", arc.Namespace, arc.Name)
			break
		}
	}
	if !foundClassificationARC {
		t.Fatal("Expected to find an ARC with classification relabel configs")
	}

	t.Log("Classification e2e test passed successfully")
}

// TestRBAC_UpdateAlertRule verifies that the bulk-update endpoint enforces
// Kubernetes RBAC across three user profiles: unprivileged (403),
// namespace-scoped (204 in own namespace, 403 elsewhere), and cluster-admin
// (204 everywhere).
func TestRBAC_UpdateAlertRule(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-rbac-upd-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-rbac-upd-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	userA, err := f.CreateAnonymousUser(ctx, "e2e-rbac-upd-a", "default")
	if err != nil {
		t.Fatalf("Failed to create unprivileged user A: %v", err)
	}
	defer func() { _ = userA.Cleanup() }()

	userB, err := f.CreateScopedUser(ctx, "e2e-rbac-upd-b", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch"})
	if err != nil {
		t.Fatalf("Failed to create scoped user B: %v", err)
	}
	defer func() { _ = userB.Cleanup() }()

	ruleInY := mustCreateRule(t, f, ctx, nsY, "RBACUpdateAlertY", "e2e-rbac-upd-pr")
	t.Logf("Created rule in namespace Y: %s", ruleInY)

	ruleInZ := mustCreateRule(t, f, ctx, nsZ, "RBACUpdateAlertZ", "e2e-rbac-upd-pr")
	t.Logf("Created rule in namespace Z: %s", ruleInZ)

	ruleInY2 := mustCreateRule(t, f, ctx, nsY, "RBACUpdateAlertY2", "e2e-rbac-upd-pr")
	t.Logf("Created second rule in namespace Y: %s", ruleInY2)

	waitForUpdateCacheSync(t, f, ctx, userA.Token, ruleInY)

	cases := []struct {
		name       string
		token      string
		ruleID     string
		wantStatus int
	}{
		{"UserA_NoPerms_DeniedNamespaceY", userA.Token, ruleInY, http.StatusForbidden},
		{"UserB_ScopedPerms_SucceedsNamespaceY", userB.Token, ruleInY, http.StatusNoContent},
		{"UserB_ScopedPerms_DeniedNamespaceZ", userB.Token, ruleInZ, http.StatusForbidden},
		{"UserC_Admin_SucceedsNamespaceZ", f.BearerToken, ruleInZ, http.StatusNoContent},
		{"UserC_Admin_SucceedsNamespaceY", f.BearerToken, ruleInY2, http.StatusNoContent},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status := updateAlertRuleWithToken(t, f, ctx, tc.token, tc.ruleID)
			if status != tc.wantStatus {
				t.Fatalf("Expected per-rule status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

// waitForUpdateCacheSync polls until the relabeled-rules cache has synced by
// attempting a bulk-update probe with an unprivileged token. A 403 (Forbidden)
// per-rule status indicates the rule was found in cache and RBAC was evaluated.
func waitForUpdateCacheSync(t *testing.T, f *framework.Framework, ctx context.Context, token, ruleID string) {
	t.Helper()
	const timeout = 30 * time.Second
	const interval = time.Second
	deadline := time.Now().Add(timeout)
	for {
		status, err := tryUpdateAlertRule(f, ctx, token, ruleID)
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

// tryUpdateAlertRule attempts a single-rule bulk-update (label addition) and
// returns the per-rule status code without calling t.Fatal, making it suitable
// for polling loops.
func tryUpdateAlertRule(f *framework.Framework, ctx context.Context, token, ruleID string) (int, error) {
	labelVal := "true"
	payload := managementrouter.BulkUpdateAlertRulesRequest{
		RuleIds: []string{ruleID},
		Labels:  &map[string]*string{"e2e_rbac_probe": &labelVal},
	}
	reqBody, err := json.Marshal(payload)
	if err != nil {
		return 0, fmt.Errorf("marshal update request: %w", err)
	}
	updateURL, err := url.JoinPath(f.PluginURL, "api/v1/alerting/rules")
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

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, fmt.Errorf("expected bulk response 200, got %d: %s", resp.StatusCode, string(body))
	}

	var updateResp managementrouter.BulkUpdateAlertRulesResponse
	if err := json.NewDecoder(resp.Body).Decode(&updateResp); err != nil {
		return 0, fmt.Errorf("decode update response: %w", err)
	}
	if len(updateResp.Rules) != 1 {
		return 0, fmt.Errorf("expected 1 per-rule result, got %d", len(updateResp.Rules))
	}
	return int(updateResp.Rules[0].StatusCode), nil
}

// updateAlertRuleWithToken sends a bulk-update request for a single rule ID
// using the given bearer token and returns the per-rule HTTP status code.
func updateAlertRuleWithToken(t *testing.T, f *framework.Framework, ctx context.Context, token, ruleID string) int {
	t.Helper()

	status, err := tryUpdateAlertRule(f, ctx, token, ruleID)
	if err != nil {
		t.Fatalf("Update request for rule %s failed: %v", ruleID, err)
	}
	return status
}

func patchDrop(t *testing.T, f *framework.Framework, ctx context.Context, ruleID string, enable bool) {
	t.Helper()

	patchReq := managementrouter.BulkUpdateAlertRulesRequest{
		RuleIds:             []string{ruleID},
		AlertingRuleEnabled: &enable,
	}

	reqBody, err := json.Marshal(patchReq)
	if err != nil {
		t.Fatalf("Failed to marshal drop/restore patch: %v", err)
	}

	patchURL := f.PluginURL + "/api/v1/alerting/rules"
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, patchURL, bytes.NewBuffer(reqBody))
	if err != nil {
		t.Fatalf("Failed to create patch request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		t.Fatalf("Failed to make drop/restore request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Drop/restore: expected 200, got %d. Body: %s", resp.StatusCode, string(body))
	}
}

func hasDropActionForRule(arc osmv1.AlertRelabelConfig, ruleID string) bool {
	hasRuleID := arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey] == ruleID
	if !hasRuleID {
		return false
	}
	for _, cfg := range arc.Spec.Configs {
		if cfg.Action == "Drop" {
			return true
		}
	}
	return false
}

func hasClassificationForRule(arc osmv1.AlertRelabelConfig, component, layer string) bool {
	for _, cfg := range arc.Spec.Configs {
		if cfg.TargetLabel == "openshift_io_alert_rule_component" && cfg.Replacement == component {
			return true
		}
		if cfg.TargetLabel == "openshift_io_alert_rule_layer" && cfg.Replacement == layer {
			return true
		}
	}
	return false
}

func cleanupARCsForRule(t *testing.T, f *framework.Framework, ctx context.Context, namespace, ruleID string) {
	t.Helper()
	arcList, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Logf("cleanup: failed to list ARCs: %v", err)
		return
	}
	for _, arc := range arcList.Items {
		if arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey] == ruleID {
			if err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(namespace).Delete(ctx, arc.Name, metav1.DeleteOptions{}); err != nil {
				t.Logf("cleanup: failed to delete ARC %s/%s: %v", namespace, arc.Name, err)
			} else {
				t.Logf("cleanup: deleted ARC %s/%s for rule %s", namespace, arc.Name, ruleID)
			}
		}
	}
}
