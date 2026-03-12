package management

import (
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

// ruleMatchesAlertRuleID returns true when the provided rule's computed, deterministic
// alert rule id matches the requested id.
//
// Note: we intentionally compute the id from the rule spec rather than trusting any
// label value, since labels can be user-controlled/tampered with.
func ruleMatchesAlertRuleID(rule monitoringv1.Rule, alertRuleId string) bool {
	return alertRuleId != "" && alertRuleId == alertrule.GetAlertingRuleId(&rule)
}

