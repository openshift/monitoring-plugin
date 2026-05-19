package e2e

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

// ==========================================================================
// Phase 10: CRUD Lifecycle (TC-052)
// ==========================================================================

func testPhase10CRUDLifecycle(f *framework.Framework) func(t *testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		t.Run("TC052_FullCRUDLifecycle", func(t *testing.T) {
			skipIfNoUWM(t)
			t.Skip("Requires single-rule PATCH /rules/{ruleId} with alertingRule body (not supported by bulk endpoint)")

			// Step 1: Create namespace
			testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-crud-lifecycle", false)
			if err != nil {
				t.Fatalf("Failed to create namespace: %v", err)
			}
			defer cleanup()

			// Step 2: Create seed PrometheusRule
			forDur := monitoringv1.Duration("5m")
			_, err = createNamedPrometheusRule(ctx, f,
				"test-lifecycle-rule", testNamespace, "lifecycle-group", nil, nil,
				monitoringv1.Rule{
					Alert: "TestLifecycleSeed",
					Expr:  intstr.FromString("vector(1)"),
					For:   &forDur,
					Labels: map[string]string{
						"severity": "warning",
					},
				},
			)
			if err != nil {
				t.Fatalf("Failed to create seed PrometheusRule: %v", err)
			}

			// Step 3: Poll until seed appears in GET /rules
			t.Log("Polling for TestLifecycleSeed to appear...")
			_ = pollForRuleID(ctx, t, f.PluginURL, "TestLifecycleSeed", 3*time.Minute)

			// Step 4: POST to create TestLifecycleCreated
			createBody := managementrouter.CreateAlertRuleRequest{
				AlertingRule: &managementrouter.AlertRuleSpec{
					Alert: strPtr("TestLifecycleCreated"),
					Expr:  strPtr("vector(2)"),
					For:   strPtr("1m"),
					Labels: &map[string]string{
						"severity": "info",
					},
				},
				PrometheusRule: &managementrouter.PrometheusRuleTarget{
					PrometheusRuleName:      "test-lifecycle-rule",
					PrometheusRuleNamespace: testNamespace,
				},
			}

			statusCode, respBody, err := postRule(ctx, f.PluginURL, createBody)
			if err != nil {
				t.Fatalf("POST /rules failed: %v", err)
			}
			if statusCode != http.StatusCreated {
				t.Fatalf("Expected HTTP 201, got %d: %s", statusCode, string(respBody))
			}

			var createResp managementrouter.CreateAlertRuleResponse
			if err := json.Unmarshal(respBody, &createResp); err != nil {
				t.Fatalf("Failed to parse create response: %v", err)
			}
			if createResp.Id == "" {
				t.Fatal("Expected non-empty id from create")
			}
			t.Logf("Step 4: Created rule with ID: %s", createResp.Id)

			// Step 5: Poll until created rule appears
			createdID := pollForRuleID(ctx, t, f.PluginURL, "TestLifecycleCreated", 3*time.Minute)
			t.Logf("Step 5: TestLifecycleCreated appeared with ID: %s", createdID)

			// Newly created rule already has correct ID stamped. Just refresh.
			createdID = refreshRuleID(ctx, t, f.PluginURL, "TestLifecycleCreated")
			t.Logf("Step 5b: Confirmed createdID: %s", createdID)

			// Step 6: PATCH to update labels
			patchBody := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "TestLifecycleCreated",
					"expr":  "vector(2)",
					"for":   "1m",
					"labels": map[string]string{
						"severity": "info",
						"team":     "lifecycle",
					},
				},
			}

			httpStatus, patchResp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, createdID, patchBody)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchSuccess(t, httpStatus, patchResp)

			newID := patchResp.Id
			t.Logf("Step 6: Updated rule, new ID: %s", newID)

			// Step 7: DELETE the updated rule
			resultStatus, err := deleteSingleRuleViaBulk(ctx, f.PluginURL, newID)
			if err != nil {
				t.Fatalf("DELETE failed: %v", err)
			}
			if resultStatus != http.StatusNoContent {
				t.Fatalf("Expected result status 204, got %d", resultStatus)
			}
			t.Log("Step 7: Deleted rule successfully")

			// Step 8: Dual verify - only seed rule remains
			pr, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(testNamespace).Get(
				ctx, "test-lifecycle-rule", metav1.GetOptions{},
			)
			if err != nil {
				t.Fatalf("Failed to get PrometheusRule: %v", err)
			}

			remainingAlerts := []string{}
			for _, group := range pr.Spec.Groups {
				for _, rule := range group.Rules {
					remainingAlerts = append(remainingAlerts, rule.Alert)
				}
			}

			if len(remainingAlerts) != 1 {
				t.Fatalf("Expected 1 remaining rule, got %d: %v", len(remainingAlerts), remainingAlerts)
			}
			if remainingAlerts[0] != "TestLifecycleSeed" {
				t.Errorf("Expected TestLifecycleSeed to remain, got %s", remainingAlerts[0])
			}

			t.Log("Step 8: Dual verification passed - only TestLifecycleSeed remains")
		})
	}
}
