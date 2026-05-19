package management

import (
	"context"
	"fmt"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
)

// ruleMatchesAlertRuleID returns true when the provided rule's computed, deterministic
// alert rule id matches the requested id.
//
// Note: we intentionally compute the id from the rule spec rather than trusting any
// label value, since labels can be user-controlled/tampered with.
func ruleMatchesAlertRuleID(rule monitoringv1.Rule, alertRuleId string) bool {
	return alertRuleId != "" && alertRuleId == alertrule.GetAlertingRuleId(&rule)
}

// getOriginalPlatformRule fetches the PrometheusRule and delegates the rule
// lookup to getOriginalPlatformRuleFromPR.
func (c *client) getOriginalPlatformRule(ctx context.Context, namespace string, name string, alertRuleId string) (*monitoringv1.Rule, error) {
	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", namespace, name, err)
	}

	if !found {
		return nil, &NotFoundError{
			Resource:       "PrometheusRule",
			Id:             alertRuleId,
			AdditionalInfo: fmt.Sprintf("PrometheusRule %s/%s not found", namespace, name),
		}
	}
	return getOriginalPlatformRuleFromPR(pr, namespace, name, alertRuleId)
}
