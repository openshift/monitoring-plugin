//go:build e2e

package e2e

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
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

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-create-rule", false)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

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
			PrometheusRuleNamespace: testNamespace,
		},
	}
	id, err := createRuleViaAPIWithRetry(ctx, f, createAlertRuleRequest)
	require.NoError(t, err)
	require.NotEmpty(t, id)

	t.Logf("Created rule with ID: %s", id)

	err = poll(time.Second, time.Minute, func() error {
		promRule, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(testNamespace).Get(
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
}
