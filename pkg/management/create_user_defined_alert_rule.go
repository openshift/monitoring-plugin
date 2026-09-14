package management

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

// CreateUserDefinedAlertRule creates a new user-defined alert rule.
func (c *client) CreateUserDefinedAlertRule(ctx context.Context, alertRule monitoringv1.Rule, prOptions PrometheusRuleOptions) (string, error) {
	plan, err := c.planCreateUserDefinedAlertRule(ctx, alertRule, prOptions)
	if err != nil {
		return "", err
	}
	if err := enforceCreateUserDefinedWritable(plan); err != nil {
		return "", err
	}
	if err := c.executeCreateUserDefinedPlan(ctx, plan); err != nil {
		return "", err
	}
	return plan.computedRuleID, nil
}
