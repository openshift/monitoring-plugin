package management

import (
	"context"
	"encoding/json"
	"fmt"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
			if ruleMatchesAlertRuleID(*rule, alertRuleId) {
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

	computedId := alertrule.GetAlertingRuleId(&alertRule)

	// Treat "true clones" (spec-identical rules that compute to the same id) as unsupported.
	// If the updated rule would collide with some other existing rule, reject the update.
	if computedId != "" && computedId != alertRuleId {
		// Check within the same PrometheusRule first (authoritative).
		for groupIdx := range pr.Spec.Groups {
			for ruleIdx := range pr.Spec.Groups[groupIdx].Rules {
				if groupIdx == foundGroupIdx && ruleIdx == foundRuleIdx {
					continue
				}
				existing := pr.Spec.Groups[groupIdx].Rules[ruleIdx]
				// Treat "true clones" as unsupported: identical definitions compute to the same id.
				if existing.Alert != "" && alertrule.GetAlertingRuleId(&existing) == computedId {
					return "", &ConflictError{Message: "alert rule with exact config already exists"}
				}
			}
		}

		_, found := c.k8sClient.RelabeledRules().Get(ctx, computedId)
		if found {
			return "", &ConflictError{Message: "alert rule with exact config already exists"}
		}
	}

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

	if err := c.migrateClassificationOverrideIfRuleIDChanged(ctx, namespace, name, alertRuleId, computedId, alertRule.Alert); err != nil {
		return "", err
	}

	return computedId, nil
}

func (c *client) migrateClassificationOverrideIfRuleIDChanged(
	ctx context.Context,
	ruleNamespace string,
	prometheusRuleName string,
	oldRuleId string,
	newRuleId string,
	alertName string,
) error {
	if oldRuleId == "" || newRuleId == "" || oldRuleId == newRuleId {
		return nil
	}

	overrideNamespace := c.overrideNamespace
	cmName := OverrideConfigMapName(ruleNamespace)
	oldKey := classificationOverrideKey(oldRuleId)
	newKey := classificationOverrideKey(newRuleId)

	for i := 0; i < 3; i++ {
		cm, exists, err := c.k8sClient.ConfigMaps().Get(ctx, overrideNamespace, cmName)
		if err != nil {
			return err
		}
		if !exists || cm == nil || cm.Data == nil {
			return nil
		}

		raw, ok := cm.Data[oldKey]
		if !ok || raw == "" {
			return nil
		}

		if _, already := cm.Data[newKey]; !already {
			var entry alertRuleClassificationOverridePayload
			if err := json.Unmarshal([]byte(raw), &entry); err == nil {
				entry.AlertName = alertName
				entry.RuleName = prometheusRuleName
				entry.RuleNamespace = ruleNamespace
				if encoded, err := json.Marshal(entry); err == nil {
					raw = string(encoded)
				}
			}
			cm.Data[newKey] = raw
		}
		delete(cm.Data, oldKey)

		if cm.Labels == nil {
			cm.Labels = map[string]string{}
		}
		cm.Labels[managementlabels.AlertClassificationOverridesTypeLabelKey] = managementlabels.AlertClassificationOverridesTypeLabelValue
		cm.Labels[managementlabels.AlertClassificationOverridesManagedByLabelKey] = managementlabels.AlertClassificationOverridesManagedByLabelValue
		cm.Labels[k8s.PrometheusRuleLabelNamespace] = ruleNamespace

		if err := c.k8sClient.ConfigMaps().Update(ctx, *cm); err != nil {
			if apierrors.IsConflict(err) {
				continue
			}
			return err
		}
		return nil
	}

	return fmt.Errorf("failed to migrate classification override after retries")
}
