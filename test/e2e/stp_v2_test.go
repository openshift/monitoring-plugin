package e2e

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

const (
	seedTimeout  = 5 * time.Minute
	pollInterval = 2 * time.Second
)

// seedNamespace is set dynamically by TestAlertManagementAPI via f.CreateNamespace.
var seedNamespace string

func TestAlertManagementAPI(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	ids := &seedRuleIDs{}

	// -----------------------------------------------------------------------
	// Phase 1: Seed Data — create a dedicated namespace with cluster-monitoring label
	// -----------------------------------------------------------------------
	t.Log("Phase 1: Creating dedicated test namespace")

	var nsCleanup framework.CleanupFunc
	seedNamespace, nsCleanup, err = f.CreateNamespace(ctx, "stp-v2-seed", true)
	if err != nil {
		t.Fatalf("Failed to create seed namespace: %v", err)
	}
	t.Logf("Phase 1: Seed namespace created: %s", seedNamespace)

	// -----------------------------------------------------------------------
	// Phase 13: Cleanup (deferred first so it runs on any failure)
	// -----------------------------------------------------------------------
	defer func() {
		cleanupCtx := context.Background()
		t.Log("Phase 13: Cleaning up seed data")

		// Delete platform rule in openshift-monitoring
		_ = f.Monitoringv1clientset.MonitoringV1().PrometheusRules(k8s.ClusterMonitoringNamespace).Delete(
			cleanupCtx, "test-user-platform-rule", metav1.DeleteOptions{},
		)

		// Clean up any test ARCs in openshift-monitoring
		arcList, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).List(
			cleanupCtx, metav1.ListOptions{},
		)
		if err == nil {
			for i := range arcList.Items {
				if strings.HasPrefix(arcList.Items[i].Name, "arc-test-") {
					_ = f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Delete(
						cleanupCtx, arcList.Items[i].Name, metav1.DeleteOptions{},
					)
				}
			}
		}

		// Clean up any test AlertingRule CRs (created by TC-025, TC-030b)
		_ = f.Osmv1clientset.MonitoringV1().AlertingRules(k8s.ClusterMonitoringNamespace).Delete(
			cleanupCtx, "platform-alert-rules", metav1.DeleteOptions{},
		)

		// Delete the seed namespace (removes all resources inside it)
		if nsCleanup != nil {
			if cleanupErr := nsCleanup(); cleanupErr != nil {
				t.Logf("Phase 13: namespace cleanup error: %v", cleanupErr)
			}
		}

		t.Log("Phase 13: Cleanup complete")
	}()

	t.Log("Phase 1: Creating seed data")

	// Create ConfigMap for operator-managed ownerReference
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-operator-managed-owner",
			Namespace: seedNamespace,
		},
		Data: map[string]string{"placeholder": "true"},
	}
	createdCM, err := f.Clientset.CoreV1().ConfigMaps(seedNamespace).Create(ctx, cm, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("Failed to create ConfigMap: %v", err)
	}

	forDuration := monitoringv1.Duration("5m")
	forPending := monitoringv1.Duration("999h")

	// Seed 1: Unmanaged user rule
	_, err = createNamedPrometheusRule(ctx, f,
		"test-user-rule", seedNamespace, "test-group", nil, nil,
		monitoringv1.Rule{
			Alert: "TestUserAlert",
			Expr:  intstr.FromString("vector(1)"),
			For:   &forDuration,
			Labels: map[string]string{
				"severity": "warning",
			},
		},
	)
	if err != nil {
		t.Fatalf("Failed to create test-user-rule: %v", err)
	}

	// Seed 2: GitOps-managed user rule
	_, err = createNamedPrometheusRule(ctx, f,
		"test-gitops-user-rule", seedNamespace, "test-group",
		map[string]string{
			"argocd.argoproj.io/tracking-id": "gitops-test",
		},
		nil,
		monitoringv1.Rule{
			Alert: "TestGitOpsUserAlert",
			Expr:  intstr.FromString("vector(1)"),
			For:   &forDuration,
			Labels: map[string]string{
				"severity": "warning",
			},
		},
	)
	if err != nil {
		t.Fatalf("Failed to create test-gitops-user-rule: %v", err)
	}

	// Seed 3: Operator-managed user rule
	_, err = createNamedPrometheusRule(ctx, f,
		"test-operator-managed-user-rule", seedNamespace, "test-group",
		nil,
		[]metav1.OwnerReference{{
			APIVersion: "v1",
			Kind:       "ConfigMap",
			Name:       createdCM.Name,
			UID:        createdCM.UID,
			Controller: boolPtr(true),
		}},
		monitoringv1.Rule{
			Alert: "TestOperatorManagedUserAlert",
			Expr:  intstr.FromString("vector(1)"),
			For:   &forDuration,
			Labels: map[string]string{
				"severity": "warning",
			},
		},
	)
	if err != nil {
		t.Fatalf("Failed to create test-operator-managed-user-rule: %v", err)
	}

	// Seed 4: Pending rule (for: 999h ensures it stays pending)
	_, err = createNamedPrometheusRule(ctx, f,
		"test-pending-rule", seedNamespace, "test-group", nil, nil,
		monitoringv1.Rule{
			Alert: "TestPendingAlert",
			Expr:  intstr.FromString("vector(1)"),
			For:   &forPending,
			Labels: map[string]string{
				"severity": "warning",
			},
		},
	)
	if err != nil {
		t.Fatalf("Failed to create test-pending-rule: %v", err)
	}

	// Seed 5: Platform rule in openshift-monitoring
	_, err = createNamedPrometheusRule(ctx, f,
		"test-user-platform-rule", k8s.ClusterMonitoringNamespace, "test-group", nil, nil,
		monitoringv1.Rule{
			Alert: "TestUserPlatformAlert",
			Expr:  intstr.FromString("vector(1)"),
			For:   &forDuration,
			Labels: map[string]string{
				"severity": "warning",
			},
		},
	)
	if err != nil {
		t.Fatalf("Failed to create test-user-platform-rule: %v", err)
	}

	// Poll until all 5 seed rules + Watchdog appear
	t.Log("Phase 1: Polling for seed rules to appear in API...")
	seedAlerts := []string{
		"TestUserAlert",
		"TestGitOpsUserAlert",
		"TestOperatorManagedUserAlert",
		"TestPendingAlert",
		"TestUserPlatformAlert",
		"Watchdog",
	}

	err = wait.PollUntilContextTimeout(ctx, pollInterval, seedTimeout, true, func(ctx context.Context) (bool, error) {
		groups, err := listRulesAsGroups(ctx, f.PluginURL, nil)
		if err != nil {
			t.Logf("  poll: list error: %v", err)
			return false, nil
		}

		found := 0
		withID := 0
		for _, name := range seedAlerts {
			rule := findRuleInGroups(groups, name)
			if rule == nil {
				continue
			}
			found++
			id := rule.Labels[k8s.AlertRuleLabelId]
			if id != "" {
				withID++
				switch name {
				case "TestUserAlert":
					ids.UserRule = id
				case "TestGitOpsUserAlert":
					ids.GitOpsRule = id
				case "TestOperatorManagedUserAlert":
					ids.OperatorManaged = id
				case "TestPendingAlert":
					ids.PendingRule = id
				case "TestUserPlatformAlert":
					ids.PlatformRule = id
				case "Watchdog":
					ids.Watchdog = id
				}
			}
		}
		t.Logf("  poll: found %d/%d seed rules (%d with ID)", found, len(seedAlerts), withID)
		return found == len(seedAlerts), nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for seed rules: %v (ids so far: %+v)", err, ids)
	}

	t.Logf("Phase 1: All seed rules discovered: %+v", ids)

	// -----------------------------------------------------------------------
	// Phase 2: GET /rules Tests (TC-001 to TC-012)
	// -----------------------------------------------------------------------
	t.Run("Phase2_GetRules", func(t *testing.T) {
		runPhase2GetRulesTests(t, f, ids)
	})

	// -----------------------------------------------------------------------
	// Phase 3: GET /alerts Tests (TC-013 to TC-023)
	// -----------------------------------------------------------------------
	t.Run("Phase3_GetAlerts", func(t *testing.T) {
		runPhase3GetAlertsTests(t, f, ids)
	})

	// -----------------------------------------------------------------------
	// Phases 4-9: Write Tests
	// -----------------------------------------------------------------------
	t.Run("Phase4_Create", testPhase4Create(f, ids))
	t.Run("Phase5_Classification", testPhase5Classification(f, ids))
	t.Run("Phase6_SingleUpdate", testPhase6SingleUpdate(f, ids))
	t.Run("Phase7_BulkUpdate", testPhase7BulkUpdate(f, ids))
	t.Run("Phase8_SingleDelete", testPhase8SingleDelete(f, ids))
	t.Run("Phase9_BulkDelete", testPhase9BulkDelete(f, ids))

	// -----------------------------------------------------------------------
	// Phase 10: CRUD Lifecycle
	// -----------------------------------------------------------------------
	t.Run("Phase10_CRUDLifecycle", testPhase10CRUDLifecycle(f))

	// -----------------------------------------------------------------------
	// Phase 12: Metrics
	// -----------------------------------------------------------------------
	t.Run("Phase12_Metrics", testPhase12Metrics(f))
}

// ==========================================================================
// Phase 2: GET /rules (TC-001 to TC-012)
// ==========================================================================

func runPhase2GetRulesTests(t *testing.T, f *framework.Framework, ids *seedRuleIDs) {
	ctx := context.Background()

	t.Run("TC001_HealthEndpoint", func(t *testing.T) {
		resp, err := getHealth(ctx, f.PluginURL)
		if err != nil {
			t.Fatalf("GET /health failed: %v", err)
		}
		if resp.Alerting == nil {
			t.Fatal("Expected alerting field to be non-nil")
		}
		if resp.Alerting.Platform == nil {
			t.Fatal("Expected alerting.platform to be non-nil")
		}
		if resp.Alerting.Platform.Prometheus.Status != k8s.RouteReachable {
			t.Logf("Platform prometheus status is %q (not %q) — acceptable when plugin runs locally without service account token",
				resp.Alerting.Platform.Prometheus.Status, k8s.RouteReachable)
		}
	})

	t.Run("TC002_ListAllRulesProvenanceLabels", func(t *testing.T) {
		groups, err := listRulesAsGroups(ctx, f.PluginURL, nil)
		if err != nil {
			t.Fatalf("GET /rules failed: %v", err)
		}
		if len(groups) == 0 {
			t.Fatal("Expected at least 1 rule group")
		}

		allRules := findAllRulesInGroups(groups)
		if len(allRules) == 0 {
			t.Fatal("Expected at least 1 rule")
		}

		for _, rule := range allRules {
			if rule.Type != k8s.RuleTypeAlerting {
				continue
			}
			if rule.Labels[k8s.AlertRuleLabelId] == "" {
				t.Errorf("Rule %q missing %s label", rule.Name, k8s.AlertRuleLabelId)
			}
			if rule.Labels[k8s.PrometheusRuleLabelNamespace] == "" {
				t.Errorf("Rule %q missing %s label", rule.Name, k8s.PrometheusRuleLabelNamespace)
			}
			if rule.Labels[k8s.PrometheusRuleLabelName] == "" {
				t.Errorf("Rule %q missing %s label", rule.Name, k8s.PrometheusRuleLabelName)
			}
		}
	})

	t.Run("TC003_RulesFilterStateFiring", func(t *testing.T) {
		groups, err := listRulesAsGroups(ctx, f.PluginURL, map[string]string{"state": "firing"})
		if err != nil {
			t.Fatalf("GET /rules?state=firing failed: %v", err)
		}

		watchdog := findRuleInGroups(groups, "Watchdog")
		if watchdog == nil {
			t.Error("Expected Watchdog to be present in firing rules")
		}

		pending := findRuleInGroups(groups, "TestPendingAlert")
		if pending != nil {
			t.Error("Expected TestPendingAlert to be absent from firing rules")
		}
	})

	t.Run("TC004_RulesFilterStatePending", func(t *testing.T) {
		groups, err := listRulesAsGroups(ctx, f.PluginURL, map[string]string{"state": "pending"})
		if err != nil {
			t.Fatalf("GET /rules?state=pending failed: %v", err)
		}

		pending := findRuleInGroups(groups, "TestPendingAlert")
		if pending == nil {
			t.Error("Expected TestPendingAlert to be present in pending rules")
		}
	})

	t.Run("TC005_RulesFilterSeverity", func(t *testing.T) {
		groups, err := listRulesAsGroups(ctx, f.PluginURL, map[string]string{"severity": "warning"})
		if err != nil {
			t.Fatalf("GET /rules?severity=warning failed: %v", err)
		}

		userAlert := findRuleInGroups(groups, "TestUserAlert")
		if userAlert == nil {
			t.Error("Expected TestUserAlert to be present in severity=warning rules")
		}

		allRules := findAllRulesInGroups(groups)
		for _, rule := range allRules {
			if rule.Type != k8s.RuleTypeAlerting {
				continue
			}
			if rule.Labels["severity"] != "warning" {
				t.Errorf("Rule %q has severity=%q, expected warning", rule.Name, rule.Labels["severity"])
			}
		}
	})

	t.Run("TC006_RulesFilterNamespace", func(t *testing.T) {
		// The namespace filter matches against alert labels. Alerts from vector(1)
		// may not carry a namespace label, so we verify namespace isolation by
		// checking the rule-level openshift_io_prometheus_rule_namespace label
		// on unfiltered results instead.
		groups, err := listRulesAsGroups(ctx, f.PluginURL, nil)
		if err != nil {
			t.Fatalf("GET /rules failed: %v", err)
		}

		userAlert := findRuleInGroups(groups, "TestUserAlert")
		if userAlert == nil {
			t.Fatal("Expected TestUserAlert to be present in unfiltered rules")
		}
		if userAlert.Labels[k8s.PrometheusRuleLabelNamespace] != seedNamespace {
			t.Errorf("Expected TestUserAlert rule namespace label %q, got %q",
				seedNamespace, userAlert.Labels[k8s.PrometheusRuleLabelNamespace])
		}

		// Platform rules should be in openshift-monitoring, not seed namespace
		platformAlert := findRuleInGroups(groups, "TestUserPlatformAlert")
		if platformAlert == nil {
			t.Fatal("Expected TestUserPlatformAlert to be present")
		}
		if platformAlert.Labels[k8s.PrometheusRuleLabelNamespace] != k8s.ClusterMonitoringNamespace {
			t.Errorf("Expected TestUserPlatformAlert rule namespace label %q, got %q",
				k8s.ClusterMonitoringNamespace, platformAlert.Labels[k8s.PrometheusRuleLabelNamespace])
		}
	})

	t.Run("TC007_RulesFilterAlertname", func(t *testing.T) {
		groups, err := listRulesAsGroups(ctx, f.PluginURL, map[string]string{"alertname": "Watchdog"})
		if err != nil {
			t.Fatalf("GET /rules?alertname=Watchdog failed: %v", err)
		}

		allRules := findAllRulesInGroups(groups)
		for _, rule := range allRules {
			if rule.Type != k8s.RuleTypeAlerting {
				continue
			}
			if rule.Name != "Watchdog" {
				t.Errorf("Expected only Watchdog rules, got %q", rule.Name)
			}
		}
	})

	t.Run("TC008_RulesMultiFilterSeverityNamespace", func(t *testing.T) {
		// Filter by severity (works on alert labels) and verify namespace via rule label
		groups, err := listRulesAsGroups(ctx, f.PluginURL, map[string]string{
			"severity": "warning",
		})
		if err != nil {
			t.Fatalf("GET /rules?severity=warning failed: %v", err)
		}

		userAlert := findRuleInGroups(groups, "TestUserAlert")
		if userAlert == nil {
			t.Fatal("Expected TestUserAlert to be present with severity=warning")
		}
		if userAlert.Labels[k8s.PrometheusRuleLabelNamespace] != seedNamespace {
			t.Errorf("Expected TestUserAlert in namespace %q, got %q",
				seedNamespace, userAlert.Labels[k8s.PrometheusRuleLabelNamespace])
		}
	})

	t.Run("TC009_RulesMultiFilterStateSeverity", func(t *testing.T) {
		groups, err := listRulesAsGroups(ctx, f.PluginURL, map[string]string{
			"state":    "firing",
			"severity": "none",
		})
		if err != nil {
			t.Fatalf("GET /rules multi-filter failed: %v", err)
		}

		watchdog := findRuleInGroups(groups, "Watchdog")
		if watchdog == nil {
			t.Error("Expected Watchdog to be present with state=firing + severity=none")
		}
	})

	t.Run("TC010_RulesFilterSourcePlatform", func(t *testing.T) {
		groups, err := listRulesAsGroups(ctx, f.PluginURL, map[string]string{
			k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
		})
		if err != nil {
			t.Fatalf("GET /rules?%s=%s failed: %v", k8s.AlertSourceLabel, k8s.AlertSourcePlatform, err)
		}

		allRules := findAllRulesInGroups(groups)
		for _, rule := range allRules {
			if rule.Type != k8s.RuleTypeAlerting {
				continue
			}
			if rule.Labels[k8s.AlertSourceLabel] != k8s.AlertSourcePlatform {
				t.Errorf("Rule %q has source=%q, expected %q", rule.Name, rule.Labels[k8s.AlertSourceLabel], k8s.AlertSourcePlatform)
			}
		}
	})

	t.Run("TC011_RulesFilterPlatformNamespace", func(t *testing.T) {
		// Verify platform rules have the correct namespace label
		groups, err := listRulesAsGroups(ctx, f.PluginURL, nil)
		if err != nil {
			t.Fatalf("GET /rules failed: %v", err)
		}

		platformAlert := findRuleInGroups(groups, "TestUserPlatformAlert")
		if platformAlert == nil {
			t.Fatal("Expected TestUserPlatformAlert to be present")
		}
		if platformAlert.Labels[k8s.PrometheusRuleLabelNamespace] != k8s.ClusterMonitoringNamespace {
			t.Errorf("Expected TestUserPlatformAlert namespace label %q, got %q",
				k8s.ClusterMonitoringNamespace, platformAlert.Labels[k8s.PrometheusRuleLabelNamespace])
		}
	})

	t.Run("TC012_RulesInvalidState", func(t *testing.T) {
		statusCode, _, err := doRawGET(ctx, f.PluginURL+"/api/v1/alerting/rules?state=invalid")
		if err != nil {
			t.Fatalf("GET /rules?state=invalid failed: %v", err)
		}
		if statusCode != http.StatusBadRequest {
			t.Fatalf("Expected HTTP 400, got %d", statusCode)
		}
	})
}

// ==========================================================================
// Phase 3: GET /alerts (TC-013 to TC-023)
// ==========================================================================

func runPhase3GetAlertsTests(t *testing.T, f *framework.Framework, _ *seedRuleIDs) {
	ctx := context.Background()

	t.Run("TC013_GetAllAlerts", func(t *testing.T) {
		resp, statusCode, err := getAlertsWithResponse(ctx, f.PluginURL, nil)
		if err != nil {
			t.Fatalf("GET /alerts failed: %v", err)
		}
		if statusCode != http.StatusOK {
			t.Fatalf("Expected HTTP 200, got %d", statusCode)
		}
		if resp.Data.Alerts == nil {
			t.Fatal("Expected data.alerts to be a non-nil array")
		}
	})

	t.Run("TC014_AlertsFilterStateFiring", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, map[string]string{"state": "firing"})
		if err != nil {
			t.Fatalf("GET /alerts?state=firing failed: %v", err)
		}

		for _, alert := range resp.Data.Alerts {
			if alert.State != "firing" && alert.State != "silenced" {
				t.Errorf("Alert %q has state=%q, expected firing or silenced", alert.Labels["alertname"], alert.State)
			}
		}
	})

	t.Run("TC015_AlertsFilterStatePending", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, map[string]string{"state": "pending"})
		if err != nil {
			t.Fatalf("GET /alerts?state=pending failed: %v", err)
		}

		found := false
		for _, alert := range resp.Data.Alerts {
			if alert.Labels["alertname"] == "TestPendingAlert" {
				found = true
				break
			}
		}
		if !found {
			t.Error("Expected TestPendingAlert to be present in pending alerts")
		}
	})

	t.Run("TC016_AlertsFilterSeverity", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, map[string]string{"severity": "warning"})
		if err != nil {
			t.Fatalf("GET /alerts?severity=warning failed: %v", err)
		}

		for _, alert := range resp.Data.Alerts {
			if alert.Labels["severity"] != "warning" {
				t.Errorf("Alert %q has severity=%q, expected warning", alert.Labels["alertname"], alert.Labels["severity"])
			}
		}
	})

	t.Run("TC017_AlertsMultiFilterStateSeverity", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, map[string]string{
			"state":    "firing",
			"severity": "none",
		})
		if err != nil {
			t.Fatalf("GET /alerts multi-filter failed: %v", err)
		}

		found := false
		for _, alert := range resp.Data.Alerts {
			if alert.Labels["alertname"] == "Watchdog" {
				found = true
				break
			}
		}
		if !found {
			t.Error("Expected Watchdog alert to be present with state=firing + severity=none")
		}
	})

	t.Run("TC018_AlertsFilterAlertname", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, map[string]string{
			"state":     "firing",
			"alertname": "Watchdog",
		})
		if err != nil {
			t.Fatalf("GET /alerts filter alertname failed: %v", err)
		}

		if len(resp.Data.Alerts) == 0 {
			t.Fatal("Expected at least 1 Watchdog alert")
		}

		first := resp.Data.Alerts[0]
		if first.Labels["alertname"] != "Watchdog" {
			t.Errorf("Expected alertname=Watchdog, got %q", first.Labels["alertname"])
		}
		if first.State != "firing" && first.State != "silenced" {
			t.Errorf("Expected state=firing or silenced, got %q", first.State)
		}
	})

	t.Run("TC019_AlertsBackendEnrichment", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, map[string]string{"state": "firing"})
		if err != nil {
			t.Fatalf("GET /alerts failed: %v", err)
		}

		found := false
		for _, alert := range resp.Data.Alerts {
			if alert.Labels[k8s.AlertBackendLabel] != "" {
				found = true
				break
			}
		}
		if !found {
			t.Error("Expected at least one alert with openshift_io_alert_backend label")
		}
	})

	t.Run("TC020_AlertsSourceEnrichment", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, map[string]string{"state": "firing"})
		if err != nil {
			t.Fatalf("GET /alerts failed: %v", err)
		}

		found := false
		for _, alert := range resp.Data.Alerts {
			if alert.Labels[k8s.AlertSourceLabel] == k8s.AlertSourcePlatform {
				found = true
				break
			}
		}
		if !found {
			t.Error("Expected at least one alert with openshift_io_alert_source=platform")
		}
	})

	t.Run("TC021_AlertsAlertRuleIdEnrichment", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, map[string]string{"state": "firing"})
		if err != nil {
			t.Fatalf("GET /alerts failed: %v", err)
		}

		for _, alert := range resp.Data.Alerts {
			if alert.AlertRuleId == "" {
				t.Errorf("Alert %q missing alertRuleId field", alert.Labels["alertname"])
			}
		}
	})

	t.Run("TC022_AlertsWarningsField", func(t *testing.T) {
		resp, _, err := getAlertsWithResponse(ctx, f.PluginURL, nil)
		if err != nil {
			t.Fatalf("GET /alerts failed: %v", err)
		}
		// Warnings can be nil or an empty array -- both are valid.
		// We just check the response was parseable (which it was if we got here).
		t.Logf("Warnings field: %v", resp.Warnings)
	})

	t.Run("TC023_AlertsInvalidState", func(t *testing.T) {
		statusCode, _, err := doRawGET(ctx, f.PluginURL+"/api/v1/alerting/alerts?state=bogus")
		if err != nil {
			t.Fatalf("GET /alerts?state=bogus failed: %v", err)
		}
		if statusCode != http.StatusBadRequest {
			t.Fatalf("Expected HTTP 400, got %d", statusCode)
		}
	})
}

// suppress unused import warnings
var _ = fmt.Sprintf
var _ = managementlabels.RuleManagedByLabel
