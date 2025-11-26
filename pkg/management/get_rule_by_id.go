package management

import (
	"context"
	"fmt"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

func (c *client) GetRuleById(ctx context.Context, alertRuleId string) (monitoringv1.Rule, error) {
	prId, err := c.mapper.FindAlertRuleById(mapper.PrometheusAlertRuleId(alertRuleId))
	if err != nil {
		return monitoringv1.Rule{}, err
	}

	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, prId.Namespace, prId.Name)
	if err != nil {
		return monitoringv1.Rule{}, err
	}

	if !found {
		return monitoringv1.Rule{}, &NotFoundError{Resource: "PrometheusRule", Id: fmt.Sprintf("%s/%s", prId.Namespace, prId.Name)}
	}

	var rule *monitoringv1.Rule

	for groupIdx := range pr.Spec.Groups {
		for ruleIdx := range pr.Spec.Groups[groupIdx].Rules {
			foundRule := &pr.Spec.Groups[groupIdx].Rules[ruleIdx]
			if c.mapper.GetAlertingRuleId(foundRule) == mapper.PrometheusAlertRuleId(alertRuleId) {
				rule = foundRule
				break
			}
		}
	}

	if rule != nil {
		return c.updateRuleBasedOnRelabelConfig(rule)
	}

	return monitoringv1.Rule{}, fmt.Errorf("alert rule with id %s not found in PrometheusRule %s/%s", alertRuleId, prId.Namespace, prId.Name)
}

func (c *client) updateRuleBasedOnRelabelConfig(rule *monitoringv1.Rule) (monitoringv1.Rule, error) {
	configs := c.mapper.GetAlertRelabelConfigSpec(rule)

	updatedLabels, err := applyRelabelConfigs(string(rule.Alert), rule.Labels, configs)
	if err != nil {
		return monitoringv1.Rule{}, err
	}

	rule.Labels = updatedLabels
	return *rule, nil
}
