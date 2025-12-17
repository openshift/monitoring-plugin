package management

import (
	"context"
	"fmt"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"
)

func (c *client) UpdateUserDefinedAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) error {
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found {
		return &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	name := rule.Labels[k8s.PrometheusRuleLabelName]

	if c.IsPlatformAlertRule(types.NamespacedName{Namespace: namespace, Name: name}) {
		return fmt.Errorf("cannot update alert rule in a platform-managed PrometheusRule")
	}

	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return err
	}

	if !found {
		return &NotFoundError{Resource: "PrometheusRule", Id: fmt.Sprintf("%s/%s", namespace, name)}
	}

	updated := false
	for groupIdx := range pr.Spec.Groups {
		for ruleIdx := range pr.Spec.Groups[groupIdx].Rules {
			rule := &pr.Spec.Groups[groupIdx].Rules[ruleIdx]
			if c.shouldUpdateRule(*rule, alertRuleId) {
				pr.Spec.Groups[groupIdx].Rules[ruleIdx] = alertRule
				updated = true
				break
			}
		}
		if updated {
			break
		}
	}

	if !updated {
		return fmt.Errorf("alert rule with id %s not found in PrometheusRule %s/%s", alertRuleId, namespace, name)
	}

	err = c.k8sClient.PrometheusRules().Update(ctx, *pr)
	if err != nil {
		return fmt.Errorf("failed to update PrometheusRule %s/%s: %w", pr.Namespace, pr.Name, err)
	}

	return nil
}

func (c *client) shouldUpdateRule(rule monitoringv1.Rule, alertRuleId string) bool {
	return alertRuleId == alertrule.GetAlertingRuleId(&rule)
}
