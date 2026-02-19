package management

import (
	"context"
	"strings"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"
)

const (
	DefaultGroupName = "user-defined-rules"
)

func (c *client) CreateUserDefinedAlertRule(ctx context.Context, alertRule monitoringv1.Rule, prOptions PrometheusRuleOptions) (string, error) {
	if prOptions.Name == "" || prOptions.Namespace == "" {
		return "", &ValidationError{Message: "PrometheusRule Name and Namespace must be specified"}
	}

	// compute id from the rule content BEFORE mutating labels
	computedRuleID := alertrule.GetAlertingRuleId(&alertRule)
	// set/stamp the rule id label on user-defined rules
	if alertRule.Labels == nil {
		alertRule.Labels = map[string]string{}
	}
	alertRule.Labels[k8s.AlertRuleLabelId] = computedRuleID

	// Check if rule with the same ID already exists (fast path)
	_, found := c.k8sClient.RelabeledRules().Get(ctx, computedRuleID)
	if found {
		return "", &ConflictError{Message: "alert rule with exact config already exists"}
	}

	// Deny creating an equivalent rule (same spec: expr, for, labels including severity) even if alert name differs
	if c.existsUserDefinedRuleWithSameSpec(ctx, alertRule) {
		return "", &ConflictError{Message: "alert rule with equivalent spec already exists"}
	}

	nn := types.NamespacedName{
		Name:      prOptions.Name,
		Namespace: prOptions.Namespace,
	}

	if c.IsPlatformAlertRule(nn) {
		return "", &NotAllowedError{Message: "cannot add user-defined alert rule to a platform-managed PrometheusRule"}
	}

	// Enforce uniqueness within the target PrometheusRule:
	// - "True clones" (different entries with identical definitions) are unsupported; they compute to the same rule ID.
	pr, prFound, err := c.k8sClient.PrometheusRules().Get(ctx, nn.Namespace, nn.Name)
	if err != nil {
		return "", err
	}
	if prFound && pr != nil {
		for _, g := range pr.Spec.Groups {
			for _, r := range g.Rules {
				// Treat "true clones" as unsupported: identical definitions compute to the same id.
				if r.Alert != "" && alertrule.GetAlertingRuleId(&r) == computedRuleID {
					return "", &ConflictError{Message: "alert rule with exact config already exists"}
				}
			}
		}
	}

	if prOptions.GroupName == "" {
		prOptions.GroupName = DefaultGroupName
	}

	err = c.k8sClient.PrometheusRules().AddRule(ctx, nn, prOptions.GroupName, alertRule)
	if err != nil {
		return "", err
	}

	return computedRuleID, nil
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

// rulesHaveEquivalentSpec compares two alert rules for equivalence based on
// expression, duration (for) and non-system labels (excluding openshift_io_* and alertname).
func rulesHaveEquivalentSpec(a, b monitoringv1.Rule) bool {
	if a.Expr.String() != b.Expr.String() {
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

// filterBusinessLabels returns labels excluding system/provenance and identity labels.
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
