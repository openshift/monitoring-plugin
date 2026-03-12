package management

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

func (c *client) GetRuleById(ctx context.Context, alertRuleId string) (monitoringv1.Rule, error) {
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found {
		return monitoringv1.Rule{}, &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	return rule, nil
}
