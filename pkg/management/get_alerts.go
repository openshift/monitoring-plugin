package management

import (
	"context"
	"fmt"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"
	"k8s.io/apimachinery/pkg/types"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func (c *client) GetAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
	alerts, err := c.k8sClient.PrometheusAlerts().GetAlerts(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get prometheus alerts: %w", err)
	}

	configs := c.k8sClient.RelabeledRules().Config()

	var result []k8s.PrometheusAlert
	for _, alert := range alerts {

		relabels, keep := relabel.Process(labels.FromMap(alert.Labels), configs...)
		if !keep {
			continue
		}

		alert.Labels = relabels.Map()

		// Add calculated rule ID and source when not present
		c.setRuleIDAndSourceIfMissing(ctx, &alert)
		result = append(result, alert)
	}

	return result, nil
}

func (c *client) setRuleIDAndSourceIfMissing(ctx context.Context, alert *k8s.PrometheusAlert) {
	if alert.Labels[k8s.AlertRuleLabelId] == "" {
		for _, existing := range c.k8sClient.RelabeledRules().List(ctx) {
			if existing.Alert != alert.Labels[k8s.AlertNameLabel] {
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

func (c *client) deriveAlertSource(ruleLabels map[string]string) string {
	ns := ruleLabels[k8s.PrometheusRuleLabelNamespace]
	name := ruleLabels[k8s.PrometheusRuleLabelName]
	if ns == "" || name == "" {
		return ""
	}
	if c.IsPlatformAlertRule(types.NamespacedName{Namespace: ns, Name: name}) {
		return k8s.SourcePlatform
	}
	return k8s.SourceUser
}
