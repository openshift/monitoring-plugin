package management

import (
	"context"
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
	managedBy      ManagementSource
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
	preparedRule := alertRule
	if preparedRule.Labels == nil {
		preparedRule.Labels = map[string]string{}
	}
	preparedRule.Labels[k8s.AlertRuleLabelId] = computedRuleID

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

	managedBy := ManagementSource("")
	writable := true
	if prFound && pr != nil {
		managedBy = managedByFromObject(pr)
		switch managedBy {
		case ManagedByGitOps, ManagedByOperator:
			writable = false
		}
		for _, g := range pr.Spec.Groups {
			for _, r := range g.Rules {
				if r.Alert != "" && alertrule.GetAlertingRuleId(&r) == computedRuleID {
					return nil, &ConflictError{Message: "alert rule with exact config already exists"}
				}
			}
		}
	}

	var prForGroup *monitoringv1.PrometheusRule
	if prFound {
		prForGroup = pr
	}
	groupIdx := resolvePrometheusRuleGroupIndex(prForGroup, groupName)

	return &createUserDefinedPlan{
		computedRuleID: computedRuleID,
		preparedRule:   preparedRule,
		nn:             nn,
		groupName:      groupName,
		groupIdx:       groupIdx,
		existingPR:     prForGroup,
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
	desiredObject, err := prometheusRuleDesiredObject(desiredPR)
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

func enforceCreateUserDefinedWritable(plan *createUserDefinedPlan) error {
	if plan.writable {
		return nil
	}
	switch plan.managedBy {
	case ManagedByGitOps:
		return &NotAllowedError{Message: "This PrometheusRule is managed by GitOps; create the alert in Git."}
	case ManagedByOperator:
		return &NotAllowedError{Message: "This PrometheusRule is managed by an operator; you cannot add alerts to it."}
	default:
		return &NotAllowedError{Message: "cannot create alert rule in the target PrometheusRule"}
	}
}

func (c *client) executeCreateUserDefinedPlan(ctx context.Context, plan *createUserDefinedPlan) error {
	return c.k8sClient.PrometheusRules().AddRule(ctx, plan.nn, plan.groupName, plan.preparedRule)
}

// existsUserDefinedRuleWithSameSpec returns true if a rule with an equivalent
// specification already exists in the relabeled rules cache.
func (c *client) existsUserDefinedRuleWithSameSpec(ctx context.Context, candidate monitoringv1.Rule) bool {
	for _, existing := range c.k8sClient.RelabeledRules().List(ctx) {
		if rulesHaveEquivalentSpec(existing, candidate) {
			return true
		}
	}
	return false
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
	al := filterBusinessLabels(a.Labels)
	bl := filterBusinessLabels(b.Labels)
	if len(al) != len(bl) {
		return false
	}
	for k, v := range al {
		if bl[k] != v {
			return false
		}
	}
	return true
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
