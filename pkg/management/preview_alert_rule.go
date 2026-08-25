package management

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

// PreviewCreateRequest identifies a create operation to preview.
type PreviewCreateRequest struct {
	AlertRule monitoringv1.Rule
	PROptions *PrometheusRuleOptions
}

// PreviewAlertRule previews a single create or update without persisting changes.
func (c *client) PreviewAlertRuleCreate(ctx context.Context, req PreviewCreateRequest) (*RuleChangePlan, error) {
	if req.PROptions != nil {
		plan, err := c.planCreateUserDefinedAlertRule(ctx, req.AlertRule, *req.PROptions)
		if err != nil {
			return nil, err
		}
		return plan.toRuleChangePlan()
	}

	plan, err := c.planCreatePlatformAlertRule(ctx, req.AlertRule)
	if err != nil {
		return nil, err
	}
	return plan.toRuleChangePlan()
}

// PreviewAlertRuleUpdate previews a single update without persisting changes.
func (c *client) PreviewAlertRuleUpdate(ctx context.Context, req PreviewUpdateRequest) (*RuleChangePlan, error) {
	return c.planUpdateAlertRule(ctx, req)
}
