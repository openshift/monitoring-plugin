package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

// ==========================================================================
// Phase 4: POST /rules (TC-024 to TC-030)
// ==========================================================================

func testPhase4Create(f *framework.Framework, ids *seedRuleIDs) func(t *testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		t.Run("TC024_CreateUserDefinedRule", func(t *testing.T) {
				skipIfNoUWM(t)

			body := managementrouter.CreateAlertRuleRequest{
				AlertingRule: &managementrouter.AlertRuleSpec{
					Alert: strPtr("TestCreatedUserAlert"),
					Expr:  strPtr("vector(2)"),
					For:   strPtr("1m"),
					Labels: &map[string]string{
						"severity":     "warning",
						"test_created": "true",
					},
				},
				PrometheusRule: &managementrouter.PrometheusRuleTarget{
					PrometheusRuleName:      "test-user-rule",
					PrometheusRuleNamespace: userSeedNamespace,
				},
			}

			statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("POST /rules failed: %v", err)
			}
			if statusCode != http.StatusCreated {
				t.Fatalf("Expected HTTP 201, got %d: %s", statusCode, string(respBody))
			}

			var createResp managementrouter.CreateAlertRuleResponse
			if err := json.Unmarshal(respBody, &createResp); err != nil {
				t.Fatalf("Failed to parse response: %v", err)
			}
			if createResp.Id == "" {
				t.Fatal("Expected non-empty id in response")
			}
			ids.CreatedUserRule = createResp.Id
			t.Logf("Created user rule with ID: %s", createResp.Id)

			// Dual verify: check K8s PrometheusRule CR
			pr, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(userSeedNamespace).Get(ctx, "test-user-rule", metav1.GetOptions{})
			if err != nil {
				t.Fatalf("Failed to get PrometheusRule: %v", err)
			}
			found := false
			for _, group := range pr.Spec.Groups {
				for _, rule := range group.Rules {
					if rule.Alert == "TestCreatedUserAlert" {
						found = true
					}
				}
			}
			if !found {
				t.Error("TestCreatedUserAlert not found in PrometheusRule CR")
			}
		})

		t.Run("TC025_CreatePlatformRule", func(t *testing.T) {
			uniqueExpr := fmt.Sprintf("vector(%d)", time.Now().UnixNano()%100000)
			body := managementrouter.CreateAlertRuleRequest{
				AlertingRule: &managementrouter.AlertRuleSpec{
					Alert: strPtr("TestCreatedPlatformAlert"),
					Expr:  strPtr(uniqueExpr),
					For:   strPtr("5m"),
					Labels: &map[string]string{
						"severity": "info",
					},
				},
				// No PrometheusRule => creates platform AlertingRule CR
			}

			statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("POST /rules failed: %v", err)
			}
			if statusCode != http.StatusCreated {
				t.Fatalf("Expected HTTP 201, got %d: %s", statusCode, string(respBody))
			}

			var createResp managementrouter.CreateAlertRuleResponse
			if err := json.Unmarshal(respBody, &createResp); err != nil {
				t.Fatalf("Failed to parse response: %v", err)
			}
			ids.CreatedPlatformRule = createResp.Id
			t.Logf("Created platform rule with ID: %s", createResp.Id)
		})

		t.Run("TC026_CreateInGitOpsPR", func(t *testing.T) {
			body := managementrouter.CreateAlertRuleRequest{
				AlertingRule: &managementrouter.AlertRuleSpec{
					Alert: strPtr("TestGitOpsBlocked"),
					Expr:  strPtr("vector(1)"),
					For:   strPtr("1m"),
					Labels: &map[string]string{
						"severity": "warning",
					},
				},
				PrometheusRule: &managementrouter.PrometheusRuleTarget{
					PrometheusRuleName:      "test-gitops-user-rule",
					PrometheusRuleNamespace: userSeedNamespace,
				},
			}

			statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("POST /rules failed: %v", err)
			}
			if statusCode != http.StatusMethodNotAllowed {
				t.Fatalf("Expected HTTP 405, got %d: %s", statusCode, string(respBody))
			}
		})

		t.Run("TC027_CreateInOperatorPR", func(t *testing.T) {
			body := managementrouter.CreateAlertRuleRequest{
				AlertingRule: &managementrouter.AlertRuleSpec{
					Alert: strPtr("TestOperatorBlocked"),
					Expr:  strPtr("vector(1)"),
					For:   strPtr("1m"),
					Labels: &map[string]string{
						"severity": "warning",
					},
				},
				PrometheusRule: &managementrouter.PrometheusRuleTarget{
					PrometheusRuleName:      "test-operator-managed-user-rule",
					PrometheusRuleNamespace: userSeedNamespace,
				},
			}

			statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("POST /rules failed: %v", err)
			}
			if statusCode != http.StatusMethodNotAllowed {
				t.Fatalf("Expected HTTP 405, got %d: %s", statusCode, string(respBody))
			}
		})

		t.Run("TC028_CreateInPlatformNS", func(t *testing.T) {
			body := managementrouter.CreateAlertRuleRequest{
				AlertingRule: &managementrouter.AlertRuleSpec{
					Alert: strPtr("TestPlatformNSBlocked"),
					Expr:  strPtr("vector(1)"),
					For:   strPtr("1m"),
					Labels: &map[string]string{
						"severity": "warning",
					},
				},
				PrometheusRule: &managementrouter.PrometheusRuleTarget{
					PrometheusRuleName:      "test-user-platform-rule",
					PrometheusRuleNamespace: k8s.ClusterMonitoringNamespace,
				},
			}

			statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("POST /rules failed: %v", err)
			}
			if statusCode != http.StatusMethodNotAllowed {
				t.Fatalf("Expected HTTP 405, got %d: %s", statusCode, string(respBody))
			}
		})

		t.Run("TC029_CreateDuplicate", func(t *testing.T) {
			body := managementrouter.CreateAlertRuleRequest{
				AlertingRule: &managementrouter.AlertRuleSpec{
					Alert: strPtr("TestUserAlert"),
					Expr:  strPtr("vector(1)"),
					For:   strPtr("5m"),
					Labels: &map[string]string{
						"severity": "warning",
					},
				},
				PrometheusRule: &managementrouter.PrometheusRuleTarget{
					PrometheusRuleName:      "test-user-rule",
					PrometheusRuleNamespace: userSeedNamespace,
				},
			}

			statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("POST /rules failed: %v", err)
			}
			if statusCode != http.StatusConflict {
				t.Fatalf("Expected HTTP 409, got %d: %s", statusCode, string(respBody))
			}
		})

		t.Run("TC030_CreateInputValidation", func(t *testing.T) {
			t.Run("TC030a_MissingAlertingRule", func(t *testing.T) {
				body := managementrouter.CreateAlertRuleRequest{
					PrometheusRule: &managementrouter.PrometheusRuleTarget{
						PrometheusRuleName:      "test-user-rule",
						PrometheusRuleNamespace: userSeedNamespace,
					},
				}

				statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
				if err != nil {
					t.Fatalf("POST /rules failed: %v", err)
				}
				if statusCode != http.StatusBadRequest {
					t.Fatalf("Expected HTTP 400, got %d: %s", statusCode, string(respBody))
				}
			})

			t.Run("TC030b_MissingPrometheusRule", func(t *testing.T) {
				// POST with only alertingRule (no prometheusRule) -> HTTP 201 per actual code
				uniqueExpr := fmt.Sprintf("vector(%d)", time.Now().UnixNano()%100000+1)
				body := managementrouter.CreateAlertRuleRequest{
					AlertingRule: &managementrouter.AlertRuleSpec{
						Alert: strPtr("TestTC030bPlatformAlert"),
						Expr:  strPtr(uniqueExpr),
						For:   strPtr("5m"),
						Labels: &map[string]string{
							"severity": "info",
						},
					},
				}

				statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
				if err != nil {
					t.Fatalf("POST /rules failed: %v", err)
				}
				if statusCode != http.StatusCreated {
					t.Fatalf("Expected HTTP 201, got %d: %s", statusCode, string(respBody))
				}
			})

			t.Run("TC030c_InvalidJSON", func(t *testing.T) {
				req, err := http.NewRequestWithContext(ctx, http.MethodPost, f.PluginURL+"/api/v1/alerting/rules",
					strings.NewReader("{invalid"))
				if err != nil {
					t.Fatalf("Failed to create request: %v", err)
				}
				req.Header.Set("Content-Type", "application/json")
				if token := getBearerToken(); token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
				}

				resp, err := stpHTTPClient().Do(req)
				if err != nil {
					t.Fatalf("Raw POST failed: %v", err)
				}
				defer resp.Body.Close()
				body, _ := io.ReadAll(resp.Body)

				if resp.StatusCode != http.StatusBadRequest {
					t.Fatalf("Expected HTTP 400, got %d: %s", resp.StatusCode, string(body))
				}
			})
		})
	}
}

// ==========================================================================
// Phase 5: Classification PATCH (TC-031 to TC-035)
// ==========================================================================

func testPhase5Classification(f *framework.Framework, ids *seedRuleIDs) func(t *testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		t.Run("TC031_ClassifyPlatformOperatorManaged", func(t *testing.T) {
			body := map[string]interface{}{
				"classification": map[string]interface{}{
					"openshift_io_alert_rule_component": "infrastructure",
					"openshift_io_alert_rule_layer":     "cluster",
				},
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.Watchdog, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchSuccess(t, httpStatus, resp)
		})

		t.Run("TC032_ClassifyPlatformUnmanaged", func(t *testing.T) {
			ids.PlatformRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserPlatformAlert")
			body := map[string]interface{}{
				"classification": map[string]interface{}{
					"openshift_io_alert_rule_component": "networking",
					"openshift_io_alert_rule_layer":     "namespace",
				},
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.PlatformRule, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchSuccess(t, httpStatus, resp)
		})

		t.Run("TC033_ClassifyUserDefined", func(t *testing.T) {
				skipIfNoUWM(t)

			ids.UserRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserAlert")
			body := map[string]interface{}{
				"classification": map[string]interface{}{
					"openshift_io_alert_rule_component": "networking",
					"openshift_io_alert_rule_layer":     "namespace",
				},
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.UserRule, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchStatusCode(t, httpStatus, resp, http.StatusMethodNotAllowed)
		})

		t.Run("TC034_ClassifyOperatorManaged", func(t *testing.T) {
				skipIfNoUWM(t)

			ids.OperatorManaged = refreshRuleID(ctx, t, f.PluginURL, "TestOperatorManagedUserAlert")
			body := map[string]interface{}{
				"classification": map[string]interface{}{
					"openshift_io_alert_rule_component": "networking",
					"openshift_io_alert_rule_layer":     "namespace",
				},
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.OperatorManaged, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchStatusCode(t, httpStatus, resp, http.StatusMethodNotAllowed)
		})

		t.Run("TC035_ClassifyGitOps", func(t *testing.T) {
				skipIfNoUWM(t)

			ids.GitOpsRule = refreshRuleID(ctx, t, f.PluginURL, "TestGitOpsUserAlert")
			body := map[string]interface{}{
				"classification": map[string]interface{}{
					"openshift_io_alert_rule_component": "networking",
					"openshift_io_alert_rule_layer":     "namespace",
				},
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.GitOpsRule, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchStatusCode(t, httpStatus, resp, http.StatusMethodNotAllowed)
		})
	}
}

// ==========================================================================
// Phase 6: Single Update PATCH (TC-036 to TC-040)
// ==========================================================================

func testPhase6SingleUpdate(f *framework.Framework, ids *seedRuleIDs) func(t *testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		t.Run("TC036_UpdateUserDefined", func(t *testing.T) {
				skipIfNoUWM(t)
			t.Skip("Requires single-rule PATCH /rules/{ruleId} with alertingRule body (not supported by bulk endpoint)")

			ids.UserRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserAlert")
			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "TestUserAlert",
					"expr":  "vector(1) > 0",
					"for":   "2m",
					"labels": map[string]string{
						"severity": "critical",
						"team":     "test",
					},
					"annotations": map[string]string{
						"summary": "Updated test alert",
					},
				},
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.UserRule, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchSuccess(t, httpStatus, resp)

			// Update the seed rule ID (it changes after update)
			if resp.Id != "" {
				t.Logf("UserRule ID changed from %s to %s", ids.UserRule, resp.Id)
				ids.UserRule = resp.Id
			}

			// Dual verify: check K8s PrometheusRule CR
			pr, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(userSeedNamespace).Get(ctx, "test-user-rule", metav1.GetOptions{})
			if err != nil {
				t.Fatalf("Failed to get PrometheusRule: %v", err)
			}
			for _, group := range pr.Spec.Groups {
				for _, rule := range group.Rules {
					if rule.Alert == "TestUserAlert" {
						if rule.Labels["severity"] != "critical" {
							t.Errorf("Expected severity=critical, got %s", rule.Labels["severity"])
						}
						if rule.Labels["team"] != "test" {
							t.Errorf("Expected team=test, got %s", rule.Labels["team"])
						}
					}
				}
			}
		})

		t.Run("TC037_DisablePlatformRule", func(t *testing.T) {
			body := map[string]interface{}{
				"AlertingRuleEnabled": false,
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.Watchdog, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchSuccess(t, httpStatus, resp)
		})

		t.Run("TC038_ReenablePlatformRule", func(t *testing.T) {
			body := map[string]interface{}{
				"AlertingRuleEnabled": true,
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.Watchdog, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchSuccess(t, httpStatus, resp)
		})

		t.Run("TC039_DisableUserDefined", func(t *testing.T) {
				skipIfNoUWM(t)

			ids.UserRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserAlert")
			body := map[string]interface{}{
				"AlertingRuleEnabled": false,
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.UserRule, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchStatusCode(t, httpStatus, resp, http.StatusMethodNotAllowed)
		})

		t.Run("TC040_CombinedClassificationEnable", func(t *testing.T) {
			body := map[string]interface{}{
				"AlertingRuleEnabled": true,
				"classification": map[string]interface{}{
					"openshift_io_alert_rule_component": "infrastructure",
					"openshift_io_alert_rule_layer":     "cluster",
				},
			}

			httpStatus, resp, err := patchSingleRuleViaBulk(ctx, f.PluginURL, ids.Watchdog, body)
			if err != nil {
				t.Fatalf("PATCH failed: %v", err)
			}
			assertPatchSuccess(t, httpStatus, resp)
		})
	}
}

// ==========================================================================
// Phase 7: Bulk Update PATCH (TC-041 to TC-046)
// ==========================================================================

func testPhase7BulkUpdate(f *framework.Framework, ids *seedRuleIDs) func(t *testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Refresh rule IDs — they may have changed after relabeled cache re-sync
		ids.UserRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserAlert")
		ids.GitOpsRule = refreshRuleID(ctx, t, f.PluginURL, "TestGitOpsUserAlert")

		t.Run("TC041_BulkLabelUpdate", func(t *testing.T) {
			body := map[string]interface{}{
				"ruleIds": []string{ids.Watchdog, ids.UserRule},
				"labels": map[string]*string{
					"bulk_test_label": strPtr("yes"),
				},
			}

			httpStatus, resp, err := patchRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("PATCH /rules bulk failed: %v", err)
			}
			if httpStatus != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", httpStatus)
			}

			if len(resp.Rules) != 2 {
				t.Fatalf("Expected 2 rule results, got %d", len(resp.Rules))
			}

			// Update UserRule ID if it changed
			for _, r := range resp.Rules {
				if r.Id != ids.Watchdog && r.Id != ids.UserRule && r.StatusCode == http.StatusNoContent {
					t.Logf("UserRule ID changed during bulk update to %s", r.Id)
					ids.UserRule = r.Id
				}
			}
		})

		// Wait for Prometheus to re-evaluate rules after TC-041 label changes
		oldUserID := ids.UserRule
		ids.UserRule = waitForIDChange(ctx, t, f.PluginURL, "TestUserAlert", oldUserID)

		t.Run("TC042_BulkDisable", func(t *testing.T) {
			ids.PlatformRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserPlatformAlert")
			body := map[string]interface{}{
				"ruleIds":             []string{ids.Watchdog, ids.PlatformRule},
				"AlertingRuleEnabled": false,
			}

			httpStatus, resp, err := patchRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("PATCH /rules bulk failed: %v", err)
			}
			if httpStatus != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", httpStatus)
			}

			for _, r := range resp.Rules {
				if r.StatusCode != http.StatusNoContent {
					t.Errorf("Rule %s: expected inner 204, got %d (message: %v)", r.Id, r.StatusCode, r.Message)
				}
			}
		})

		t.Run("TC043_BulkReEnable", func(t *testing.T) {
			ids.PlatformRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserPlatformAlert")
			body := map[string]interface{}{
				"ruleIds":             []string{ids.Watchdog, ids.PlatformRule},
				"AlertingRuleEnabled": true,
			}

			httpStatus, resp, err := patchRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("PATCH /rules bulk failed: %v", err)
			}
			if httpStatus != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", httpStatus)
			}

			for _, r := range resp.Rules {
				if r.StatusCode != http.StatusNoContent {
					t.Errorf("Rule %s: expected inner 204, got %d (message: %v)", r.Id, r.StatusCode, r.Message)
				}
			}
		})

		t.Run("TC044_BulkClassification", func(t *testing.T) {
				skipIfNoUWM(t)

			ids.UserRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserAlert")
			body := map[string]interface{}{
				"ruleIds": []string{ids.Watchdog, ids.UserRule},
				"classification": map[string]interface{}{
					"openshift_io_alert_rule_component": "infra",
					"openshift_io_alert_rule_layer":     "cluster",
				},
			}

			httpStatus, resp, err := patchRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("PATCH /rules bulk failed: %v", err)
			}
			if httpStatus != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", httpStatus)
			}

			for _, r := range resp.Rules {
				if r.Id == ids.Watchdog && r.StatusCode != http.StatusNoContent {
					t.Errorf("Watchdog: expected inner 204, got %d", r.StatusCode)
				}
				if r.Id == ids.UserRule && r.StatusCode != http.StatusMethodNotAllowed {
					t.Errorf("UserRule: expected inner 405, got %d", r.StatusCode)
				}
			}
		})

		t.Run("TC045_BulkPartialFailure", func(t *testing.T) {
				skipIfNoUWM(t)

			ids.UserRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserAlert")
			ids.GitOpsRule = refreshRuleID(ctx, t, f.PluginURL, "TestGitOpsUserAlert")
			body := map[string]interface{}{
				"ruleIds": []string{ids.UserRule, ids.GitOpsRule},
				"labels": map[string]*string{
					"partial_test": strPtr("yes"),
				},
			}

			httpStatus, resp, err := patchRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("PATCH /rules bulk failed: %v", err)
			}
			if httpStatus != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", httpStatus)
			}

			for _, r := range resp.Rules {
				if r.Id == ids.UserRule || (r.StatusCode == http.StatusNoContent && r.Id != ids.GitOpsRule) {
					if r.StatusCode != http.StatusNoContent {
						t.Errorf("UserRule: expected inner 204, got %d", r.StatusCode)
					}
					// Update UserRule ID if it changed
					if r.Id != ids.UserRule {
						t.Logf("UserRule ID changed to %s", r.Id)
						ids.UserRule = r.Id
					}
				}
				if r.Id == ids.GitOpsRule && r.StatusCode != http.StatusMethodNotAllowed {
					t.Errorf("GitOpsRule: expected inner 405, got %d", r.StatusCode)
				}
			}
		})

		t.Run("TC046_BulkLabelRemoval", func(t *testing.T) {
				skipIfNoUWM(t)

			ids.UserRule = refreshRuleID(ctx, t, f.PluginURL, "TestUserAlert")
			body := map[string]interface{}{
				"ruleIds": []string{ids.UserRule},
				"labels": map[string]*string{
					"bulk_test_label": nil,
				},
			}

			httpStatus, resp, err := patchRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("PATCH /rules bulk failed: %v", err)
			}
			if httpStatus != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", httpStatus)
			}

			for _, r := range resp.Rules {
				if r.StatusCode != http.StatusNoContent {
					t.Errorf("Rule %s: expected inner 204, got %d", r.Id, r.StatusCode)
				}
				// Update UserRule ID if it changed
				if r.Id != ids.UserRule && r.StatusCode == http.StatusNoContent {
					ids.UserRule = r.Id
				}
			}

			// Dual verify: check K8s PrometheusRule CR for label removal
			pr, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(userSeedNamespace).Get(ctx, "test-user-rule", metav1.GetOptions{})
			if err != nil {
				t.Fatalf("Failed to get PrometheusRule: %v", err)
			}
			for _, group := range pr.Spec.Groups {
				for _, rule := range group.Rules {
					if rule.Alert == "TestUserAlert" {
						if _, exists := rule.Labels["bulk_test_label"]; exists {
							t.Error("Expected bulk_test_label to be removed")
						}
					}
				}
			}
		})
	}
}

// ==========================================================================
// Phase 8: Single Delete (TC-047 to TC-048)
// ==========================================================================

func testPhase8SingleDelete(f *framework.Framework, ids *seedRuleIDs) func(t *testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		t.Run("TC047_DeleteUserDefined", func(t *testing.T) {
			if ids.CreatedUserRule == "" {
				t.Skip("No created user rule ID (TC-024 may not have run)")
			}

			ids.CreatedUserRule = refreshRuleID(ctx, t, f.PluginURL, "TestCreatedUserAlert")
			resultStatus, err := deleteSingleRuleViaBulk(ctx, f.PluginURL, ids.CreatedUserRule)
			if err != nil {
				t.Fatalf("DELETE /rules/%s failed: %v", ids.CreatedUserRule, err)
			}
			if resultStatus != http.StatusNoContent {
				t.Fatalf("Expected result status 204, got %d", resultStatus)
			}

			// Dual verify: check K8s PrometheusRule CR
			pr, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(userSeedNamespace).Get(ctx, "test-user-rule", metav1.GetOptions{})
			if err != nil {
				t.Fatalf("Failed to get PrometheusRule: %v", err)
			}
			for _, group := range pr.Spec.Groups {
				for _, rule := range group.Rules {
					if rule.Alert == "TestCreatedUserAlert" {
						t.Error("TestCreatedUserAlert should have been deleted from PR")
					}
				}
			}
		})

		t.Run("TC048_DeleteGitOps", func(t *testing.T) {
			ids.GitOpsRule = refreshRuleID(ctx, t, f.PluginURL, "TestGitOpsUserAlert")
			resultStatus, err := deleteSingleRuleViaBulk(ctx, f.PluginURL, ids.GitOpsRule)
			if err != nil {
				t.Fatalf("DELETE GitOps rule failed: %v", err)
			}
			if resultStatus != http.StatusMethodNotAllowed {
				t.Fatalf("Expected result status 405, got %d", resultStatus)
			}
		})
	}
}

// ==========================================================================
// Phase 9: Bulk Delete (TC-049 to TC-051)
// ==========================================================================

func testPhase9BulkDelete(f *framework.Framework, ids *seedRuleIDs) func(t *testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		t.Run("TC049_BulkDeleteUserDefined", func(t *testing.T) {
				skipIfNoUWM(t)

			// Create 2 temporary rules
			for _, alertName := range []string{"TestBulkDeleteTmp1", "TestBulkDeleteTmp2"} {
				body := managementrouter.CreateAlertRuleRequest{
					AlertingRule: &managementrouter.AlertRuleSpec{
						Alert: strPtr(alertName),
						Expr:  strPtr("vector(1)"),
						For:   strPtr("1m"),
						Labels: &map[string]string{
							"severity": "info",
						},
					},
					PrometheusRule: &managementrouter.PrometheusRuleTarget{
						PrometheusRuleName:      "test-user-rule",
						PrometheusRuleNamespace: userSeedNamespace,
					},
				}
				statusCode, respBody, err := postRule(ctx, f.PluginURL, body)
				if err != nil {
					t.Fatalf("POST /rules failed for %s: %v", alertName, err)
				}
				if statusCode != http.StatusCreated {
					t.Fatalf("Expected HTTP 201 for %s, got %d: %s", alertName, statusCode, string(respBody))
				}
			}

			// Poll for both rule IDs
			id1 := pollForRuleID(ctx, t, f.PluginURL, "TestBulkDeleteTmp1", 3*time.Minute)
			id2 := pollForRuleID(ctx, t, f.PluginURL, "TestBulkDeleteTmp2", 3*time.Minute)

			// Wait for Prometheus to re-evaluate with stamped IDs
			id1 = waitForIDChange(ctx, t, f.PluginURL, "TestBulkDeleteTmp1", id1)
			id2 = waitForIDChange(ctx, t, f.PluginURL, "TestBulkDeleteTmp2", id2)

			// Bulk delete
			body := managementrouter.BulkDeleteAlertRulesRequest{
				RuleIds: []string{id1, id2},
			}

			statusCode, resp, err := deleteRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("DELETE /rules bulk failed: %v", err)
			}
			if statusCode != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", statusCode)
			}

			for _, r := range resp.Rules {
				if r.StatusCode != http.StatusNoContent {
					t.Errorf("Rule %s: expected 204, got %d (message: %v)", r.Id, r.StatusCode, r.Message)
				}
			}

			// Dual verify
			pr, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(userSeedNamespace).Get(ctx, "test-user-rule", metav1.GetOptions{})
			if err != nil {
				t.Fatalf("Failed to get PrometheusRule: %v", err)
			}
			for _, group := range pr.Spec.Groups {
				for _, rule := range group.Rules {
					if rule.Alert == "TestBulkDeleteTmp1" || rule.Alert == "TestBulkDeleteTmp2" {
						t.Errorf("Rule %s should have been deleted", rule.Alert)
					}
				}
			}
		})

		t.Run("TC050_BulkDeletePartialFailure", func(t *testing.T) {
				skipIfNoUWM(t)

			// Create 1 temporary user rule
			createBody := managementrouter.CreateAlertRuleRequest{
				AlertingRule: &managementrouter.AlertRuleSpec{
					Alert: strPtr("TestBulkDeletePartial"),
					Expr:  strPtr("vector(1)"),
					For:   strPtr("1m"),
					Labels: &map[string]string{
						"severity": "info",
					},
				},
				PrometheusRule: &managementrouter.PrometheusRuleTarget{
					PrometheusRuleName:      "test-user-rule",
					PrometheusRuleNamespace: userSeedNamespace,
				},
			}
			statusCode, respBody, err := postRule(ctx, f.PluginURL, createBody)
			if err != nil {
				t.Fatalf("POST /rules failed: %v", err)
			}
			if statusCode != http.StatusCreated {
				t.Fatalf("Expected HTTP 201, got %d: %s", statusCode, string(respBody))
			}

			tempID := pollForRuleID(ctx, t, f.PluginURL, "TestBulkDeletePartial", 3*time.Minute)

			// Wait for Prometheus to re-evaluate with stamped IDs
			tempID = waitForIDChange(ctx, t, f.PluginURL, "TestBulkDeletePartial", tempID)
			ids.GitOpsRule = refreshRuleID(ctx, t, f.PluginURL, "TestGitOpsUserAlert")

			body := managementrouter.BulkDeleteAlertRulesRequest{
				RuleIds: []string{tempID, ids.GitOpsRule},
			}

			statusCode, resp, err := deleteRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("DELETE /rules bulk failed: %v", err)
			}
			if statusCode != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", statusCode)
			}

			for _, r := range resp.Rules {
				if r.Id == tempID && r.StatusCode != http.StatusNoContent {
					t.Errorf("Temp rule: expected 204, got %d", r.StatusCode)
				}
				if r.Id == ids.GitOpsRule && r.StatusCode != http.StatusMethodNotAllowed {
					t.Errorf("GitOps rule: expected 405, got %d", r.StatusCode)
				}
			}
		})

		t.Run("TC051_BulkDeleteNonexistent", func(t *testing.T) {
			body := managementrouter.BulkDeleteAlertRulesRequest{
				RuleIds: []string{"nonexistent-id-1", "nonexistent-id-2"},
			}

			statusCode, resp, err := deleteRulesBulk(ctx, f.PluginURL, body)
			if err != nil {
				t.Fatalf("DELETE /rules bulk failed: %v", err)
			}
			if statusCode != http.StatusOK {
				t.Fatalf("Expected HTTP 200, got %d", statusCode)
			}

			for _, r := range resp.Rules {
				if r.StatusCode == http.StatusNoContent {
					t.Errorf("Rule %s: expected non-204 status for nonexistent ID, got 204", r.Id)
				}
			}
		})
	}
}

// suppress unused import warnings
var (
	_ = fmt.Sprintf
	_ = strings.NewReader
	_ = io.ReadAll
)
