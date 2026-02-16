package management

import (
	"context"
	"fmt"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"
)

func (c *client) UpdateUserDefinedAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) (string, error) {
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found {
		return "", &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	name := rule.Labels[k8s.PrometheusRuleLabelName]

	if c.IsPlatformAlertRule(types.NamespacedName{Namespace: namespace, Name: name}) {
		return "", &NotAllowedError{Message: "cannot update alert rule in a platform-managed PrometheusRule"}
	}

	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return "", err
	}

	if !found {
		return "", &NotFoundError{
			Resource:       "PrometheusRule",
			Id:             alertRuleId,
			AdditionalInfo: fmt.Sprintf("PrometheusRule %s/%s not found", namespace, name),
		}
	}

	// Locate the target rule once and update it after validation
	var foundGroupIdx, foundRuleIdx int
	ruleFound := false
	for groupIdx := range pr.Spec.Groups {
		for ruleIdx := range pr.Spec.Groups[groupIdx].Rules {
			rule := &pr.Spec.Groups[groupIdx].Rules[ruleIdx]
			if c.shouldUpdateRule(*rule, alertRuleId) {
				foundGroupIdx = groupIdx
				foundRuleIdx = ruleIdx
				ruleFound = true
				break
			}
		}
		if ruleFound {
			break
		}
	}

	if !ruleFound {
		return "", &NotFoundError{
			Resource:       "AlertRule",
			Id:             alertRuleId,
			AdditionalInfo: fmt.Sprintf("in PrometheusRule %s/%s", namespace, name),
		}
	}

	// Validate severity if present
	if sev, ok := alertRule.Labels["severity"]; ok && sev != "" {
		if !isValidSeverity(sev) {
			return "", &ValidationError{Message: fmt.Sprintf("invalid severity %q: must be one of critical|warning|info|none", sev)}
		}
	}

	// Enforce/stamp rule id label on user-defined rules
	computedId := alertrule.GetAlertingRuleId(&alertRule)
	if alertRule.Labels == nil {
		alertRule.Labels = map[string]string{}
	}
	alertRule.Labels[k8s.AlertRuleLabelId] = computedId

	// Perform the update in-place exactly once
	pr.Spec.Groups[foundGroupIdx].Rules[foundRuleIdx] = alertRule

	err = c.k8sClient.PrometheusRules().Update(ctx, *pr)
	if err != nil {
		return "", fmt.Errorf("failed to update PrometheusRule %s/%s: %w", pr.Namespace, pr.Name, err)
	}

	return computedId, nil
}

func (c *client) shouldUpdateRule(rule monitoringv1.Rule, alertRuleId string) bool {
	return alertRuleId == alertrule.GetAlertingRuleId(&rule)
}
