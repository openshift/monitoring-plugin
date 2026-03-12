package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

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

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-update-drop", false)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	ruleID := createRuleViaAPI(t, f, ctx, testNamespace, "DropRestoreAlert", "e2e-update-pr")
	t.Logf("Created rule with ID: %s", ruleID)

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

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-update-class", false)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	ruleID := createRuleViaAPI(t, f, ctx, testNamespace, "ClassificationAlert", "e2e-update-pr")
	t.Logf("Created rule with ID: %s", ruleID)

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
		t.Fatalf("Expected per-rule status 204, got %d: %v",
			patchResp.Rules[0].StatusCode, patchResp.Rules[0].Message)
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
