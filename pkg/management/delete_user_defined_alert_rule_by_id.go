package management

import (
	"context"
	"errors"
	"fmt"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func (c *client) DeleteAlertRuleById(ctx context.Context, alertRuleId string) error {
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found {
		return &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	name := rule.Labels[k8s.PrometheusRuleLabelName]

	// Disallow deleting any GitOps-managed rule
	if err := validateUserDeletePreconditions(rule); err != nil {
		return err
	}

	if c.isPlatformManagedPrometheusRule(types.NamespacedName{Namespace: namespace, Name: name}) {
		return c.deletePlatformAlertRuleById(ctx, rule, alertRuleId)
	}

	// user-source branch: preconditions were validated above

	return c.deleteUserAlertRuleById(ctx, namespace, name, alertRuleId)
}

func (c *client) filterRulesById(rules []monitoringv1.Rule, alertRuleId string, updated *bool) []monitoringv1.Rule {
	var newRules []monitoringv1.Rule

	for _, rule := range rules {
		if ruleMatchesAlertRuleID(rule, alertRuleId) {
			*updated = true
			continue
		}
		newRules = append(newRules, rule)
	}

	return newRules
}

// deletePlatformAlertRuleById deletes a platform rule from its owning AlertingRule CR.
func (c *client) deletePlatformAlertRuleById(ctx context.Context, relabeled monitoringv1.Rule, alertRuleId string) error {
	namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
	name := relabeled.Labels[k8s.PrometheusRuleLabelName]

	// Delete from owning AlertingRule
	arName := relabeled.Labels[managementlabels.AlertingRuleLabelName]
	if arName == "" {
		arName = defaultAlertingRuleName
	}
	ar, found, err := c.k8sClient.AlertingRules().Get(ctx, arName)
	if err != nil {
		return fmt.Errorf("failed to get AlertingRule %s: %w", arName, err)
	}
	if !found || ar == nil {
		return c.deleteUserAlertRuleById(ctx, namespace, name, alertRuleId)
	}
	// Common preconditions for platform delete
	if err := validatePlatformDeletePreconditions(ar); err != nil {
		return err
	}

	// Find original platform rule for reliable match by alert name
	originalRule, err := c.getOriginalPlatformRule(ctx, namespace, name, alertRuleId)
	if err != nil {
		return err
	}

	updated, newGroups := removeAlertFromAlertingRuleGroups(ar.Spec.Groups, originalRule.Alert)
	if !updated {
		return &NotFoundError{
			Resource:       "AlertRule",
			Id:             alertRuleId,
			AdditionalInfo: fmt.Sprintf("alert %q not found in AlertingRule %s", originalRule.Alert, arName),
		}
	}

	if len(newGroups) == 0 {
		if err := c.k8sClient.AlertingRules().Delete(ctx, ar.Name); err != nil {
			return fmt.Errorf("failed to delete AlertingRule %s: %w", ar.Name, err)
		}
	} else {
		ar.Spec.Groups = newGroups
		if err := c.k8sClient.AlertingRules().Update(ctx, *ar); err != nil {
			return fmt.Errorf("failed to update AlertingRule %s: %w", ar.Name, err)
		}
	}

	if err := c.deleteAssociatedARC(ctx, k8s.ClusterMonitoringNamespace, name, alertRuleId); err != nil {
		return fmt.Errorf("failed to clean up ARC for platform rule %s: %w", alertRuleId, err)
	}
	return nil
}

// deleteUserAlertRuleById deletes a user-sourced rule from its PrometheusRule.
func (c *client) deleteUserAlertRuleById(ctx context.Context, namespace, name, alertRuleId string) error {
	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return err
	}
	if !found {
		return &NotFoundError{Resource: "PrometheusRule", Id: fmt.Sprintf("%s/%s", namespace, name)}
	}
	if gitOpsManaged, _ := k8s.IsExternallyManagedObject(pr); gitOpsManaged {
		return notAllowedGitOpsRemove()
	}

	updated := false
	var newGroups []monitoringv1.RuleGroup
	for _, group := range pr.Spec.Groups {
		newRules := c.filterRulesById(group.Rules, alertRuleId, &updated)
		if len(newRules) > 0 {
			group.Rules = newRules
			newGroups = append(newGroups, group)
		}
	}
	if !updated {
		return &NotFoundError{Resource: "AlertRule", Id: alertRuleId, AdditionalInfo: "rule not found in the given PrometheusRule"}
	}

	if len(newGroups) == 0 {
		if err := c.k8sClient.PrometheusRules().Delete(ctx, pr.Namespace, pr.Name); err != nil {
			return fmt.Errorf("failed to delete PrometheusRule %s/%s: %w", pr.Namespace, pr.Name, err)
		}
		return c.cleanupARCForDeletedRule(ctx, namespace, name, alertRuleId)
	}

	pr.Spec.Groups = newGroups
	if err := c.k8sClient.PrometheusRules().Update(ctx, *pr); err != nil {
		return fmt.Errorf("failed to update PrometheusRule %s/%s: %w", pr.Namespace, pr.Name, err)
	}
	return c.cleanupARCForDeletedRule(ctx, namespace, name, alertRuleId)
}

// cleanupARCForDeletedRule attempts to remove any associated ARC after a rule is deleted.
// It determines the ARC namespace from the rule's namespace and silently skips if
// ARCs are not applicable (e.g. user-defined rules where ARCs are not supported).
func (c *client) cleanupARCForDeletedRule(ctx context.Context, namespace, name, alertRuleId string) error {
	nn := types.NamespacedName{Namespace: namespace, Name: name}
	arcNamespace, err := c.arcNamespaceForRule(nn)
	if err != nil {
		var na *NotAllowedError
		if errors.As(err, &na) {
			return nil
		}
		return fmt.Errorf("failed to resolve ARC namespace for %s/%s: %w", namespace, name, err)
	}
	return c.deleteAssociatedARC(ctx, arcNamespace, name, alertRuleId)
}

// deleteAssociatedARC removes the AlertRelabelConfig associated with an alert rule, if it exists.
// This is best-effort: if the ARC does not exist or is GitOps-managed, it is silently skipped.
func (c *client) deleteAssociatedARC(ctx context.Context, namespace, prName, alertRuleId string) error {
	arcName := k8s.GetAlertRelabelConfigName(prName, alertRuleId)
	arc, found, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, namespace, arcName)
	if err != nil {
		return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", namespace, arcName, err)
	}
	if !found {
		return nil
	}
	if gitOpsManaged, _ := k8s.IsExternallyManagedObject(arc); gitOpsManaged {
		return nil
	}
	return c.k8sClient.AlertRelabelConfigs().Delete(ctx, namespace, arcName)
}

// removeAlertFromAlertingRuleGroups removes all instances of an alert by alert name across groups.
// Returns whether any change occurred and the resulting groups (dropping empty groups).
func removeAlertFromAlertingRuleGroups(groups []osmv1.RuleGroup, alertName string) (bool, []osmv1.RuleGroup) {
	updated := false
	newGroups := make([]osmv1.RuleGroup, 0, len(groups))
	for _, g := range groups {
		var kept []osmv1.Rule
		for _, r := range g.Rules {
			if r.Alert == alertName {
				updated = true
				continue
			}
			kept = append(kept, r)
		}
		if len(kept) > 0 {
			g.Rules = kept
			newGroups = append(newGroups, g)
		} else if len(g.Rules) > 0 {
			updated = true
		}
	}
	return updated, newGroups
}
