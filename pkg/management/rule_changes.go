package management

import (
	"sort"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func resolvePrometheusRuleGroupIndex(pr *monitoringv1.PrometheusRule, groupName string) int {
	if pr == nil {
		return 0
	}
	for i, g := range pr.Spec.Groups {
		if g.Name == groupName {
			return i
		}
	}
	return len(pr.Spec.Groups)
}

func findPrometheusRuleIndices(pr *monitoringv1.PrometheusRule, alertRuleID string) (groupIdx, ruleIdx int, found bool) {
	for gi := range pr.Spec.Groups {
		for ri := range pr.Spec.Groups[gi].Rules {
			if ruleMatchesAlertRuleID(pr.Spec.Groups[gi].Rules[ri], alertRuleID) {
				return gi, ri, true
			}
		}
	}
	return 0, 0, false
}

// sanitizeRuleForPreview returns a rule suitable for API desiredRule output,
// stripping relabeling provenance and system labels injected by the plugin.
func sanitizeRuleForPreview(rule monitoringv1.Rule) monitoringv1.Rule {
	out := rule
	if len(rule.Labels) > 0 {
		out.Labels = copyStringMap(rule.Labels)
		for k := range out.Labels {
			if isPreviewProvenanceLabel(k) {
				delete(out.Labels, k)
			}
		}
		if len(out.Labels) == 0 {
			out.Labels = nil
		}
	}
	if len(rule.Annotations) > 0 {
		out.Annotations = copyStringMap(rule.Annotations)
	}
	return out
}

func isPreviewProvenanceLabel(key string) bool {
	switch key {
	case k8s.AlertRuleLabelId,
		k8s.PrometheusRuleLabelNamespace,
		k8s.PrometheusRuleLabelName,
		managementlabels.AlertNameLabel,
		managementlabels.RuleManagedByLabel,
		managementlabels.RelabelConfigManagedByLabel:
		return true
	default:
		return false
	}
}

func ruleToPreviewMap(rule monitoringv1.Rule) map[string]any {
	sanitized := sanitizeRuleForPreview(rule)
	out := map[string]any{}
	if sanitized.Alert != "" {
		out["alert"] = sanitized.Alert
	}
	if sanitized.Record != "" {
		out["record"] = sanitized.Record
	}
	if sanitized.Expr.String() != "" {
		out["expr"] = sanitized.Expr.String()
	}
	if sanitized.For != nil {
		out["for"] = string(*sanitized.For)
	}
	if sanitized.KeepFiringFor != nil {
		out["keepFiringFor"] = string(*sanitized.KeepFiringFor)
	}
	if len(sanitized.Labels) > 0 {
		out["labels"] = copyStringMap(sanitized.Labels)
	}
	if len(sanitized.Annotations) > 0 {
		out["annotations"] = copyStringMap(sanitized.Annotations)
	}
	return out
}

func addRuleSemanticChange(rule monitoringv1.Rule) []RuleChange {
	desired := sanitizeRuleForPreview(rule)
	return []RuleChange{{
		Field:     "rule",
		Operation: RuleChangeOpAdd,
		NewValue:  ruleToPreviewMap(desired),
	}}
}

func diffSemanticRuleChanges(before, after monitoringv1.Rule) []RuleChange {
	b := sanitizeRuleForPreview(before)
	a := sanitizeRuleForPreview(after)

	var changes []RuleChange
	changes = append(changes, diffScalarField("alert", b.Alert, a.Alert)...)
	changes = append(changes, diffScalarField("record", b.Record, a.Record)...)
	changes = append(changes, diffScalarField("expr", b.Expr.String(), a.Expr.String())...)

	bFor, aFor := durationString(b.For), durationString(a.For)
	changes = append(changes, diffScalarField("for", bFor, aFor)...)

	bKeep, aKeep := nonEmptyDurationString(b.KeepFiringFor), nonEmptyDurationString(a.KeepFiringFor)
	changes = append(changes, diffScalarField("keepFiringFor", bKeep, aKeep)...)

	changes = append(changes, diffLabelSemanticChanges("labels", b.Labels, a.Labels)...)
	changes = append(changes, diffLabelSemanticChanges("annotations", b.Annotations, a.Annotations)...)

	return changes
}

func diffLabelSemanticChanges(prefix string, before, after map[string]string) []RuleChange {
	var keys []string
	seen := map[string]struct{}{}
	for k := range before {
		if isProtectedLabel(k) || isPreviewProvenanceLabel(k) {
			continue
		}
		keys = append(keys, k)
		seen[k] = struct{}{}
	}
	for k := range after {
		if isProtectedLabel(k) || isPreviewProvenanceLabel(k) {
			continue
		}
		if _, ok := seen[k]; !ok {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	fieldPrefix := prefix
	if prefix != "" {
		fieldPrefix = prefix + "."
	}

	var changes []RuleChange
	for _, k := range keys {
		bv, bOK := before[k]
		av, aOK := after[k]
		field := fieldPrefix + k
		switch {
		case bOK && aOK && bv == av:
			continue
		case bOK && !aOK:
			changes = append(changes, RuleChange{
				Field:        field,
				Operation:    RuleChangeOpRemove,
				CurrentValue: bv,
			})
		case !bOK && aOK:
			changes = append(changes, RuleChange{
				Field:     field,
				Operation: RuleChangeOpAdd,
				NewValue:  av,
			})
		case bOK && aOK && bv != av:
			changes = append(changes, RuleChange{
				Field:        field,
				Operation:    RuleChangeOpReplace,
				CurrentValue: bv,
				NewValue:     av,
			})
		}
	}
	return changes
}

func diffScalarField(field, before, after string) []RuleChange {
	if before == after {
		return nil
	}
	if before == "" && after != "" {
		return []RuleChange{{
			Field:     field,
			Operation: RuleChangeOpAdd,
			NewValue:  after,
		}}
	}
	if before != "" && after == "" {
		return []RuleChange{{
			Field:        field,
			Operation:    RuleChangeOpRemove,
			CurrentValue: before,
		}}
	}
	return []RuleChange{{
		Field:        field,
		Operation:    RuleChangeOpReplace,
		CurrentValue: before,
		NewValue:     after,
	}}
}

func alertingRuleEnabledChange(currentEnabled, desiredEnabled bool) []RuleChange {
	if currentEnabled == desiredEnabled {
		return nil
	}
	if desiredEnabled {
		return []RuleChange{{
			Field:        "alertingRuleEnabled",
			Operation:    RuleChangeOpReplace,
			CurrentValue: false,
			NewValue:     true,
		}}
	}
	return []RuleChange{{
		Field:        "alertingRuleEnabled",
		Operation:    RuleChangeOpReplace,
		CurrentValue: true,
		NewValue:     false,
	}}
}

func durationString(d *monitoringv1.Duration) string {
	if d == nil {
		return ""
	}
	return string(*d)
}

func nonEmptyDurationString(d *monitoringv1.NonEmptyDuration) string {
	if d == nil {
		return ""
	}
	return string(*d)
}

func ruleWithLabels(base monitoringv1.Rule, labels map[string]string) monitoringv1.Rule {
	out := base
	if len(labels) == 0 {
		out.Labels = nil
		return out
	}
	out.Labels = copyStringMap(labels)
	return out
}

func buildRuleChangePlan(
	writable bool,
	managedBy ManagementSource,
	resources []ResourceChangePlan,
	desiredRule monitoringv1.Rule,
) *RuleChangePlan {
	return &RuleChangePlan{
		Writable:    writable,
		ManagedBy:   planManagedByPtr(managedBy),
		Resources:   resources,
		DesiredRule: sanitizeRuleForPreview(desiredRule),
	}
}

func buildCreateRuleChangePlan(
	writable bool,
	managedBy ManagementSource,
	target ResourceRef,
	rule monitoringv1.Rule,
	desiredObject map[string]any,
) *RuleChangePlan {
	return buildRuleChangePlan(
		writable,
		managedBy,
		[]ResourceChangePlan{{
			Resource:      target,
			Changes:       addRuleSemanticChange(rule),
			DesiredObject: desiredObject,
		}},
		rule,
	)
}

func buildDropRestoreRuleChangePlan(
	writable bool,
	managedBy ManagementSource,
	target ResourceRef,
	rule monitoringv1.Rule,
	currentEnabled bool,
	desiredEnabled bool,
	desiredObject map[string]any,
) *RuleChangePlan {
	changes := alertingRuleEnabledChange(currentEnabled, desiredEnabled)
	if desiredObject == nil && !desiredEnabled {
		changes = append(changes, RuleChange{
			Field:     "resource",
			Operation: RuleChangeOpRemove,
		})
	}
	return buildRuleChangePlan(
		writable,
		managedBy,
		[]ResourceChangePlan{{
			Resource:      target,
			Changes:       changes,
			DesiredObject: desiredObject,
		}},
		rule,
	)
}

func hasResourceChanges(plan *RuleChangePlan) bool {
	if plan == nil {
		return false
	}
	for _, res := range plan.Resources {
		if len(res.Changes) > 0 {
			return true
		}
	}
	return false
}

func mergeLabelMaps(into, from map[string]string) map[string]string {
	if len(from) == 0 {
		return into
	}
	if into == nil {
		into = map[string]string{}
	}
	for k, v := range from {
		into[k] = v
	}
	return into
}
