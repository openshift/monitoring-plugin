package management

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

// UpdateAlertRuleLabels updates labels on any alert rule, routing internally
// to the platform (ARC-based) or user-defined (PrometheusRule mutation) path.
// Labels with nil or empty-string values are dropped; non-empty values are set.
func (c *client) UpdateAlertRuleLabels(ctx context.Context, alertRuleId string, labels map[string]*string) (string, error) {
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found {
		return "", &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	name := rule.Labels[k8s.PrometheusRuleLabelName]
	nn := types.NamespacedName{Namespace: namespace, Name: name}

	if c.isPlatformManagedPrometheusRule(nn) {
		return c.updatePlatformRuleLabels(ctx, alertRuleId, labels)
	}

	return c.updateUserRuleLabels(ctx, alertRuleId, rule, labels)
}

// updatePlatformRuleLabels applies label changes to a platform rule via ARC.
// The platform path uses "" to signal "drop this label".
func (c *client) updatePlatformRuleLabels(ctx context.Context, alertRuleId string, labels map[string]*string) (string, error) {
	platformLabels := make(map[string]string, len(labels))
	for k, pv := range labels {
		if pv == nil || *pv == "" {
			platformLabels[k] = ""
		} else {
			platformLabels[k] = *pv
		}
	}

	updatedRule := monitoringv1.Rule{Labels: platformLabels}
	if err := c.UpdatePlatformAlertRule(ctx, alertRuleId, updatedRule); err != nil {
		return "", err
	}
	return alertRuleId, nil
}

// updateUserRuleLabels merges label changes onto the source rule (from the
// PrometheusRule, not the relabeled cache) and updates the PrometheusRule directly.
func (c *client) updateUserRuleLabels(ctx context.Context, alertRuleId string, relabeled monitoringv1.Rule, labels map[string]*string) (string, error) {
	namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
	name := relabeled.Labels[k8s.PrometheusRuleLabelName]

	pr, prFound, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return "", err
	}
	if !prFound {
		return "", &NotFoundError{Resource: "PrometheusRule", Id: alertRuleId}
	}

	sourceRule, err := getOriginalPlatformRuleFromPR(pr, namespace, name, alertRuleId)
	if err != nil {
		return "", err
	}

	userLabels := make(map[string]string, len(sourceRule.Labels))
	for k, v := range sourceRule.Labels {
		userLabels[k] = v
	}
	for k, pv := range labels {
		if pv == nil || *pv == "" {
			delete(userLabels, k)
		} else {
			userLabels[k] = *pv
		}
	}

	updatedRule := *sourceRule
	updatedRule.Labels = userLabels
	return c.UpdateUserDefinedAlertRule(ctx, alertRuleId, updatedRule)
}
