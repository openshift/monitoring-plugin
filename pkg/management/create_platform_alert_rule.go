package management

import (
	"context"
	"fmt"
	"strings"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

const (
	defaultAlertingRuleName  = "platform-alert-rules"
	defaultPlatformGroupName = "platform-alert-rules"
)

func (c *client) CreatePlatformAlertRule(ctx context.Context, alertRule monitoringv1.Rule) (string, error) {
	err := validatePlatformCreateInputs(alertRule)
	if err != nil {
		return "", err
	}

	newRuleId := alertrule.GetAlertingRuleId(&alertRule)

	if _, found := c.k8sClient.RelabeledRules().Get(ctx, newRuleId); found {
		return "", &ConflictError{Message: "alert rule with exact config already exists"}
	}

	if alertRule.Labels == nil {
		alertRule.Labels = map[string]string{}
	}
	alertRule.Labels[k8s.AlertRuleLabelId] = newRuleId

	osmRule := toOSMRule(alertRule)

	existing, found, err := c.k8sClient.AlertingRules().Get(ctx, defaultAlertingRuleName)
	if err != nil {
		return "", fmt.Errorf("failed to get AlertingRule %s: %w", defaultAlertingRuleName, err)
	}

	if found {
		updated := existing.DeepCopy()
		if err := addRuleToGroup(&updated.Spec, defaultPlatformGroupName, osmRule); err != nil {
			return "", err
		}
		if err := c.k8sClient.AlertingRules().Update(ctx, *updated); err != nil {
			return "", fmt.Errorf("failed to update AlertingRule %s: %w", defaultAlertingRuleName, err)
		}
		return newRuleId, nil
	}

	ar := osmv1.AlertingRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      defaultAlertingRuleName,
			Namespace: k8s.ClusterMonitoringNamespace,
		},
		Spec: osmv1.AlertingRuleSpec{
			Groups: []osmv1.RuleGroup{
				{
					Name:  defaultPlatformGroupName,
					Rules: []osmv1.Rule{osmRule},
				},
			},
		},
	}

	if _, err := c.k8sClient.AlertingRules().Create(ctx, ar); err != nil {
		return "", fmt.Errorf("failed to create AlertingRule %s: %w", defaultAlertingRuleName, err)
	}

	return newRuleId, nil
}

func validatePlatformCreateInputs(alertRule monitoringv1.Rule) error {
	alertName := strings.TrimSpace(alertRule.Alert)
	if alertName == "" {
		return &ValidationError{Message: "alert name is required"}
	}

	if strings.TrimSpace(alertRule.Expr.String()) == "" {
		return &ValidationError{Message: "expr is required"}
	}

	if v, ok := alertRule.Labels["severity"]; ok && !isValidSeverity(v) {
		return &ValidationError{Message: fmt.Sprintf("invalid severity %q: must be one of critical|warning|info|none", v)}
	}

	return nil
}

func addRuleToGroup(spec *osmv1.AlertingRuleSpec, groupName string, rule osmv1.Rule) error {
	for i := range spec.Groups {
		if spec.Groups[i].Name != groupName {
			continue
		}
		for _, existing := range spec.Groups[i].Rules {
			if existing.Alert == rule.Alert {
				return &ConflictError{Message: fmt.Sprintf("alert rule %q already exists in group %q", rule.Alert, groupName)}
			}
		}
		spec.Groups[i].Rules = append(spec.Groups[i].Rules, rule)
		return nil
	}
	spec.Groups = append(spec.Groups, osmv1.RuleGroup{
		Name:  groupName,
		Rules: []osmv1.Rule{rule},
	})
	return nil
}

func toOSMRule(rule monitoringv1.Rule) osmv1.Rule {
	osmRule := osmv1.Rule{
		Alert:       rule.Alert,
		Expr:        rule.Expr,
		Labels:      rule.Labels,
		Annotations: rule.Annotations,
	}

	if rule.For != nil {
		osmRule.For = osmv1.Duration(*rule.For)
	}

	return osmRule
}
