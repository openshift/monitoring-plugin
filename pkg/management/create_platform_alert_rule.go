package management

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

// CreatePlatformAlertRule creates a new platform alert rule.
func (c *client) CreatePlatformAlertRule(ctx context.Context, alertRule monitoringv1.Rule) (string, error) {
	plan, err := c.planCreatePlatformAlertRule(ctx, alertRule)
	if err != nil {
		return "", err
	}
	if err := enforceCreatePlatformWritable(plan); err != nil {
		return "", err
	}
	if err := c.executeCreatePlatformPlan(ctx, plan); err != nil {
		return "", err
	}
	return plan.computedRuleID, nil
}
