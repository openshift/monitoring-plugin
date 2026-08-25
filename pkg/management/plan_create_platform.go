package management

import (
	"context"
	"fmt"
	"strings"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

const (
	defaultAlertingRuleName  = "platform-alert-rules"
	defaultPlatformGroupName = "platform-alert-rules"
)

type createPlatformPlan struct {
	computedRuleID string
	osmRule        osmv1.Rule
	groupName      string
	groupIdx       int
	existingAR     *osmv1.AlertingRule
	arExists       bool
	writable       bool
	managedBy      ManagementSource
}

func (c *client) planCreatePlatformAlertRule(ctx context.Context, alertRule monitoringv1.Rule) (*createPlatformPlan, error) {
	if err := validateAlertRuleInputs(alertRule); err != nil {
		return nil, err
	}

	computedRuleID := alertrule.GetAlertingRuleId(&alertRule)
	if _, found := c.k8sClient.RelabeledRules().Get(ctx, computedRuleID); found {
		return nil, &ConflictError{Message: "alert rule with exact config already exists"}
	}

	preparedRule := alertRule
	if preparedRule.Labels == nil {
		preparedRule.Labels = map[string]string{}
	}
	preparedRule.Labels[k8s.AlertRuleLabelId] = computedRuleID
	osmRule := toOSMRule(preparedRule)

	existing, found, err := c.k8sClient.AlertingRules().Get(ctx, defaultAlertingRuleName)
	if err != nil {
		return nil, fmt.Errorf("failed to get AlertingRule %s: %w", defaultAlertingRuleName, err)
	}

	managedBy := ManagementSource("")
	writable := true
	groupIdx := 0
	if found && existing != nil {
		managedBy = managedByFromObject(existing)
		switch managedBy {
		case ManagedByGitOps, ManagedByOperator:
			writable = false
		}
		for i, g := range existing.Spec.Groups {
			if g.Name == defaultPlatformGroupName {
				groupIdx = i
				for _, r := range g.Rules {
					if r.Alert == osmRule.Alert {
						return nil, &ConflictError{
							Message: fmt.Sprintf("alert rule %q already exists in group %q", osmRule.Alert, defaultPlatformGroupName),
						}
					}
				}
				break
			}
		}
		if groupIdx == 0 && (len(existing.Spec.Groups) == 0 || existing.Spec.Groups[0].Name != defaultPlatformGroupName) {
			groupIdx = len(existing.Spec.Groups)
		}
	}

	return &createPlatformPlan{
		computedRuleID: computedRuleID,
		osmRule:        osmRule,
		groupName:      defaultPlatformGroupName,
		groupIdx:       groupIdx,
		existingAR:     existing,
		arExists:       found,
		writable:       writable,
		managedBy:      managedBy,
	}, nil
}

func (p *createPlatformPlan) toRuleChangePlan() (*RuleChangePlan, error) {
	rule := osmRuleToMonitoringV1(p.osmRule)
	desiredAR := buildDesiredAlertingRuleWithAddedRule(p.existingAR, p.groupName, p.groupIdx, p.osmRule)
	desiredAR.Namespace = k8s.ClusterMonitoringNamespace
	desiredAR.Name = defaultAlertingRuleName
	desiredObject, err := alertingRuleDesiredObject(desiredAR)
	if err != nil {
		return nil, err
	}
	return buildCreateRuleChangePlan(
		p.writable,
		p.managedBy,
		alertingRuleRef(k8s.ClusterMonitoringNamespace, defaultAlertingRuleName),
		rule,
		desiredObject,
	), nil
}

func osmRuleToMonitoringV1(r osmv1.Rule) monitoringv1.Rule {
	rule := monitoringv1.Rule{
		Alert:       r.Alert,
		Expr:        r.Expr,
		Labels:      r.Labels,
		Annotations: r.Annotations,
	}
	if r.For != "" {
		d := monitoringv1.Duration(r.For)
		rule.For = &d
	}
	return rule
}

func enforceCreatePlatformWritable(plan *createPlatformPlan) error {
	if plan.writable {
		return nil
	}
	switch plan.managedBy {
	case ManagedByGitOps:
		return &NotAllowedError{Message: "The AlertingRule is managed by GitOps; create the alert in Git."}
	case ManagedByOperator:
		return &NotAllowedError{Message: "This AlertingRule is managed by an operator; you cannot add alerts to it."}
	default:
		return &NotAllowedError{Message: "cannot create alert rule in the target AlertingRule"}
	}
}

func (c *client) executeCreatePlatformPlan(ctx context.Context, plan *createPlatformPlan) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		existing, found, getErr := c.k8sClient.AlertingRules().Get(ctx, defaultAlertingRuleName)
		if getErr != nil {
			return fmt.Errorf("failed to get AlertingRule %s: %w", defaultAlertingRuleName, getErr)
		}
		if found {
			if gitOpsManaged, operatorManaged := k8s.IsExternallyManagedObject(existing); gitOpsManaged {
				return &NotAllowedError{Message: "The AlertingRule is managed by GitOps; create the alert in Git."}
			} else if operatorManaged {
				return &NotAllowedError{Message: "This AlertingRule is managed by an operator; you cannot add alerts to it."}
			}
			updated := existing.DeepCopy()
			if addErr := addRuleToGroup(&updated.Spec, plan.groupName, plan.osmRule); addErr != nil {
				return addErr
			}
			if updateErr := c.k8sClient.AlertingRules().Update(ctx, *updated); updateErr != nil {
				return fmt.Errorf("failed to update AlertingRule %s: %w", defaultAlertingRuleName, updateErr)
			}
			return nil
		}

		ar := osmv1.AlertingRule{
			ObjectMeta: metav1.ObjectMeta{
				Name:      defaultAlertingRuleName,
				Namespace: k8s.ClusterMonitoringNamespace,
			},
			Spec: osmv1.AlertingRuleSpec{
				Groups: []osmv1.RuleGroup{{
					Name:  plan.groupName,
					Rules: []osmv1.Rule{plan.osmRule},
				}},
			},
		}
		if _, createErr := c.k8sClient.AlertingRules().Create(ctx, ar); createErr != nil {
			return fmt.Errorf("failed to create AlertingRule %s: %w", defaultAlertingRuleName, createErr)
		}
		return nil
	})
}

func validateAlertRuleInputs(alertRule monitoringv1.Rule) error {
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
