package management

import (
	"context"
	"fmt"
	"regexp"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// arcNamespaceForRule returns the ARC namespace for the given rule's PrometheusRule.
// Platform rules use openshift-monitoring. User-defined workload rules use
// openshift-user-workload-monitoring when ENABLE_USER_WORKLOAD_ARCS is enabled.
func (c *client) arcNamespaceForRule(nn types.NamespacedName) (string, error) {
	if c.isPlatformManagedPrometheusRule(nn) {
		return k8s.ClusterMonitoringNamespace, nil
	}
	if !c.enableUserWorkloadARCs {
		return "", &NotAllowedError{
			Message: fmt.Sprintf("alert rule management for user-defined workload rules requires ENABLE_USER_WORKLOAD_ARCS (%s/%s)", nn.Namespace, nn.Name),
		}
	}
	return k8s.UserWorkloadMonitoringNamespace, nil
}

func (c *client) UpdatePlatformAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) error {
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found {
		return &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	name := rule.Labels[k8s.PrometheusRuleLabelName]
	nn := types.NamespacedName{Namespace: namespace, Name: name}

	arcNamespace, err := c.arcNamespaceForRule(nn)
	if err != nil {
		return err
	}
	isPlatform := c.isPlatformManagedPrometheusRule(nn)

	var prMeta *monitoringv1.PrometheusRule
	if pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name); err != nil {
		return err
	} else if found {
		prMeta = pr
	}
	if err := validateGitOpsPreconditions(rule, prMeta); err != nil {
		return err
	}

	originalRule, err := getOriginalPlatformRuleFromPR(prMeta, namespace, name, alertRuleId)
	if err != nil {
		return err
	}

	if v, ok := alertRule.Labels[managementlabels.AlertNameLabel]; ok {
		if v != originalRule.Alert {
			return &ValidationError{Message: fmt.Sprintf("label %q is immutable", managementlabels.AlertNameLabel)}
		}
	}

	// AlertingRule CR path is only available for platform rules
	if isPlatform {
		arName := rule.Labels[managementlabels.AlertingRuleLabelName]
		if arName == "" {
			arName = defaultAlertingRuleName
		}
		ar, arFound, arErr := c.getAlertingRule(ctx, arName)
		if arErr != nil {
			return arErr
		}
		if arFound && ar != nil {
			if gitOpsManaged, operatorManaged := k8s.IsExternallyManagedObject(ar); gitOpsManaged {
				return &NotAllowedError{Message: "This alert is managed by GitOps; edit it in Git."}
			} else if operatorManaged {
				return c.applyLabelChangesViaAlertRelabelConfig(ctx, arcNamespace, alertRuleId, *originalRule, alertRule.Labels)
			}
			return c.updateAlertingRuleLabels(ctx, ar, originalRule.Alert, alertRuleId, alertRule.Labels, arName)
		}
	}

	return c.applyLabelChangesViaAlertRelabelConfig(ctx, arcNamespace, alertRuleId, *originalRule, alertRule.Labels)
}

func filterAndValidatePlatformLabelChanges(labels map[string]string) (map[string]string, error) {
	filtered := make(map[string]string)
	for k, v := range labels {
		if !isProtectedLabel(k) {
			filtered[k] = v
		}
	}
	for k, v := range filtered {
		if k == managementlabels.AlertNameLabel {
			continue
		}
		if k == "severity" {
			if v == "" {
				return nil, &NotAllowedError{Message: fmt.Sprintf("label %q cannot be dropped for platform alerts", k)}
			}
			if !isValidSeverity(v) {
				return nil, &ValidationError{Message: fmt.Sprintf("invalid severity %q: must be one of critical|warning|info|none", v)}
			}
		}
	}
	return filtered, nil
}

func (c *client) getAlertingRule(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error) {
	ar, found, err := c.k8sClient.AlertingRules().Get(ctx, name)
	if err != nil {
		return nil, false, fmt.Errorf("failed to get AlertingRule %s: %w", name, err)
	}
	return ar, found, nil
}

func (c *client) updateAlertingRuleLabels(
	ctx context.Context,
	ar *osmv1.AlertingRule,
	originalAlertName string,
	alertRuleId string,
	rawLabels map[string]string,
	arName string,
) error {
	filteredLabels, err := filterAndValidatePlatformLabelChanges(rawLabels)
	if err != nil {
		return err
	}
	target, found := findAlertByNameInAlertingRule(ar, originalAlertName)
	if !found || target == nil {
		return &NotFoundError{
			Resource:       "AlertRule",
			Id:             alertRuleId,
			AdditionalInfo: fmt.Sprintf("alert %q not found in AlertingRule %s", originalAlertName, arName),
		}
	}
	if target.Labels == nil {
		target.Labels = map[string]string{}
	}
	for k, v := range filteredLabels {
		if v == "" {
			delete(target.Labels, k)
		} else {
			target.Labels[k] = v
		}
	}
	if err := c.k8sClient.AlertingRules().Update(ctx, *ar); err != nil {
		return fmt.Errorf("failed to update AlertingRule %s: %w", ar.Name, err)
	}
	return nil
}

func findAlertByNameInAlertingRule(ar *osmv1.AlertingRule, alertName string) (*osmv1.Rule, bool) {
	for gi := range ar.Spec.Groups {
		for ri := range ar.Spec.Groups[gi].Rules {
			r := &ar.Spec.Groups[gi].Rules[ri]
			if r.Alert == alertName {
				return r, true
			}
		}
	}
	return nil, false
}

func (c *client) applyLabelChangesViaAlertRelabelConfig(ctx context.Context, namespace string, alertRuleId string, originalRule monitoringv1.Rule, rawLabels map[string]string) error {
	filtered, err := filterAndValidatePlatformLabelChanges(rawLabels)
	if err != nil {
		return err
	}
	relabeled, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found || relabeled.Labels == nil {
		return &NotFoundError{
			Resource:       "AlertRule",
			Id:             alertRuleId,
			AdditionalInfo: "relabeled rule not found or has no labels",
		}
	}
	prName := relabeled.Labels[k8s.PrometheusRuleLabelName]
	arcName := k8s.GetAlertRelabelConfigName(prName, alertRuleId)

	existingArc, found, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, namespace, arcName)
	if err != nil {
		return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", namespace, arcName, err)
	}
	if err := validatePlatformUpdatePreconditions(relabeled, nil, relabelConfigIfFound(found, existingArc)); err != nil {
		return err
	}

	original := copyStringMap(originalRule.Labels)
	existingOverrides, existingDrops := collectExistingFromARC(found, existingArc)
	existingRuleDrops := getExistingRuleDrops(existingArc, alertRuleId)
	effective := computeEffectiveLabels(original, existingOverrides, existingDrops)

	if len(filtered) == 0 {
		return nil
	}

	desired := buildDesiredLabels(effective, filtered)
	nextChanges := buildNextLabelChanges(original, desired)

	if len(nextChanges) == 0 {
		if found {
			if err := c.k8sClient.AlertRelabelConfigs().Delete(ctx, namespace, arcName); err != nil {
				return fmt.Errorf("failed to delete AlertRelabelConfig %s/%s: %w", namespace, arcName, err)
			}
		}
		return nil
	}

	relabelConfigs := buildRelabelConfigs(originalRule.Alert, original, alertRuleId, nextChanges)
	relabelConfigs = appendPreservedRuleDrops(relabelConfigs, existingRuleDrops)

	return upsertAlertRelabelConfig(c.k8sClient, ctx, namespace, arcName, prName, originalRule.Alert, alertRuleId, found, existingArc, relabelConfigs)
}

func relabelConfigIfFound(found bool, arc *osmv1.AlertRelabelConfig) *osmv1.AlertRelabelConfig {
	if found {
		return arc
	}
	return nil
}

func ensureStampAndDrop(next *[]osmv1.RelabelConfig, stamp osmv1.RelabelConfig, dropCfg osmv1.RelabelConfig, alertRuleId string) bool {
	stampExists := false
	dropExists := false
	for _, rc := range *next {
		if rc.Action == "Replace" && rc.TargetLabel == k8s.AlertRuleLabelId &&
			rc.Regex == stamp.Regex && rc.Replacement == alertRuleId {
			stampExists = true
		}
		if rc.Action == "Drop" && rc.Regex == dropCfg.Regex &&
			len(rc.SourceLabels) == 1 && rc.SourceLabels[0] == k8s.AlertRuleLabelId {
			dropExists = true
		}
	}
	changed := false
	if !stampExists {
		*next = append(*next, stamp)
		changed = true
	}
	if !dropExists {
		*next = append(*next, dropCfg)
		changed = true
	}
	return changed
}

func filterOutDrop(configs []osmv1.RelabelConfig, alertRuleId string) ([]osmv1.RelabelConfig, bool) {
	target := regexp.QuoteMeta(alertRuleId)
	var out []osmv1.RelabelConfig
	removed := false
	for _, rc := range configs {
		if rc.Action == "Drop" && (rc.Regex == target || rc.Regex == alertRuleId) {
			removed = true
			continue
		}
		out = append(out, rc)
	}
	return out, removed
}

func isStampOnly(configs []osmv1.RelabelConfig) bool {
	if len(configs) == 0 {
		return true
	}
	for _, rc := range configs {
		if rc.Action != "Replace" || rc.TargetLabel != k8s.AlertRuleLabelId {
			return false
		}
	}
	return true
}

func (c *client) DropPlatformAlertRule(ctx context.Context, alertRuleId string) error {
	relabeled, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found || relabeled.Labels == nil {
		return &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
	name := relabeled.Labels[k8s.PrometheusRuleLabelName]

	arcNamespace, err := c.arcNamespaceForRule(types.NamespacedName{Namespace: namespace, Name: name})
	if err != nil {
		return err
	}

	originalRule, err := c.getOriginalPlatformRule(ctx, namespace, name, alertRuleId)
	if err != nil {
		return err
	}

	arcName := k8s.GetAlertRelabelConfigName(name, alertRuleId)

	existingArc, arcExists, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, arcNamespace, arcName)
	if err != nil {
		return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", arcNamespace, arcName, err)
	}
	if err := validatePlatformUpdatePreconditions(relabeled, nil, relabelConfigIfFound(arcExists, existingArc)); err != nil {
		return err
	}

	original := copyStringMap(originalRule.Labels)
	stampOnly := buildRelabelConfigs(originalRule.Alert, original, alertRuleId, nil)
	var stamp osmv1.RelabelConfig
	if len(stampOnly) > 0 {
		stamp = stampOnly[0]
	}

	dropCfg := osmv1.RelabelConfig{
		SourceLabels: []osmv1.LabelName{"openshift_io_alert_rule_id"},
		Regex:        regexp.QuoteMeta(alertRuleId),
		Action:       "Drop",
	}

	var next []osmv1.RelabelConfig
	if arcExists && existingArc != nil {
		next = append(next, existingArc.Spec.Configs...)
	}

	changed := ensureStampAndDrop(&next, stamp, dropCfg, alertRuleId)

	if !changed {
		return nil
	}

	return upsertAlertRelabelConfig(c.k8sClient, ctx, arcNamespace, arcName, name, originalRule.Alert, alertRuleId, arcExists, existingArc, next)
}

func (c *client) RestorePlatformAlertRule(ctx context.Context, alertRuleId string) error {
	relabeled, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	var existingArc *osmv1.AlertRelabelConfig
	var arcName string
	var arcNamespace string
	var err error
	if found && relabeled.Labels != nil {
		namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
		name := relabeled.Labels[k8s.PrometheusRuleLabelName]
		arcNamespace, err = c.arcNamespaceForRule(types.NamespacedName{Namespace: namespace, Name: name})
		if err != nil {
			return err
		}
		arcName = k8s.GetAlertRelabelConfigName(name, alertRuleId)
		var arcExists bool
		existingArc, arcExists, err = c.k8sClient.AlertRelabelConfigs().Get(ctx, arcNamespace, arcName)
		if err != nil {
			return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", arcNamespace, arcName, err)
		}
		if !arcExists || existingArc == nil {
			return nil
		}
		if err := validatePlatformUpdatePreconditions(relabeled, nil, existingArc); err != nil {
			return err
		}
	} else {
		// Dropped rules may not appear in the relabeled rules cache because
		// the Drop action suppresses them from Prometheus results. Fall back
		// to scanning ARCs by annotation to locate the one to restore.
		arcNamespace, existingArc, arcName = c.findARCByAlertRuleID(ctx, alertRuleId)
		if existingArc == nil {
			return nil
		}
	}

	filtered, removed := filterOutDrop(existingArc.Spec.Configs, alertRuleId)

	if !removed {
		return nil
	}

	if len(filtered) == 0 || isStampOnly(filtered) {
		if err := c.k8sClient.AlertRelabelConfigs().Delete(ctx, arcNamespace, arcName); err != nil {
			return fmt.Errorf("failed to delete AlertRelabelConfig %s/%s: %w", arcNamespace, arcName, err)
		}
		return nil
	}

	arc := existingArc
	arc.Spec = osmv1.AlertRelabelConfigSpec{Configs: filtered}
	if arc.Annotations == nil {
		arc.Annotations = map[string]string{}
	}
	arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey] = alertRuleId

	if err := c.k8sClient.AlertRelabelConfigs().Update(ctx, *arc); err != nil {
		return fmt.Errorf("failed to update AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
	}
	return nil
}

// findARCByAlertRuleID searches for an ARC by its alert-rule-id annotation across
// the platform namespace and (if enabled) the user-workload namespace.
func (c *client) findARCByAlertRuleID(ctx context.Context, alertRuleId string) (string, *osmv1.AlertRelabelConfig, string) {
	namespaces := []string{k8s.ClusterMonitoringNamespace}
	if c.enableUserWorkloadARCs {
		namespaces = append(namespaces, k8s.UserWorkloadMonitoringNamespace)
	}
	for _, ns := range namespaces {
		arcs, err := c.k8sClient.AlertRelabelConfigs().List(ctx, ns)
		if err != nil {
			continue
		}
		for i := range arcs {
			arc := arcs[i]
			if arc.Annotations != nil && arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey] == alertRuleId {
				arcCopy := arc
				return ns, &arcCopy, arc.Name
			}
		}
	}
	return "", nil, ""
}
