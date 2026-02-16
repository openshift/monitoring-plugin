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

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

const (
	platformARCNamespace        = "openshift-monitoring"
	arcLabelPrometheusRuleName  = "monitoring.openshift.io/prometheusrule-name"
	arcLabelAlertName           = "monitoring.openshift.io/alertname"
	arcAnnotationAlertRuleIDKey = "monitoring.openshift.io/alertRuleId"
)

func (c *client) UpdatePlatformAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) error {
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	if !found {
		return &NotFoundError{Resource: "AlertRule", Id: alertRuleId}
	}

	namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	name := rule.Labels[k8s.PrometheusRuleLabelName]

	if !c.IsPlatformAlertRule(types.NamespacedName{Namespace: namespace, Name: name}) {
		return &NotAllowedError{Message: "cannot update non-platform alert rule from " + namespace + "/" + name}
	}

	originalRule, err := c.getOriginalPlatformRule(ctx, namespace, name, alertRuleId)
	if err != nil {
		return err
	}

	// If alertname is explicitly provided and differs, reject
	if v, ok := alertRule.Labels["alertname"]; ok {
		if v != originalRule.Alert {
			return &ValidationError{Message: fmt.Sprintf("label %q is immutable for platform alerts", "alertname")}
		}
	}

	// Filter out protected labels before proceeding
	filteredLabels := map[string]string{}
	for k, v := range alertRule.Labels {
		if !isProtectedLabel(k) {
			filteredLabels[k] = v
		}
	}
	// Validate set intents only (missing keys are no-op; explicit deletes handled via ARC diff/effective state)
	for k, v := range filteredLabels {
		if k == "alertname" {
			// already validated above; treat as no-op when equal
			continue
		}
		if k == "severity" {
			if v == "" {
				return &NotAllowedError{Message: fmt.Sprintf("label %q cannot be dropped for platform alerts", k)}
			}
			if !isValidSeverity(v) {
				return &ValidationError{Message: fmt.Sprintf("invalid severity %q: must be one of critical|warning|info|none", v)}
			}
		}
	}

	// AlertRelabelConfigs for platform alerts must live in the central platform namespace
	return c.applyLabelChangesViaAlertRelabelConfig(ctx, platformARCNamespace, alertRuleId, *originalRule, filteredLabels)
}

func (c *client) getOriginalPlatformRule(ctx context.Context, namespace string, name string, alertRuleId string) (*monitoringv1.Rule, error) {
	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", namespace, name, err)
	}

	if !found {
		return nil, &NotFoundError{
			Resource:       "PrometheusRule",
			Id:             alertRuleId,
			AdditionalInfo: fmt.Sprintf("PrometheusRule %s/%s not found", namespace, name),
		}
	}

	for groupIdx := range pr.Spec.Groups {
		for ruleIdx := range pr.Spec.Groups[groupIdx].Rules {
			rule := &pr.Spec.Groups[groupIdx].Rules[ruleIdx]
			if c.shouldUpdateRule(*rule, alertRuleId) {
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

type labelChange struct {
	action      string
	sourceLabel string
	targetLabel string
	value       string
}

func (c *client) applyLabelChangesViaAlertRelabelConfig(ctx context.Context, namespace string, alertRuleId string, originalRule monitoringv1.Rule, newLabels map[string]string) error {
	// Build human-friendly, short ARC name: arc-<prname>-<hash12>
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

	original := copyStringMap(originalRule.Labels)
	existingOverrides, existingDrops := collectExistingFromARC(found, existingArc)
	existingRuleDrops := getExistingRuleDrops(existingArc, alertRuleId)
	effective := computeEffectiveLabels(original, existingOverrides, existingDrops)

	// If no actual label changes leave existing ARC as-is
	if len(newLabels) == 0 {
		return nil
	}

	desired := buildDesiredLabels(effective, newLabels)
	nextChanges := buildNextLabelChanges(original, desired)

	// If no changes remove ARC if it exists
	if len(nextChanges) == 0 {
		if found {
			if err := c.k8sClient.AlertRelabelConfigs().Delete(ctx, namespace, arcName); err != nil {
				return fmt.Errorf("failed to delete AlertRelabelConfig %s/%s: %w", namespace, arcName, err)
			}
		}
		return nil
	}

	relabelConfigs := c.buildRelabelConfigs(originalRule.Alert, original, alertRuleId, nextChanges)
	relabelConfigs = appendPreservedRuleDrops(relabelConfigs, existingRuleDrops)

	if err := c.upsertAlertRelabelConfig(ctx, namespace, arcName, prName, originalRule.Alert, alertRuleId, found, existingArc, relabelConfigs); err != nil {
		return err
	}

	return nil
}

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
		if k == "openshift_io_alert_rule_id" {
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
		if len(rc.SourceLabels) == 1 && rc.SourceLabels[0] == "openshift_io_alert_rule_id" &&
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
				len(cfg.SourceLabels) == 1 && cfg.SourceLabels[0] == "openshift_io_alert_rule_id" {
				continue nextDrop
			}
		}
		configs = append(configs, d)
	}
	return configs
}

func (c *client) upsertAlertRelabelConfig(
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
		arc.Labels[arcLabelPrometheusRuleName] = prName
		arc.Labels[arcLabelAlertName] = alertName
		if arc.Annotations == nil {
			arc.Annotations = map[string]string{}
		}
		arc.Annotations[arcAnnotationAlertRuleIDKey] = alertRuleId
		if err := c.k8sClient.AlertRelabelConfigs().Update(ctx, *arc); err != nil {
			return fmt.Errorf("failed to update AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
		}
		return nil
	}

	arc := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      arcName,
			Namespace: namespace,
			Labels: map[string]string{
				arcLabelPrometheusRuleName: prName,
				arcLabelAlertName:          alertName,
			},
			Annotations: map[string]string{
				arcAnnotationAlertRuleIDKey: alertRuleId,
			},
		},
		Spec: osmv1.AlertRelabelConfigSpec{Configs: relabelConfigs},
	}
	if _, err := c.k8sClient.AlertRelabelConfigs().Create(ctx, *arc); err != nil {
		return fmt.Errorf("failed to create AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
	}
	return nil
}
func (c *client) buildRelabelConfigs(alertName string, originalLabels map[string]string, alertRuleId string, changes []labelChange) []osmv1.RelabelConfig {
	var configs []osmv1.RelabelConfig

	// 1) Conditionally stamp the rule id only for the exact rule by matching alertname + original static labels
	// Build ordered source labels and exact anchored pattern for conditional Replace (non-dropping)
	var keys []string
	for k := range originalLabels {
		// Do not rely on namespace for scoping; runtime alert namespace may differ from PR or be absent
		if k == "namespace" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	// Scope by alertname + original static labels only (ARCs apply to platform stack)
	source := []osmv1.LabelName{"alertname"}
	values := []string{alertName}
	for _, k := range keys {
		source = append(source, osmv1.LabelName(k))
		values = append(values, originalLabels[k])
	}
	pat := "^" + regexp.QuoteMeta(strings.Join(values, ";")) + "$"
	configs = append(configs, osmv1.RelabelConfig{
		SourceLabels: source,
		Regex:        pat,
		TargetLabel:  "openshift_io_alert_rule_id",
		Replacement:  alertRuleId,
		Action:       "Replace",
	})

	for _, change := range changes {
		switch change.action {
		case "Replace":
			config := osmv1.RelabelConfig{
				// Tight match by exact ruleId
				SourceLabels: []osmv1.LabelName{"openshift_io_alert_rule_id"},
				Regex:        regexp.QuoteMeta(alertRuleId),
				TargetLabel:  change.targetLabel,
				Replacement:  change.value,
				Action:       "Replace",
			}
			configs = append(configs, config)
		case "LabelDrop":
			// Drop the specific label name, scoped by prior Keep
			config := osmv1.RelabelConfig{
				Regex:  change.sourceLabel,
				Action: "LabelDrop",
			}
			configs = append(configs, config)
		}
	}

	return configs
}

func ensureStampAndDrop(next *[]osmv1.RelabelConfig, stamp osmv1.RelabelConfig, dropCfg osmv1.RelabelConfig, alertRuleId string) bool {
	stampExists := false
	dropExists := false
	for _, rc := range *next {
		if rc.Action == "Replace" && rc.TargetLabel == "openshift_io_alert_rule_id" &&
			rc.Regex == stamp.Regex && rc.Replacement == alertRuleId {
			stampExists = true
		}
		if rc.Action == "Drop" && rc.Regex == dropCfg.Regex &&
			len(rc.SourceLabels) == 1 && rc.SourceLabels[0] == "openshift_io_alert_rule_id" {
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
		if !(rc.Action == "Replace" && rc.TargetLabel == "openshift_io_alert_rule_id") {
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

	if !c.IsPlatformAlertRule(types.NamespacedName{Namespace: namespace, Name: name}) {
		return &NotAllowedError{Message: "cannot drop non-platform alert rule from " + namespace + "/" + name}
	}

	originalRule, err := c.getOriginalPlatformRule(ctx, namespace, name, alertRuleId)
	if err != nil {
		return err
	}

	prName := relabeled.Labels[k8s.PrometheusRuleLabelName]
	arcName := k8s.GetAlertRelabelConfigName(prName, alertRuleId)

	existingArc, arcFound, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, platformARCNamespace, arcName)
	if err != nil {
		return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", platformARCNamespace, arcName, err)
	}

	original := map[string]string{}
	for k, v := range originalRule.Labels {
		original[k] = v
	}
	stampOnly := c.buildRelabelConfigs(originalRule.Alert, original, alertRuleId, nil)
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
	if arcFound && existingArc != nil {
		next = append(next, existingArc.Spec.Configs...)
	}

	changed := ensureStampAndDrop(&next, stamp, dropCfg, alertRuleId)

	if !changed {
		return nil
	}

	if arcFound {
		arc := existingArc
		arc.Spec = osmv1.AlertRelabelConfigSpec{Configs: next}
		if arc.Labels == nil {
			arc.Labels = map[string]string{}
		}
		arc.Labels[arcLabelPrometheusRuleName] = prName
		arc.Labels[arcLabelAlertName] = originalRule.Alert
		if arc.Annotations == nil {
			arc.Annotations = map[string]string{}
		}
		arc.Annotations[arcAnnotationAlertRuleIDKey] = alertRuleId

		if err := c.k8sClient.AlertRelabelConfigs().Update(ctx, *arc); err != nil {
			return fmt.Errorf("failed to update AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
		}
		return nil
	}

	arc := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      arcName,
			Namespace: platformARCNamespace,
			Labels: map[string]string{
				arcLabelPrometheusRuleName: prName,
				arcLabelAlertName:          originalRule.Alert,
			},
			Annotations: map[string]string{
				arcAnnotationAlertRuleIDKey: alertRuleId,
			},
		},
		Spec: osmv1.AlertRelabelConfigSpec{
			Configs: next,
		},
	}
	if _, err := c.k8sClient.AlertRelabelConfigs().Create(ctx, *arc); err != nil {
		return fmt.Errorf("failed to create AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
	}
	return nil
}

func (c *client) RestorePlatformAlertRule(ctx context.Context, alertRuleId string) error {
	relabeled, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId)
	var existingArc *osmv1.AlertRelabelConfig
	var arcName string
	var err error
	if found && relabeled.Labels != nil {
		namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
		name := relabeled.Labels[k8s.PrometheusRuleLabelName]
		if !c.IsPlatformAlertRule(types.NamespacedName{Namespace: namespace, Name: name}) {
			return &NotAllowedError{Message: "cannot restore non-platform alert rule from " + namespace + "/" + name}
		}
		prName := relabeled.Labels[k8s.PrometheusRuleLabelName]
		arcName = k8s.GetAlertRelabelConfigName(prName, alertRuleId)
		var arcFound bool
		existingArc, arcFound, err = c.k8sClient.AlertRelabelConfigs().Get(ctx, platformARCNamespace, arcName)
		if err != nil {
			return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", platformARCNamespace, arcName, err)
		}
		if !arcFound || existingArc == nil {
			return nil
		}
	} else {
		arcs, lerr := c.k8sClient.AlertRelabelConfigs().List(ctx, platformARCNamespace)
		if lerr != nil {
			return fmt.Errorf("failed to list AlertRelabelConfigs: %w", lerr)
		}
		for i := range arcs {
			arc := arcs[i]
			if arc.Annotations != nil && arc.Annotations[arcAnnotationAlertRuleIDKey] == alertRuleId {
				arcCopy := arc
				existingArc = &arcCopy
				arcName = arc.Name
				break
			}
		}
		if existingArc == nil {
			return nil
		}
	}

	filtered, removed := filterOutDrop(existingArc.Spec.Configs, alertRuleId)

	if !removed {
		return nil
	}

	if len(filtered) == 0 {
		if err := c.k8sClient.AlertRelabelConfigs().Delete(ctx, platformARCNamespace, arcName); err != nil {
			return fmt.Errorf("failed to delete AlertRelabelConfig %s/%s: %w", platformARCNamespace, arcName, err)
		}
		return nil
	}

	// If only the stamp Replace remains, delete the ARC
	if isStampOnly(filtered) {
		if err := c.k8sClient.AlertRelabelConfigs().Delete(ctx, platformARCNamespace, arcName); err != nil {
			return fmt.Errorf("failed to delete AlertRelabelConfig %s/%s: %w", platformARCNamespace, arcName, err)
		}
		return nil
	}

	arc := existingArc
	arc.Spec = osmv1.AlertRelabelConfigSpec{Configs: filtered}
	if arc.Annotations == nil {
		arc.Annotations = map[string]string{}
	}
	arc.Annotations[arcAnnotationAlertRuleIDKey] = alertRuleId

	if err := c.k8sClient.AlertRelabelConfigs().Update(ctx, *arc); err != nil {
		return fmt.Errorf("failed to update AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
	}
	return nil
}
