package management

import (
	"context"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

func (c *client) ListRules(ctx context.Context, prOptions PrometheusRuleOptions, arOptions AlertRuleOptions) ([]monitoringv1.Rule, error) {
	if prOptions.Name != "" && prOptions.Namespace == "" {
		return nil, &ValidationError{Message: "namespace is required when prometheusRuleName is specified"}
	}

	allRules := c.k8sClient.RelabeledRules().List(ctx)
	var filteredRules []monitoringv1.Rule

	for _, rule := range allRules {
		// Filter by PrometheusRule name and namespace if specified
		if prOptions.Name != "" && prOptions.Namespace != "" {
			namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
			name := rule.Labels[k8s.PrometheusRuleLabelName]
			if namespace != prOptions.Namespace || name != prOptions.Name {
				continue
			}
		}

		// Apply alert rule filters
		if !c.matchesAlertRuleFilters(rule, arOptions) {
			continue
		}

		filteredRules = append(filteredRules, rule)
	}

	return filteredRules, nil
}

func (c *client) matchesAlertRuleFilters(rule monitoringv1.Rule, arOptions AlertRuleOptions) bool {
	// Filter by alert name
	if arOptions.Name != "" && string(rule.Alert) != arOptions.Name {
		return false
	}

	// Filter by source (platform)
	if arOptions.Source == "platform" {
		source, exists := rule.Labels["openshift_io_alert_source"]
		if !exists {
			return false
		}

		return source == "platform"
	}

	// Filter by labels
	if len(arOptions.Labels) > 0 {
		for key, value := range arOptions.Labels {
			ruleValue, exists := rule.Labels[key]
			if !exists || ruleValue != value {
				return false
			}
		}
	}

	return true
}
