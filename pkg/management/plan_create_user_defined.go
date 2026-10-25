package management

import (
	"context"
	"maps"
	"strings"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

const DefaultGroupName = "user-defined-rules"

type createUserDefinedPlan struct {
	computedRuleID string
	preparedRule   monitoringv1.Rule
	nn             types.NamespacedName
	groupName      string
	groupIdx       int
	existingPR     *monitoringv1.PrometheusRule
	writable       bool
	managedBy      *ManagementSource
}

func (c *client) planCreateUserDefinedAlertRule(
	ctx context.Context,
	alertRule monitoringv1.Rule,
	prOptions PrometheusRuleOptions,
) (*createUserDefinedPlan, error) {
	if prOptions.Name == "" || prOptions.Namespace == "" {
		return nil, &ValidationError{Message: "PrometheusRule Name and Namespace must be specified"}
	}

	if err := validateAlertRuleInputs(alertRule); err != nil {
		return nil, err
	}

	computedRuleID := alertrule.GetAlertingRuleId(&alertRule)
	preparedRule := ruleWithStampedID(alertRule, computedRuleID)

	if _, found := c.k8sClient.RelabeledRules().Get(ctx, computedRuleID); found {
		return nil, &ConflictError{Message: "alert rule with exact config already exists"}
	}
	if c.existsUserDefinedRuleWithSameSpec(ctx, alertRule) {
		return nil, &ConflictError{Message: "alert rule with equivalent spec already exists"}
	}

	nn := types.NamespacedName{Name: prOptions.Name, Namespace: prOptions.Namespace}
	if c.isPlatformManagedPrometheusRule(nn) {
		return nil, &NotAllowedError{
			Message: "cannot add user-defined alert rule to a platform-managed PrometheusRule; create an AlertingRule CR instead",
		}
	}

	groupName := prOptions.GroupName
	if groupName == "" {
		groupName = DefaultGroupName
	}

	pr, prFound, err := c.k8sClient.PrometheusRules().Get(ctx, nn.Namespace, nn.Name)
	if err != nil {
		return nil, err
	}

	managedBy := (*ManagementSource)(nil)
	writable := true
	groupIdx := 0
	if prFound && pr != nil {
		managedBy = managedByFromObject(pr)
		writable = managedBy == nil
		for _, g := range pr.Spec.Groups {
			for _, r := range g.Rules {
				if r.Alert != "" && alertrule.GetAlertingRuleId(&r) == computedRuleID {
					return nil, &ConflictError{Message: "alert rule with exact config already exists"}
				}
			}
		}
		groupFound := false
		for i, g := range pr.Spec.Groups {
			if g.Name == groupName {
				groupIdx = i
				groupFound = true
				break
			}
		}
		if !groupFound {
			groupIdx = len(pr.Spec.Groups)
		}
	}

	return &createUserDefinedPlan{
		computedRuleID: computedRuleID,
		preparedRule:   preparedRule,
		nn:             nn,
		groupName:      groupName,
		groupIdx:       groupIdx,
		existingPR:     pr,
		writable:       writable,
		managedBy:      managedBy,
	}, nil
}

func (p *createUserDefinedPlan) toRuleChangePlan() (*RuleChangePlan, error) {
	desiredPR := buildDesiredPrometheusRuleWithAddedRule(p.existingPR, p.groupName, p.groupIdx, p.preparedRule)
	if desiredPR.Namespace == "" {
		desiredPR.Namespace = p.nn.Namespace
	}
	if desiredPR.Name == "" {
		desiredPR.Name = p.nn.Name
	}
	desiredObject, err := prometheusRuleToObject(desiredPR)
	if err != nil {
		return nil, err
	}
	return buildCreateRuleChangePlan(
		p.writable,
		p.managedBy,
		prometheusRuleRef(p.nn.Namespace, p.nn.Name),
		p.preparedRule,
		desiredObject,
	), nil
}

func notAllowedCreateForManagedBy(source ManagementSource) error {
	switch source {
	case ManagedByGitOps:
		return &NotAllowedError{Message: "This PrometheusRule is managed by GitOps; create the alert in Git."}
	case ManagedByOperator:
		return &NotAllowedError{Message: "This PrometheusRule is managed by an operator; you cannot add alerts to it."}
	default:
		return &NotAllowedError{Message: "cannot create alert rule in the target PrometheusRule"}
	}
}

func enforceCreateUserDefinedWritable(plan *createUserDefinedPlan) error {
	if plan.writable {
		return nil
	}
	if plan.managedBy == nil {
		return &NotAllowedError{Message: "cannot create alert rule in the target PrometheusRule"}
	}
	return notAllowedCreateForManagedBy(*plan.managedBy)
}

func (c *client) executeCreateUserDefinedPlan(ctx context.Context, plan *createUserDefinedPlan) error {
	return c.k8sClient.PrometheusRules().AddRule(
		ctx, plan.nn, plan.groupName, plan.preparedRule,
		func(pr *monitoringv1.PrometheusRule) error {
			// Re-check ownership on every attempt: the PrometheusRule may
			// have become externally managed after the plan was computed.
			if managedBy := managedByFromObject(pr); managedBy != nil {
				return notAllowedCreateForManagedBy(*managedBy)
			}
			return nil
		},
	)
}

// existsUserDefinedRuleWithSameSpec returns true if a rule with an equivalent
// specification already exists in the relabeled rules cache. Only rules whose
// source PrometheusRule the caller is authorized to read are considered, so
// the duplicate check does not disclose matches outside the caller's access.
func (c *client) existsUserDefinedRuleWithSameSpec(ctx context.Context, candidate monitoringv1.Rule) bool {
	for _, existing := range c.k8sClient.RelabeledRules().List(ctx) {
		if !rulesHaveEquivalentSpec(existing, candidate) {
			continue
		}
		if c.callerCanReadRuleSource(ctx, existing) {
			return true
		}
	}
	return false
}

// callerCanReadRuleSource reports whether the caller can read the
// PrometheusRule a relabeled rule originated from. PrometheusRules().Get runs
// with the caller's authorization context, so forbidden reads filter the rule
// out of the duplicate check instead of disclosing it.
func (c *client) callerCanReadRuleSource(ctx context.Context, rule monitoringv1.Rule) bool {
	namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	name := rule.Labels[k8s.PrometheusRuleLabelName]
	if namespace == "" || name == "" {
		return false
	}
	_, found, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	return err == nil && found
}

func rulesHaveEquivalentSpec(a, b monitoringv1.Rule) bool {
	if alertrule.NormalizeExpr(a.Expr.String()) != alertrule.NormalizeExpr(b.Expr.String()) {
		return false
	}
	var af, bf string
	if a.For != nil {
		af = string(*a.For)
	}
	if b.For != nil {
		bf = string(*b.For)
	}
	if af != bf {
		return false
	}
	if nonEmptyDurationString(a.KeepFiringFor) != nonEmptyDurationString(b.KeepFiringFor) {
		return false
	}
	return maps.Equal(filterBusinessLabels(a.Labels), filterBusinessLabels(b.Labels))
}

func filterBusinessLabels(in map[string]string) map[string]string {
	out := map[string]string{}
	for k, v := range in {
		if strings.HasPrefix(k, "openshift_io_") || k == managementlabels.AlertNameLabel {
			continue
		}
		out[k] = v
	}
	return out
}
