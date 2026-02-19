package management

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/openshift/monitoring-plugin/pkg/alertcomponent"
	"github.com/openshift/monitoring-plugin/pkg/classification"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"
	"k8s.io/apimachinery/pkg/types"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

var cvoAlertNames = map[string]struct{}{
	"ClusterOperatorDown":     {},
	"ClusterOperatorDegraded": {},
}

func (c *client) GetAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
	alerts, err := c.k8sClient.PrometheusAlerts().GetAlerts(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get prometheus alerts: %w", err)
	}

	configs := c.k8sClient.RelabeledRules().Config()
	rules := c.k8sClient.RelabeledRules().List(ctx)
	classificationCache := map[string]map[string]alertRuleClassificationOverridePayload{}

	result := make([]k8s.PrometheusAlert, 0, len(alerts))
	for _, alert := range alerts {
		// Only apply relabel configs for platform alerts. User workload alerts
		// already come from their own stack and should not be relabeled here.
		if alert.Labels[k8s.AlertSourceLabel] != k8s.AlertSourceUser {
			relabels, keep := relabel.Process(labels.FromMap(alert.Labels), configs...)
			if !keep {
				continue
			}
			alert.Labels = relabels.Map()
		}

		// Add calculated rule ID and source when not present (labels enrichment)
		c.setRuleIDAndSourceIfMissing(ctx, &alert, rules)

		// correlate alert -> base alert rule via subset matching against relabeled rules
		alertRuleId := alert.Labels[k8s.AlertRuleLabelId]
		component := ""
		layer := ""

		bestRule, corrId := correlateAlertToRule(alert.Labels, rules)
		if corrId != "" {
			alertRuleId = corrId
		}
		if bestRule == nil && alertRuleId != "" {
			if rule, ok := c.k8sClient.RelabeledRules().Get(ctx, alertRuleId); ok {
				bestRule = &rule
			}
		}

		if bestRule != nil {
			if src := c.deriveAlertSource(bestRule.Labels); src != "" {
				alert.Labels[k8s.AlertSourceLabel] = src
			}
			component, layer = classifyFromRule(bestRule)
		} else {
			component, layer = classifyFromAlertLabels(alert.Labels)
		}

		// CVO alerts have special defaults, but user overrides should still take precedence.
		if cvoComponent, cvoLayer, ok := classifyCvoAlert(alert.Labels); ok {
			component = cvoComponent
			layer = cvoLayer
		}

		if bestRule != nil && alertRuleId != "" {
			ov, ok, err := c.getRuleClassificationOverride(ctx, bestRule, alertRuleId, classificationCache)
			if err != nil {
				return nil, err
			}
			if ok {
				if ov.ComponentFrom != "" {
					if v := strings.TrimSpace(alert.Labels[ov.ComponentFrom]); v != "" && classification.ValidateComponent(v) {
						component = v
					}
				} else if ov.Component != "" {
					component = ov.Component
				}

				if ov.LayerFrom != "" {
					if v := alert.Labels[ov.LayerFrom]; classification.ValidateLayer(v) {
						layer = strings.ToLower(strings.TrimSpace(v))
					}
				} else if ov.Layer != "" {
					layer = ov.Layer
				}
			}
		}

		// keep label and optional enriched fields consistent
		if alert.Labels[k8s.AlertRuleLabelId] == "" && alertRuleId != "" {
			alert.Labels[k8s.AlertRuleLabelId] = alertRuleId
		}
		alert.AlertRuleId = alertRuleId

		alert.AlertComponent = component
		alert.AlertLayer = layer

		if bestRule != nil && bestRule.Labels != nil {
			alert.PrometheusRuleNamespace = bestRule.Labels[k8s.PrometheusRuleLabelNamespace]
			alert.PrometheusRuleName = bestRule.Labels[k8s.PrometheusRuleLabelName]
			alert.AlertingRuleName = bestRule.Labels[managementlabels.AlertingRuleLabelName]
		}

		result = append(result, alert)
	}

	return result, nil
}

type ruleClassificationOverride struct {
	Component     string
	Layer         string
	ComponentFrom string
	LayerFrom     string
}

func (c *client) setRuleIDAndSourceIfMissing(ctx context.Context, alert *k8s.PrometheusAlert, rules []monitoringv1.Rule) {
	if alert.Labels[k8s.AlertRuleLabelId] == "" {
		for _, existing := range rules {
			if existing.Alert != alert.Labels[managementlabels.AlertNameLabel] {
				continue
			}
			if !ruleMatchesAlert(existing.Labels, alert.Labels) {
				continue
			}
			rid := alertrule.GetAlertingRuleId(&existing)
			alert.Labels[k8s.AlertRuleLabelId] = rid
			if alert.Labels[k8s.AlertSourceLabel] == "" {
				if src := c.deriveAlertSource(existing.Labels); src != "" {
					alert.Labels[k8s.AlertSourceLabel] = src
				}
			}
			break
		}
	}
	if alert.Labels[k8s.AlertSourceLabel] != "" {
		return
	}
	if rid := alert.Labels[k8s.AlertRuleLabelId]; rid != "" {
		if existing, ok := c.k8sClient.RelabeledRules().Get(ctx, rid); ok {
			if src := c.deriveAlertSource(existing.Labels); src != "" {
				alert.Labels[k8s.AlertSourceLabel] = src
			}
		}
	}
}

func ruleMatchesAlert(existingRuleLabels, alertLabels map[string]string) bool {
	existingBusiness := filterBusinessLabels(existingRuleLabels)
	for k, v := range existingBusiness {
		lv, ok := alertLabels[k]
		if !ok || lv != v {
			return false
		}
	}
	return true
}

// correlateAlertToRule tries to find the base alert rule for the given alert labels
// by subset-matching against relabeled rules.
func correlateAlertToRule(alertLabels map[string]string, rules []monitoringv1.Rule) (*monitoringv1.Rule, string) {
	// Determine best match: prefer rules with more labels (more specific)
	var (
		bestId         string
		bestRule       *monitoringv1.Rule
		bestLabelCount int
	)
	for i := range rules {
		rule := &rules[i]
		ruleLabels := sanitizeRuleLabels(rule.Labels)
		if isSubset(ruleLabels, alertLabels) {
			if len(ruleLabels) > bestLabelCount {
				bestLabelCount = len(ruleLabels)
				bestRule = rule
				bestId = rule.Labels[k8s.AlertRuleLabelId]
			}
		}
	}
	if bestRule == nil {
		return nil, ""
	}
	return bestRule, bestId
}

// sanitizeRuleLabels removes meta labels that will not be present on alerts
func sanitizeRuleLabels(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		if k == k8s.PrometheusRuleLabelNamespace || k == k8s.PrometheusRuleLabelName || k == k8s.AlertRuleLabelId {
			continue
		}
		out[k] = v
	}
	return out
}

// isSubset returns true if all key/value pairs in sub are present in sup
func isSubset(sub map[string]string, sup map[string]string) bool {
	for k, v := range sub {
		if sv, ok := sup[k]; !ok || sv != v {
			return false
		}
	}
	return true
}

func (c *client) deriveAlertSource(ruleLabels map[string]string) string {
	ns := ruleLabels[k8s.PrometheusRuleLabelNamespace]
	name := ruleLabels[k8s.PrometheusRuleLabelName]
	if ns == "" || name == "" {
		return ""
	}
	if c.IsPlatformAlertRule(types.NamespacedName{Namespace: ns, Name: name}) {
		return k8s.AlertSourcePlatform
	}
	return k8s.AlertSourceUser
}

func (c *client) getRuleClassificationOverride(ctx context.Context, rule *monitoringv1.Rule, ruleId string, cache map[string]map[string]alertRuleClassificationOverridePayload) (ruleClassificationOverride, bool, error) {
	if rule.Labels == nil {
		return ruleClassificationOverride{}, false, nil
	}
	ns := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	if ns == "" {
		return ruleClassificationOverride{}, false, nil
	}

	entries, ok := cache[ns]
	if !ok {
		overrideNamespace := c.overrideNamespace
		cmName := OverrideConfigMapName(ns)
		cm, exists, err := c.k8sClient.ConfigMaps().Get(ctx, overrideNamespace, cmName)
		if err != nil {
			return ruleClassificationOverride{}, false, err
		}
		if !exists {
			cache[ns] = nil
			return ruleClassificationOverride{}, false, nil
		}
		if cm.Labels == nil ||
			cm.Labels[managementlabels.AlertClassificationOverridesTypeLabelKey] != managementlabels.AlertClassificationOverridesTypeLabelValue ||
			cm.Labels[k8s.PrometheusRuleLabelNamespace] != ns {
			cache[ns] = nil
			return ruleClassificationOverride{}, false, nil
		}
		entries = map[string]alertRuleClassificationOverridePayload{}
		for key, raw := range cm.Data {
			ruleId, ok := decodeClassificationOverrideKey(key)
			if !ok {
				continue
			}
			var entry alertRuleClassificationOverridePayload
			if err := json.Unmarshal([]byte(raw), &entry); err != nil {
				continue
			}
			entries[ruleId] = entry
		}
		cache[ns] = entries
	}

	if entries == nil {
		return ruleClassificationOverride{}, false, nil
	}
	entry, ok := entries[ruleId]
	if !ok {
		return ruleClassificationOverride{}, false, nil
	}

	ov := ruleClassificationOverride{
		Component:     strings.TrimSpace(entry.Classification.Component),
		Layer:         entry.Classification.Layer,
		ComponentFrom: entry.Classification.ComponentFrom,
		LayerFrom:     entry.Classification.LayerFrom,
	}

	if ov.Component != "" && !classification.ValidateComponent(ov.Component) {
		ov.Component = ""
	}
	if ov.Layer != "" && classification.ValidateLayer(ov.Layer) {
		ov.Layer = strings.ToLower(strings.TrimSpace(ov.Layer))
	} else {
		ov.Layer = ""
	}

	ov.ComponentFrom = strings.TrimSpace(ov.ComponentFrom)
	if ov.ComponentFrom != "" && !classification.ValidatePromLabelName(ov.ComponentFrom) {
		ov.ComponentFrom = ""
	}

	ov.LayerFrom = strings.TrimSpace(ov.LayerFrom)
	if ov.LayerFrom != "" && !classification.ValidatePromLabelName(ov.LayerFrom) {
		ov.LayerFrom = ""
	}

	if ov.Component == "" && ov.Layer == "" && ov.ComponentFrom == "" && ov.LayerFrom == "" {
		return ruleClassificationOverride{}, false, nil
	}

	return ov, true, nil
}

func classifyFromRule(rule *monitoringv1.Rule) (string, string) {
	lbls := model.LabelSet{}
	for k, v := range rule.Labels {
		lbls[model.LabelName(k)] = model.LabelValue(v)
	}
	if _, ok := lbls["namespace"]; !ok {
		if ns := rule.Labels[k8s.PrometheusRuleLabelNamespace]; ns != "" {
			lbls["namespace"] = model.LabelValue(ns)
		}
	}
	if rule.Alert != "" {
		lbls[model.LabelName(managementlabels.AlertNameLabel)] = model.LabelValue(rule.Alert)
	}

	layer, component := alertcomponent.DetermineComponent(lbls)
	if component == "" || component == "Others" {
		component = "other"
		layer = deriveLayerFromSource(rule.Labels)
	}

	component, layer = applyRuleScopedDefaults(rule.Labels, component, layer)
	return component, layer
}

func classifyFromAlertLabels(alertLabels map[string]string) (string, string) {
	lbls := model.LabelSet{}
	for k, v := range alertLabels {
		lbls[model.LabelName(k)] = model.LabelValue(v)
	}
	layer, component := alertcomponent.DetermineComponent(lbls)
	if component == "" || component == "Others" {
		component = "other"
		layer = deriveLayerFromSource(alertLabels)
	}
	component, layer = applyRuleScopedDefaults(alertLabels, component, layer)
	return component, layer
}

func deriveLayerFromSource(labels map[string]string) string {
	// - platform (openshift-monitoring prometheus) -> cluster
	// - user -> namespace
	if labels[k8s.AlertSourceLabel] == k8s.AlertSourcePlatform {
		return "cluster"
	}
	if labels[k8s.PrometheusRuleLabelNamespace] == k8s.ClusterMonitoringNamespace {
		return "cluster"
	}
	promSrc := labels["prometheus"]
	if strings.HasPrefix(promSrc, "openshift-monitoring/") {
		return "cluster"
	}
	return "namespace"
}

func applyRuleScopedDefaults(ruleLabels map[string]string, component, layer string) (string, string) {
	if ruleLabels == nil {
		return component, layer
	}
	if v := strings.TrimSpace(ruleLabels[k8s.AlertRuleClassificationComponentKey]); v != "" {
		if classification.ValidateComponent(v) {
			component = v
		}
	}
	if v := strings.TrimSpace(ruleLabels[k8s.AlertRuleClassificationLayerKey]); v != "" {
		if classification.ValidateLayer(v) {
			layer = strings.ToLower(strings.TrimSpace(v))
		}
	}
	return component, layer
}

func classifyCvoAlert(alertLabels map[string]string) (string, string, bool) {
	if _, ok := cvoAlertNames[alertLabels[managementlabels.AlertNameLabel]]; !ok {
		return "", "", false
	}
	component := alertLabels["name"]
	if component == "" {
		component = "version"
	}
	return component, "cluster", true
}
