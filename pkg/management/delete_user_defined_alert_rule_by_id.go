package management

import (
	"context"
	"fmt"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

func (c *client) DeleteUserDefinedAlertRuleById(ctx context.Context, alertRuleId string) error {
	prId, err := c.mapper.FindAlertRuleById(mapper.PrometheusAlertRuleId(alertRuleId))
	if err != nil {
		return &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	if c.IsPlatformAlertRule(types.NamespacedName(*prId)) {
		return &NotAllowedError{Message: "cannot delete alert rule from a platform-managed PrometheusRule"}
	}

	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, prId.Namespace, prId.Name)
	if err != nil {
		return err
	}

	if !found {
		return &NotFoundError{Resource: "PrometheusRule", Id: fmt.Sprintf("%s/%s", prId.Namespace, prId.Name)}
	}

	updated := false
	var newGroups []monitoringv1.RuleGroup

	for _, group := range pr.Spec.Groups {
		newRules := c.filterRulesById(group.Rules, alertRuleId, &updated)

		// Only keep groups that still have rules
		if len(newRules) > 0 {
			group.Rules = newRules
			newGroups = append(newGroups, group)
		} else if len(newRules) != len(group.Rules) {
			// Group became empty due to rule deletion
			updated = true
		}
	}

	if updated {
		if len(newGroups) == 0 {
			// No groups left, delete the entire PrometheusRule
			err = c.k8sClient.PrometheusRules().Delete(ctx, pr.Namespace, pr.Name)
			if err != nil {
				return fmt.Errorf("failed to delete PrometheusRule %s/%s: %w", pr.Namespace, pr.Name, err)
			}
		} else {
			// Update PrometheusRule with remaining groups
			pr.Spec.Groups = newGroups
			err = c.k8sClient.PrometheusRules().Update(ctx, *pr)
			if err != nil {
				return fmt.Errorf("failed to update PrometheusRule %s/%s: %w", pr.Namespace, pr.Name, err)
			}
		}
		return nil
	}

	return &NotFoundError{Resource: "PrometheusRule", Id: fmt.Sprintf("%s/%s", pr.Namespace, pr.Name)}
}

func (c *client) filterRulesById(rules []monitoringv1.Rule, alertRuleId string, updated *bool) []monitoringv1.Rule {
	var newRules []monitoringv1.Rule

	for _, rule := range rules {
		if c.shouldDeleteRule(rule, alertRuleId) {
			*updated = true
			continue
		}
		newRules = append(newRules, rule)
	}

	return newRules
}

func (c *client) shouldDeleteRule(rule monitoringv1.Rule, alertRuleId string) bool {
	return alertRuleId == string(c.mapper.GetAlertingRuleId(&rule))
}
