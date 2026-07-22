//go:build e2e

package e2e

import (
	"context"
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
