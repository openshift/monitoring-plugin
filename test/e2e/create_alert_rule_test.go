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

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func TestCreateUserDefinedAlertRule(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateUserNamespace(ctx, "test-create-rule")
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	createExpr := "vector(1) or vector(0)"
	id, err := createRuleViaAPI(ctx, f, managementrouter.CreateAlertRuleRequest{
		AlertingRule: &managementrouter.AlertRuleSpec{
			Alert: new("E2ECreateAlert"),
			Expr:  &createExpr,
			For:   new("1m"),
			Labels: &map[string]string{
				"severity": "info",
			},
			Annotations: &map[string]string{
				"summary": "E2E test alert for create-rule",
			},
		},
		PrometheusRule: &managementrouter.PrometheusRuleTarget{
			PrometheusRuleName:      "e2e-create-pr",
			PrometheusRuleNamespace: testNamespace,
		},
	})
	if err != nil {
		t.Fatalf("Failed to create alert rule: %v", err)
	}
	t.Logf("Created rule with ID: %s", id)

	promRule, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(testNamespace).Get(
		ctx, "e2e-create-pr", metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to get PrometheusRule: %v", err)
	}

	if len(promRule.Spec.Groups) == 0 {
		t.Fatal("Expected at least one rule group in PrometheusRule")
	}

	var foundAlert bool
	for _, group := range promRule.Spec.Groups {
		for _, rule := range group.Rules {
			if rule.Alert == "E2ECreateAlert" {
				foundAlert = true
				if rule.Expr.String() != createExpr {
					t.Errorf("Expected expr %q, got %q", createExpr, rule.Expr.String())
				}
				if rule.For == nil || string(*rule.For) != "1m" {
					t.Errorf("Expected for '1m', got %v", rule.For)
				}
				if rule.Labels["severity"] != "info" {
					t.Errorf("Expected severity=info, got %q", rule.Labels["severity"])
				}
				if rule.Annotations["summary"] != "E2E test alert for create-rule" {
					t.Errorf("Expected summary annotation, got %q", rule.Annotations["summary"])
				}
			}
		}
	}

	if !foundAlert {
		t.Fatal("Alert 'E2ECreateAlert' not found in PrometheusRule")
	}

	t.Log("Create alert rule e2e test passed successfully")
}

// TestRBAC_CreateAlertRule verifies that the create endpoint enforces Kubernetes
// RBAC across three user profiles: anonymous (403), namespace-scoped (201 in
// own namespace, 403 elsewhere), and cluster-admin (201 everywhere).
func TestRBAC_CreateAlertRule(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-rbac-create-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-rbac-create-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	userA, err := f.CreateAnonymousUser(ctx, "e2e-rbac-user-a", "default")
	if err != nil {
		t.Fatalf("Failed to create anonymous user A: %v", err)
	}
	defer func() { _ = userA.Cleanup() }()

	userB, err := f.CreateScopedUser(ctx, "e2e-rbac-user-b", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch"})
	if err != nil {
		t.Fatalf("Failed to create scoped user B: %v", err)
	}
	defer func() { _ = userB.Cleanup() }()

	cases := []struct {
		name       string
		token      string
		namespace  string
		alertName  string
		wantStatus int
	}{
		{"UserA_NoPerms_FailsNamespaceY", userA.Token, nsY, "RBACAlertA", http.StatusForbidden},
		{"UserB_ScopedPerms_SucceedsNamespaceY", userB.Token, nsY, "RBACAlertBY", http.StatusCreated},
		{"UserB_ScopedPerms_FailsNamespaceZ", userB.Token, nsZ, "RBACAlertBZ", http.StatusForbidden},
		{"UserC_ClusterAdmin_SucceedsNamespaceY", f.BearerToken, nsY, "RBACAlertCY", http.StatusCreated},
		{"UserC_ClusterAdmin_SucceedsNamespaceZ", f.BearerToken, nsZ, "RBACAlertCZ", http.StatusCreated},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status := createAlertRuleWithToken(t, f, ctx, tc.token, tc.namespace, tc.alertName)
			if status != tc.wantStatus {
				t.Fatalf("Expected status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

// createAlertRuleWithToken sends a create alert rule request using the given
// bearer token and returns the HTTP status code.
func createAlertRuleWithToken(t *testing.T, f *framework.Framework, ctx context.Context, token, namespace, alertName string) int {
	t.Helper()

	expr := fmt.Sprintf("absent(nonexistent{e2e_rbac_create=%q})", alertName)
	payload := managementrouter.CreateAlertRuleRequest{
		AlertingRule: &managementrouter.AlertRuleSpec{
			Alert: &alertName,
			Expr:  &expr,
			Labels: &map[string]string{
				"severity": "info",
			},
		},
		PrometheusRule: &managementrouter.PrometheusRuleTarget{
			PrometheusRuleName:      "e2e-rbac-pr",
			PrometheusRuleNamespace: namespace,
		},
	}

	reqBody, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Failed to marshal create request: %v", err)
	}

	createURL, err := url.JoinPath(f.PluginURL, "api/v1/alerting/rules")
	if err != nil {
		t.Fatalf("Failed to build URL: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, createURL, bytes.NewBuffer(reqBody))
	if err != nil {
		t.Fatalf("Failed to create HTTP request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		t.Fatalf("Failed to make create request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Logf("Create %s in %s: status %d, body: %s", alertName, namespace, resp.StatusCode, string(body))
	}

	return resp.StatusCode
}
