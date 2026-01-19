package management

import (
	"context"
	"crypto/sha256"
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
	arcName := fmt.Sprintf("arc-%s-%s", sanitizeDNSName(prName), shortHash(alertRuleId, 12))

	existingArc, found, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, namespace, arcName)
	if err != nil {
		return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", namespace, arcName, err)
	}

	original := map[string]string{}
	for k, v := range originalRule.Labels {
		original[k] = v
	}
	// Compute existing overrides from ARC (Replace entries) and drops from ARC (LabelDrop).
	// Note: we keep label-drop semantics strict: only exact label names are dropped.
	existingOverrides := map[string]string{}
	existingDrops := map[string]struct{}{}
	if found && existingArc != nil {
		for _, rc := range existingArc.Spec.Configs {
			switch rc.Action {
			case "Replace":
				if rc.TargetLabel != "" && rc.Replacement != "" {
					existingOverrides[string(rc.TargetLabel)] = rc.Replacement
				}
			case "LabelDrop":
				if rc.Regex != "" {
					existingDrops[rc.Regex] = struct{}{}
				}
			}
		}
	}
	// Effective current = original + existing overrides - existing drops
	effective := map[string]string{}
	for k, v := range original {
		effective[k] = v
	}
	for k, v := range existingOverrides {
		effective[k] = v
	}
	for dropKey := range existingDrops {
		delete(effective, dropKey)
	}

	// If request carries no explicit labels (e.g., only protected were present), no-op to preserve ARC
	if len(newLabels) == 0 {
		return nil
	}

	// Desired starts from effective; apply explicit deletes (value=="") and explicit sets; omit == no-op
	desired := map[string]string{}
	for k, v := range effective {
		desired[k] = v
	}
	for k, v := range newLabels {
		if v == "" {
			// explicit delete
			delete(desired, k)
		} else {
			desired[k] = v
		}
	}

	// Compute nextChanges by comparing desired vs original/effective
	var nextChanges []labelChange
	// Replaces for labels whose desired != original
	for k, v := range desired {
		if k == "openshift_io_alert_rule_id" {
			continue
		}
		if ov, ok := original[k]; !ok || ov != v {
			nextChanges = append(nextChanges, labelChange{
				action:      "Replace",
				targetLabel: k,
				value:       v,
			})
		}
	}
	// Do NOT emit LabelDrop for override-only labels; removing the Replace suffices

	// If no net changes vs original: remove ARC if it exists
	if len(nextChanges) == 0 {
		if found {
			if err := c.k8sClient.AlertRelabelConfigs().Delete(ctx, namespace, arcName); err != nil {
				return fmt.Errorf("failed to delete AlertRelabelConfig %s/%s: %w", namespace, arcName, err)
			}
		}
		return nil
	}

	relabelConfigs := c.buildRelabelConfigs(originalRule.Alert, original, alertRuleId, nextChanges)

	var arc *osmv1.AlertRelabelConfig
	if found {
		arc = existingArc
		arc.Spec = osmv1.AlertRelabelConfigSpec{
			Configs: relabelConfigs,
		}
		// update labels/annotations for traceability
		if arc.Labels == nil {
			arc.Labels = map[string]string{}
		}
		arc.Labels[arcLabelPrometheusRuleName] = prName
		arc.Labels[arcLabelAlertName] = originalRule.Alert
		if arc.Annotations == nil {
			arc.Annotations = map[string]string{}
		}
		arc.Annotations[arcAnnotationAlertRuleIDKey] = alertRuleId

		err = c.k8sClient.AlertRelabelConfigs().Update(ctx, *arc)
		if err != nil {
			return fmt.Errorf("failed to update AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
		}
	} else {
		arc = &osmv1.AlertRelabelConfig{
			ObjectMeta: metav1.ObjectMeta{
				Name:      arcName,
				Namespace: namespace,
				Labels: map[string]string{
					arcLabelPrometheusRuleName: prName,
					arcLabelAlertName:          originalRule.Alert,
				},
				Annotations: map[string]string{
					arcAnnotationAlertRuleIDKey: alertRuleId,
				},
			},
			Spec: osmv1.AlertRelabelConfigSpec{
				Configs: relabelConfigs,
			},
		}

		_, err = c.k8sClient.AlertRelabelConfigs().Create(ctx, *arc)
		if err != nil {
			return fmt.Errorf("failed to create AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
		}
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
				// Tight match: alertname + exact ruleId
				SourceLabels: []osmv1.LabelName{"alertname", "openshift_io_alert_rule_id"},
				Regex:        fmt.Sprintf("%s;%s", alertName, alertRuleId),
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

// sanitizeDNSName lowercases and replaces invalid chars with '-', trims extra '-'
func sanitizeDNSName(in string) string {
	if in == "" {
		return ""
	}
	s := strings.ToLower(in)
	// replace any char not [a-z0-9-] with '-'
	out := make([]rune, 0, len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			out = append(out, r)
		} else {
			out = append(out, '-')
		}
	}
	// collapse multiple '-' and trim
	res := strings.Trim(strings.ReplaceAll(string(out), "--", "-"), "-")
	if res == "" {
		return "arc"
	}
	return res
}

func shortHash(id string, n int) string {
	// if id already contains a ';<hex>', use that suffix
	parts := strings.Split(id, ";")
	if len(parts) > 1 {
		h := parts[len(parts)-1]
		if len(h) >= n {
			return h[:n]
		}
	}
	sum := sha256.Sum256([]byte(id))
	full := fmt.Sprintf("%x", sum[:])
	if n > len(full) {
		return full
	}
	return full[:n]
}
