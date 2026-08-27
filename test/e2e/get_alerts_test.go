//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func TestGetAlerts(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateUserNamespace(ctx, "test-get-alerts")
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	forDuration := monitoringv1.Duration("1s")
	alertName := "E2EGetAlertsTest"

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "e2e-get-alerts-rule",
			Namespace: testNamespace,
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{
				{
					Name: "e2e-test-group",
					Rules: []monitoringv1.Rule{
						{
							Alert: alertName,
							Expr:  intstr.FromString("vector(1)"),
							For:   &forDuration,
							Labels: map[string]string{
								"severity": "none",
								"team":     "e2e",
							},
							Annotations: map[string]string{
								"summary": "E2E test alert for GET /alerts",
							},
						},
					},
				},
			},
		},
	}

	_, err = f.Monitoringv1clientset.MonitoringV1().PrometheusRules(testNamespace).Create(
		ctx, promRule, metav1.CreateOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	httpClient := f.HTTPClient()
	err = wait.PollUntilContextTimeout(ctx, 5*time.Second, 3*time.Minute, true, func(ctx context.Context) (bool, error) {
		alertsURL := f.PluginURL + "/api/v1/alerting/alerts"
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, alertsURL, nil)
		if err != nil {
			return false, err
		}
		if f.BearerToken != "" {
			req.Header.Set("Authorization", "Bearer "+f.BearerToken)
		}

		resp, err := httpClient.Do(req)
		if err != nil {
			t.Logf("Failed to query alerts: %v", err)
			return false, nil
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Logf("GET /alerts returned status %d, retrying", resp.StatusCode)
			return false, nil
		}

		var alertsResp struct {
			Data struct {
				Alerts []k8s.PrometheusAlert `json:"alerts"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&alertsResp); err != nil {
			t.Logf("Failed to decode alerts response: %v", err)
			return false, nil
		}

		for _, alert := range alertsResp.Data.Alerts {
			if alert.Labels["alertname"] == alertName {
				if alert.State != "firing" && alert.State != "pending" {
					t.Logf("Found alert %s but state is %q, waiting for firing/pending", alertName, alert.State)
					return false, nil
				}
				if alert.Labels["severity"] != "none" {
					t.Errorf("Expected severity=none, got %q", alert.Labels["severity"])
				}
				t.Logf("Found alert %s in state %q", alertName, alert.State)
				return true, nil
			}
		}

		t.Logf("Alert %s not found yet (got %d alerts total)", alertName, len(alertsResp.Data.Alerts))
		return false, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for alert to appear: %v", err)
	}

	t.Log("GET /alerts e2e test passed successfully")
}

// TestRBAC_GetAlerts verifies Thanos-tenancy RBAC for GET /alerts.
//
// With ?namespace=: User A (no perms) gets HTTP 200 without the UWM alert in
// ns Y; User B (monitoring-rules-view in Y) sees Y but not Z; cluster-admin
// sees Y.
//
// Without ?namespace=: fan-out must not leak the alert to unprivileged users
// and must still return it for namespace-scoped viewers.
func TestRBAC_GetAlerts(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-rbac-get-alerts-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-rbac-get-alerts-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	userA, err := f.CreateAnonymousUser(ctx, "e2e-rbac-get-a", "default")
	if err != nil {
		t.Fatalf("Failed to create unprivileged user A: %v", err)
	}
	defer func() { _ = userA.Cleanup() }()

	userB, err := f.CreateUserWithClusterRole(ctx, "e2e-rbac-get-b", nsY, "monitoring-rules-view")
	if err != nil {
		t.Fatalf("Failed to create scoped user B: %v", err)
	}
	defer func() { _ = userB.Cleanup() }()

	alertName := "E2ERBACGetAlertsTest"
	if err := createFiringPrometheusRule(ctx, f, nsY, "e2e-rbac-get-alerts-rule", alertName); err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	err = wait.PollUntilContextTimeout(ctx, 5*time.Second, 3*time.Minute, true, func(ctx context.Context) (bool, error) {
		alerts, status, err := getAlertsWithToken(f, ctx, f.BearerToken, nsY)
		if err != nil {
			t.Logf("Admin GET /alerts failed: %v", err)
			return false, nil
		}
		if status != http.StatusOK {
			t.Logf("Admin GET /alerts returned status %d, retrying", status)
			return false, nil
		}
		if containsAlert(alerts, alertName) {
			t.Logf("Admin sees alert %s", alertName)
			return true, nil
		}
		t.Logf("Waiting for alert %s (admin sees %d alerts)", alertName, len(alerts))
		return false, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for admin to see alert: %v", err)
	}

	cases := []struct {
		name      string
		token     string
		namespace string
		wantAlert bool
	}{
		{"UserA_NoPerms_NamespaceY", userA.Token, nsY, false},
		{"UserA_NoPerms_NoNamespace", userA.Token, "", false},
		{"UserB_RulesView_NamespaceY", userB.Token, nsY, true},
		{"UserB_RulesView_NamespaceZ", userB.Token, nsZ, false},
		{"UserB_RulesView_NoNamespace", userB.Token, "", true},
		{"UserC_ClusterAdmin_NamespaceY", f.BearerToken, nsY, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			alerts, status, err := getAlertsWithToken(f, ctx, tc.token, tc.namespace)
			if err != nil {
				t.Fatalf("GET /alerts request failed: %v", err)
			}
			if status != http.StatusOK {
				t.Fatalf("Expected status %d, got %d", http.StatusOK, status)
			}
			got := containsAlert(alerts, alertName)
			if got != tc.wantAlert {
				t.Fatalf("Alert %s visibility: want %v, got %v (%d alerts returned)", alertName, tc.wantAlert, got, len(alerts))
			}
		})
	}
}

func createFiringPrometheusRule(ctx context.Context, f *framework.Framework, namespace, name, alertName string) error {
	forDuration := monitoringv1.Duration("1s")
	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{{
				Name: "e2e-rbac-group",
				Rules: []monitoringv1.Rule{{
					Alert: alertName,
					Expr:  intstr.FromString("vector(1)"),
					For:   &forDuration,
					Labels: map[string]string{
						"severity": "none",
						"e2e_test": "rbac_get",
					},
				}},
			}},
		},
	}
	_, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(namespace).Create(ctx, promRule, metav1.CreateOptions{})
	return err
}

func containsAlert(alerts []k8s.PrometheusAlert, alertName string) bool {
	for _, a := range alerts {
		if a.Labels["alertname"] == alertName {
			return true
		}
	}
	return false
}

// getAlertsWithToken calls GET /alerts with an optional namespace query param.
// It returns the decoded alerts and HTTP status. A non-OK status is not an
// error — callers must assert on status explicitly.
func getAlertsWithToken(f *framework.Framework, ctx context.Context, token, namespace string) ([]k8s.PrometheusAlert, int, error) {
	alertsURL := f.PluginURL + "/api/v1/alerting/alerts"
	if namespace != "" {
		alertsURL += "?" + url.Values{"namespace": {namespace}}.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, alertsURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}

	var alertsResp struct {
		Data struct {
			Alerts []k8s.PrometheusAlert `json:"alerts"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&alertsResp); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("decoding response: %w", err)
	}
	return alertsResp.Data.Alerts, resp.StatusCode, nil
}
