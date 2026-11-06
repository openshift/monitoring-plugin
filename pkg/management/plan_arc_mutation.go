package management

import (
	"regexp"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

type arcMutationResult struct {
	configs   []osmv1.RelabelConfig
	deleteARC bool
	noOp      bool
}

// computeARCLabelMutation mirrors applyLabelChangesViaAlertRelabelConfig without persisting.
func computeARCLabelMutation(
	originalRule monitoringv1.Rule,
	alertRuleID string,
	filteredLabels map[string]string,
	existingArc *osmv1.AlertRelabelConfig,
	arcFound bool,
) arcMutationResult {
	original := copyStringMap(originalRule.Labels)
	existingOverrides, existingDrops := collectExistingFromARC(arcFound, existingArc)
	existingRuleDrops := getExistingRuleDrops(existingArc, alertRuleID)
	effective := computeEffectiveLabels(original, existingOverrides, existingDrops)

	if len(filteredLabels) == 0 {
		return arcMutationResult{noOp: true}
	}

	desired := buildDesiredLabels(effective, filteredLabels)
	nextChanges := buildNextLabelChanges(original, desired)

	if len(nextChanges) == 0 {
		if !arcFound {
			return arcMutationResult{noOp: true}
		}
		if len(existingRuleDrops) > 0 {
			configs := buildRelabelConfigs(originalRule.Alert, original, alertRuleID, nil)
			configs = appendPreservedRuleDrops(configs, existingRuleDrops)
			return arcMutationResult{configs: configs}
		}
		return arcMutationResult{deleteARC: true}
	}

	configs := buildRelabelConfigs(originalRule.Alert, original, alertRuleID, nextChanges)
	configs = appendPreservedRuleDrops(configs, existingRuleDrops)
	return arcMutationResult{configs: configs}
}

func computeARCDropMutation(
	originalRule monitoringv1.Rule,
	alertRuleID string,
	existingArc *osmv1.AlertRelabelConfig,
	arcExists bool,
) arcMutationResult {
	original := copyStringMap(originalRule.Labels)
	stampOnly := buildRelabelConfigs(originalRule.Alert, original, alertRuleID, nil)
	var stamp osmv1.RelabelConfig
	if len(stampOnly) > 0 {
		stamp = stampOnly[0]
	}

	dropCfg := osmv1.RelabelConfig{
		SourceLabels: []osmv1.LabelName{k8s.AlertRuleLabelId},
		Regex:        regexp.QuoteMeta(alertRuleID),
		Action:       "Drop",
	}

	var next []osmv1.RelabelConfig
	if arcExists && existingArc != nil {
		next = append(next, existingArc.Spec.Configs...)
	}

	changed := ensureStampAndDrop(&next, stamp, dropCfg, alertRuleID)
	if !changed {
		return arcMutationResult{noOp: true}
	}
	return arcMutationResult{configs: next}
}

func computeARCRestoreMutation(
	alertRuleID string,
	existingArc *osmv1.AlertRelabelConfig,
) arcMutationResult {
	if existingArc == nil {
		return arcMutationResult{noOp: true}
	}
	filtered, removed := filterOutDrop(existingArc.Spec.Configs, alertRuleID)
	if !removed {
		return arcMutationResult{noOp: true}
	}
	if len(filtered) == 0 || isStampOnly(filtered) {
		return arcMutationResult{deleteARC: true}
	}
	return arcMutationResult{configs: filtered}
}

func buildDesiredAlertRelabelConfigObject(
	arcNamespace, arcName, prName, alertName, alertRuleID string,
	existingArc *osmv1.AlertRelabelConfig,
	arcFound bool,
	result arcMutationResult,
) *osmv1.AlertRelabelConfig {
	if result.deleteARC || result.noOp && !arcFound {
		return nil
	}
	if result.noOp && arcFound && existingArc != nil {
		return existingArc.DeepCopy()
	}

	if arcFound && existingArc != nil {
		arc := existingArc.DeepCopy()
		arc.Spec = osmv1.AlertRelabelConfigSpec{Configs: result.configs}
		if arc.Labels == nil {
			arc.Labels = map[string]string{}
		}
		arc.Labels[managementlabels.ARCLabelPrometheusRuleNameKey] = prName
		arc.Labels[managementlabels.ARCLabelAlertNameKey] = alertName
		if arc.Annotations == nil {
			arc.Annotations = map[string]string{}
		}
		arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey] = alertRuleID
		return arc
	}

	return &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      arcName,
			Namespace: arcNamespace,
			Labels: map[string]string{
				managementlabels.ARCLabelPrometheusRuleNameKey: prName,
				managementlabels.ARCLabelAlertNameKey:          alertName,
			},
			Annotations: map[string]string{
				managementlabels.ARCAnnotationAlertRuleIDKey: alertRuleID,
			},
		},
		Spec: osmv1.AlertRelabelConfigSpec{Configs: result.configs},
	}
}

func diffEffectiveLabelChanges(before, after map[string]string) []RuleChange {
	return diffLabelSemanticChanges("", before, after)
}
