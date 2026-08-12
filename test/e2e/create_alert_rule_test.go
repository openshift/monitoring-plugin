//go:build e2e

package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

// TestCreateUserDefinedAlertRule covers create success (cluster-admin) and RBAC
// denials/allowances for anonymous and namespace-scoped personas as subtests.
func TestCreateUserDefinedAlertRule(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-create-rule-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-create-rule-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	anonymousUser, err := f.CreateAnonymousUser(ctx, "e2e-create-anon", "default")
	if err != nil {
		t.Fatalf("Failed to create anonymous user: %v", err)
	}
	defer func() { _ = anonymousUser.Cleanup() }()

	scopedUser, err := f.CreateScopedUser(ctx, "e2e-create-scoped", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch"})
	if err != nil {
		t.Fatalf("Failed to create scoped user: %v", err)
	}
	defer func() { _ = scopedUser.Cleanup() }()

	t.Run("ClusterAdmin_CreatesAndPersists", func(t *testing.T) {
		createExpr := "vector(1) or vector(0)"
		createAlertRuleRequest := managementrouter.CreateAlertRuleRequest{
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
				PrometheusRuleNamespace: nsY,
			},
		}
		id, err := createRuleViaAPIWithRetry(ctx, f, createAlertRuleRequest)
		require.NoError(t, err)
		require.NotEmpty(t, id)
		t.Logf("Created rule with ID: %s", id)

		err = framework.Poll(time.Second, time.Minute, func() error {
			promRule, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(nsY).Get(
				ctx, "e2e-create-pr", metav1.GetOptions{},
			)
			if err != nil {
				return fmt.Errorf("failed to get PrometheusRule: %w", err)
			}

			for _, group := range promRule.Spec.Groups {
				for _, rule := range group.Rules {
					if rule.Alert == "E2ECreateAlert" {
						if rule.Expr.String() != createExpr {
							return fmt.Errorf("expected expr %q, got %q", createExpr, rule.Expr.String())
						}
						if rule.For == nil || string(*rule.For) != "1m" {
							return fmt.Errorf("expected for '1m', got %v", rule.For)
						}
						if rule.Labels["severity"] != "info" {
							return fmt.Errorf("expected severity=info, got %q", rule.Labels["severity"])
						}
						if rule.Annotations["summary"] != "E2E test alert for create-rule" {
							return fmt.Errorf("expected summary annotation, got %q", rule.Annotations["summary"])
						}
						return nil
					}
				}
			}
			return errors.New("alerting rule 'E2ECreateAlert' not found in PrometheusRule")
		})
		require.NoError(t, err)
	})

	cases := []struct {
		name       string
		token      string
		namespace  string
		alertName  string
		wantStatus int
	}{
		{"AnonymousUser_FailsNamespaceY", anonymousUser.Token, nsY, "RBACAlertA", http.StatusForbidden},
		{"AnonymousUser_FailsNamespaceZ", anonymousUser.Token, nsZ, "RBACAlertAZ", http.StatusForbidden},
		{"ScopedUser_SucceedsNamespaceY", scopedUser.Token, nsY, "RBACAlertBY", http.StatusCreated},
		{"ScopedUser_FailsNamespaceZ", scopedUser.Token, nsZ, "RBACAlertBZ", http.StatusForbidden},
		{"ClusterAdmin_SucceedsNamespaceZ", f.BearerToken, nsZ, "RBACAlertCZ", http.StatusCreated},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status := createAlertRuleWithToken(ctx, t, f, tc.token, tc.namespace, tc.alertName)
			if status != tc.wantStatus {
				t.Fatalf("Expected status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

// createAlertRuleWithToken sends a create alert rule request using the given
// bearer token and returns the HTTP status code.
func createAlertRuleWithToken(ctx context.Context, t *testing.T, f *framework.Framework, token, namespace, alertName string) int {
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
