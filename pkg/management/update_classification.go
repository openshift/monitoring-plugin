package management

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/classification"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// UpdateRuleClassificationRequest represents a single classification update
type UpdateRuleClassificationRequest struct {
	RuleId           string  `json:"ruleId"`
	Component        *string `json:"openshift_io_alert_rule_component,omitempty"`
	ComponentSet     bool    `json:"-"`
	Layer            *string `json:"openshift_io_alert_rule_layer,omitempty"`
	LayerSet         bool    `json:"-"`
	ComponentFrom    *string `json:"openshift_io_alert_rule_component_from,omitempty"`
	ComponentFromSet bool    `json:"-"`
	LayerFrom        *string `json:"openshift_io_alert_rule_layer_from,omitempty"`
	LayerFromSet     bool    `json:"-"`
}

// UpdateAlertRuleClassification updates classification labels for a single
// operator-managed alert rule.
func (c *client) UpdateAlertRuleClassification(ctx context.Context, req UpdateRuleClassificationRequest) error {
	if req.RuleId == "" {
		return &ValidationError{Message: "ruleId is required"}
	}

	if req.Component != nil && !classification.ValidateComponent(*req.Component) {
		return &ValidationError{Message: fmt.Sprintf("invalid component %q", *req.Component)}
	}
	if req.Layer != nil && !classification.ValidateLayer(*req.Layer) {
		return &ValidationError{Message: fmt.Sprintf("invalid layer %q (allowed: cluster, namespace)", *req.Layer)}
	}
	if req.ComponentFrom != nil {
		v := strings.TrimSpace(*req.ComponentFrom)
		if v != "" && !classification.ValidatePromLabelName(v) {
			return &ValidationError{Message: fmt.Sprintf("invalid openshift_io_alert_rule_component_from %q (must be a valid Prometheus label name)", *req.ComponentFrom)}
		}
	}
	if req.LayerFrom != nil {
		v := strings.TrimSpace(*req.LayerFrom)
		if v != "" && !classification.ValidatePromLabelName(v) {
			return &ValidationError{Message: fmt.Sprintf("invalid openshift_io_alert_rule_layer_from %q (must be a valid Prometheus label name)", *req.LayerFrom)}
		}
	}

	// Find the base rule to locate its PrometheusRule namespace
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, req.RuleId)
	if !found {
		return &NotFoundError{Resource: "AlertRule", Id: req.RuleId}
	}

	if !req.ComponentSet && !req.LayerSet && !req.ComponentFromSet && !req.LayerFromSet {
		return nil
	}

	labels := buildClassificationLabels(req)

	ns := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	name := rule.Labels[k8s.PrometheusRuleLabelName]

	if c.isPlatformManagedPrometheusRule(types.NamespacedName{Namespace: ns, Name: name}) {
		return c.applyClassificationViaARC(ctx, req.RuleId, rule, labels, k8s.ClusterMonitoringNamespace)
	}

	if !c.enableUserWorkloadARCs {
		return &NotAllowedError{Message: "classification updates for user-defined workload rules require ENABLE_USER_WORKLOAD_ARCS"}
	}

	return c.applyClassificationViaARC(ctx, req.RuleId, rule, labels, k8s.UserWorkloadMonitoringNamespace)
}

// BulkUpdateAlertRuleClassification updates multiple entries; returns per-item errors collected by caller
func (c *client) BulkUpdateAlertRuleClassification(ctx context.Context, items []UpdateRuleClassificationRequest) []error {
	errs := make([]error, len(items))
	for i := range items {
		errs[i] = c.UpdateAlertRuleClassification(ctx, items[i])
	}
	return errs
}

// buildClassificationLabels converts the classification request fields into a
// label map suitable for the label-based update paths. Empty string means "drop
// this label" which the ARC/PR update paths already handle.
func buildClassificationLabels(req UpdateRuleClassificationRequest) map[string]string {
	labels := map[string]string{}
	anySet := false

	if req.ComponentSet {
		if req.Component == nil {
			labels[k8s.AlertRuleClassificationComponentKey] = ""
		} else {
			labels[k8s.AlertRuleClassificationComponentKey] = *req.Component
		}
		anySet = true
	}
	if req.LayerSet {
		if req.Layer == nil {
			labels[k8s.AlertRuleClassificationLayerKey] = ""
		} else {
			labels[k8s.AlertRuleClassificationLayerKey] = strings.ToLower(strings.TrimSpace(*req.Layer))
		}
		anySet = true
	}
	if req.ComponentFromSet {
		if req.ComponentFrom == nil {
			labels[k8s.AlertRuleClassificationComponentFromKey] = ""
		} else {
			labels[k8s.AlertRuleClassificationComponentFromKey] = strings.TrimSpace(*req.ComponentFrom)
		}
		anySet = true
	}
	if req.LayerFromSet {
		if req.LayerFrom == nil {
			labels[k8s.AlertRuleClassificationLayerFromKey] = ""
		} else {
			labels[k8s.AlertRuleClassificationLayerFromKey] = strings.TrimSpace(*req.LayerFrom)
		}
		anySet = true
	}

	if anySet {
		labels[managementlabels.ClassificationManagedByKey] = managementlabels.ClassificationManagedByValue
	}
	return labels
}

// applyClassificationViaARC applies classification labels through an AlertRelabelConfig.
// The ARC is named per-rule and shared with other label changes (severity, etc.).
// arcNamespace determines where the ARC is stored (e.g. openshift-monitoring for
// platform rules, openshift-user-workload-monitoring for user-defined rules).
func (c *client) applyClassificationViaARC(
	ctx context.Context,
	alertRuleId string,
	relabeled monitoringv1.Rule,
	classificationLabels map[string]string,
	arcNamespace string,
) error {
	namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
	name := relabeled.Labels[k8s.PrometheusRuleLabelName]

	pr, prFound, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return err
	}
	if !prFound {
		return &NotFoundError{
			Resource:       "PrometheusRule",
			Id:             alertRuleId,
			AdditionalInfo: fmt.Sprintf("PrometheusRule %s/%s not found", namespace, name),
		}
	}

	originalRule, err := getOriginalPlatformRuleFromPR(pr, namespace, name, alertRuleId)
	if err != nil {
		return err
	}

	prName := relabeled.Labels[k8s.PrometheusRuleLabelName]
	arcName := k8s.GetAlertRelabelConfigName(prName, alertRuleId)

	original := copyStringMap(originalRule.Labels)

	existingArc, found, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, arcNamespace, arcName)
	if err != nil {
		return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", arcNamespace, arcName, err)
	}

	existingOverrides, existingDrops := collectExistingFromARC(found, existingArc)
	existingRuleDrops := getExistingRuleDrops(existingArc, alertRuleId)
	effective := computeEffectiveLabels(original, existingOverrides, existingDrops)

	desired := buildDesiredLabels(effective, classificationLabels)
	nextChanges := buildNextLabelChanges(original, desired)

	if len(nextChanges) == 0 {
		if found {
			if err := c.k8sClient.AlertRelabelConfigs().Delete(ctx, arcNamespace, arcName); err != nil {
				return fmt.Errorf("failed to delete AlertRelabelConfig %s/%s: %w", arcNamespace, arcName, err)
			}
		}
		return nil
	}

	relabelConfigs := buildRelabelConfigs(originalRule.Alert, original, alertRuleId, nextChanges)
	relabelConfigs = appendPreservedRuleDrops(relabelConfigs, existingRuleDrops)

	return upsertAlertRelabelConfig(c.k8sClient, ctx, arcNamespace, arcName, prName, originalRule.Alert, alertRuleId, found, existingArc, relabelConfigs)
}

// --- ARC helpers (shared with platform alert rule updates in downstream branches) ---

func copyStringMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func collectExistingFromARC(found bool, arc *osmv1.AlertRelabelConfig) (map[string]string, map[string]struct{}) {
	overrides := map[string]string{}
	drops := map[string]struct{}{}
	if found && arc != nil {
		for _, rc := range arc.Spec.Configs {
			switch rc.Action {
			case "Replace":
				if rc.TargetLabel != "" && rc.Replacement != "" {
					overrides[string(rc.TargetLabel)] = rc.Replacement
				}
			case "LabelDrop":
				if rc.Regex != "" {
					drops[rc.Regex] = struct{}{}
				}
			}
		}
	}
	return overrides, drops
}

func computeEffectiveLabels(original map[string]string, overrides map[string]string, drops map[string]struct{}) map[string]string {
	effective := copyStringMap(original)
	for k, v := range overrides {
		effective[k] = v
	}
	for dropKey := range drops {
		delete(effective, dropKey)
	}
	return effective
}

func buildDesiredLabels(effective map[string]string, newLabels map[string]string) map[string]string {
	desired := copyStringMap(effective)
	for k, v := range newLabels {
		if v == "" {
			delete(desired, k)
		} else {
			desired[k] = v
		}
	}
	return desired
}

func buildNextLabelChanges(original map[string]string, desired map[string]string) []labelChange {
	var changes []labelChange
	for k, v := range desired {
		if k == k8s.AlertRuleLabelId {
			continue
		}
		if ov, ok := original[k]; !ok || ov != v {
			changes = append(changes, labelChange{
				action:      "Replace",
				targetLabel: k,
				value:       v,
			})
		}
	}
	return changes
}

type labelChange struct {
	action      string
	sourceLabel string
	targetLabel string
	value       string
}

func getExistingRuleDrops(arc *osmv1.AlertRelabelConfig, alertRuleId string) []osmv1.RelabelConfig {
	if arc == nil {
		return nil
	}
	var out []osmv1.RelabelConfig
	escaped := regexp.QuoteMeta(alertRuleId)
	for _, rc := range arc.Spec.Configs {
		if rc.Action != "Drop" {
			continue
		}
		if len(rc.SourceLabels) == 1 && rc.SourceLabels[0] == k8s.AlertRuleLabelId &&
			(rc.Regex == alertRuleId || rc.Regex == escaped) {
			out = append(out, rc)
		}
	}
	return out
}

func appendPreservedRuleDrops(configs []osmv1.RelabelConfig, drops []osmv1.RelabelConfig) []osmv1.RelabelConfig {
	if len(drops) == 0 {
		return configs
	}
nextDrop:
	for _, d := range drops {
		for _, cfg := range configs {
			if cfg.Action == "Drop" && cfg.Regex == d.Regex &&
				len(cfg.SourceLabels) == 1 && cfg.SourceLabels[0] == k8s.AlertRuleLabelId {
				continue nextDrop
			}
		}
		configs = append(configs, d)
	}
	return configs
}

func buildRelabelConfigs(alertName string, originalLabels map[string]string, alertRuleId string, changes []labelChange) []osmv1.RelabelConfig {
	var configs []osmv1.RelabelConfig

	var keys []string
	for k := range originalLabels {
		if k == "namespace" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	source := []osmv1.LabelName{managementlabels.AlertNameLabel}
	values := []string{alertName}
	for _, k := range keys {
		source = append(source, osmv1.LabelName(k))
		values = append(values, originalLabels[k])
	}
	pat := "^" + regexp.QuoteMeta(strings.Join(values, ";")) + "$"
	configs = append(configs, osmv1.RelabelConfig{
		SourceLabels: source,
		Regex:        pat,
		TargetLabel:  k8s.AlertRuleLabelId,
		Replacement:  alertRuleId,
		Action:       "Replace",
	})

	for _, change := range changes {
		switch change.action {
		case "Replace":
			configs = append(configs, osmv1.RelabelConfig{
				SourceLabels: []osmv1.LabelName{k8s.AlertRuleLabelId},
				Regex:        regexp.QuoteMeta(alertRuleId),
				TargetLabel:  change.targetLabel,
				Replacement:  change.value,
				Action:       "Replace",
			})
		case "LabelDrop":
			configs = append(configs, osmv1.RelabelConfig{
				Regex:  change.sourceLabel,
				Action: "LabelDrop",
			})
		}
	}

	return configs
}

func upsertAlertRelabelConfig(
	k8sClient k8s.Client,
	ctx context.Context,
	namespace string,
	arcName string,
	prName string,
	alertName string,
	alertRuleId string,
	found bool,
	existingArc *osmv1.AlertRelabelConfig,
	relabelConfigs []osmv1.RelabelConfig,
) error {
	if found {
		arc := existingArc
		arc.Spec = osmv1.AlertRelabelConfigSpec{Configs: relabelConfigs}
		if arc.Labels == nil {
			arc.Labels = map[string]string{}
		}
		arc.Labels[managementlabels.ARCLabelPrometheusRuleNameKey] = prName
		arc.Labels[managementlabels.ARCLabelAlertNameKey] = alertName
		if arc.Annotations == nil {
			arc.Annotations = map[string]string{}
		}
		arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey] = alertRuleId
		if err := k8sClient.AlertRelabelConfigs().Update(ctx, *arc); err != nil {
			return fmt.Errorf("failed to update AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
		}
		return nil
	}

	arc := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      arcName,
			Namespace: namespace,
			Labels: map[string]string{
				managementlabels.ARCLabelPrometheusRuleNameKey: prName,
				managementlabels.ARCLabelAlertNameKey:          alertName,
			},
			Annotations: map[string]string{
				managementlabels.ARCAnnotationAlertRuleIDKey: alertRuleId,
			},
		},
		Spec: osmv1.AlertRelabelConfigSpec{Configs: relabelConfigs},
	}
	if _, err := k8sClient.AlertRelabelConfigs().Create(ctx, *arc); err != nil {
		return fmt.Errorf("failed to create AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
	}
	return nil
}

// getOriginalPlatformRuleFromPR returns the original rule from a pre-fetched PrometheusRule.
func getOriginalPlatformRuleFromPR(pr *monitoringv1.PrometheusRule, namespace string, name string, alertRuleId string) (*monitoringv1.Rule, error) {
	if pr == nil {
		return nil, &NotFoundError{
			Resource:       "PrometheusRule",
			Id:             alertRuleId,
			AdditionalInfo: fmt.Sprintf("PrometheusRule %s/%s not found", namespace, name),
		}
	}
	for groupIdx := range pr.Spec.Groups {
		for ruleIdx := range pr.Spec.Groups[groupIdx].Rules {
			rule := &pr.Spec.Groups[groupIdx].Rules[ruleIdx]
			if ruleMatchesAlertRuleID(*rule, alertRuleId) {
				return rule, nil
			}
		}
	}
	return nil, &NotFoundError{
		Resource:       "AlertRule",
		Id:             alertRuleId,
		AdditionalInfo: fmt.Sprintf("in PrometheusRule %s/%s", namespace, name),
	}
}

// ApplyDynamicClassification resolves the effective component and layer for an
// alert by applying _from indirection. If a rule carries a component_from or
// layer_from label, the corresponding alert label value is used instead of the
// static default. Unresolvable or empty lookups fall back to the supplied
// defaults.
func ApplyDynamicClassification(ruleLabels, alertLabels map[string]string, defaultComponent, defaultLayer string) (string, string) {
	component := defaultComponent
	layer := defaultLayer

	if ruleLabels != nil {
		if fromKey := ruleLabels[k8s.AlertRuleClassificationComponentFromKey]; fromKey != "" {
			if v, ok := alertLabels[fromKey]; ok && v != "" {
				component = v
			}
		}
		if fromKey := ruleLabels[k8s.AlertRuleClassificationLayerFromKey]; fromKey != "" {
			if v, ok := alertLabels[fromKey]; ok && v != "" {
				layer = strings.ToLower(v)
			}
		}
	}

	return component, layer
}
