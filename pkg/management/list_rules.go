package management

import (
	"context"
	"sort"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func (c *client) ListRules(ctx context.Context, prOptions PrometheusRuleOptions, arOptions AlertRuleOptions, pgOptions PaginationOptions) (ListRulesResult, error) {
	if prOptions.Name != "" && prOptions.Namespace == "" {
		return ListRulesResult{}, &ValidationError{Message: "namespace is required when prometheusRuleName is specified"}
	}

	allRules := c.k8sClient.RelabeledRules().List(ctx)
	var filteredRules []monitoringv1.Rule

	for _, rule := range allRules {
		if prOptions.Name != "" && prOptions.Namespace != "" {
			namespace := rule.Labels[k8s.PrometheusRuleLabelNamespace]
			name := rule.Labels[k8s.PrometheusRuleLabelName]
			if namespace != prOptions.Namespace || name != prOptions.Name {
				continue
			}
		}

		if !c.matchesAlertRuleFilters(rule, arOptions) {
			continue
		}

		filteredRules = append(filteredRules, rule)
	}

	sort.Slice(filteredRules, func(i, j int) bool {
		return filteredRules[i].Labels[k8s.AlertRuleLabelId] < filteredRules[j].Labels[k8s.AlertRuleLabelId]
	})

	if pgOptions.NextToken != "" {
		idx := sort.Search(len(filteredRules), func(i int) bool {
			return filteredRules[i].Labels[k8s.AlertRuleLabelId] > pgOptions.NextToken
		})
		filteredRules = filteredRules[idx:]
	}

	var nextToken string
	if pgOptions.Limit > 0 && len(filteredRules) > pgOptions.Limit {
		nextToken = filteredRules[pgOptions.Limit-1].Labels[k8s.AlertRuleLabelId]
		filteredRules = filteredRules[:pgOptions.Limit]
	}

	return ListRulesResult{Rules: filteredRules, NextToken: nextToken}, nil
}

func (c *client) matchesAlertRuleFilters(rule monitoringv1.Rule, arOptions AlertRuleOptions) bool {
	// Filter by alert name
	if arOptions.Name != "" && string(rule.Alert) != arOptions.Name {
		return false
	}

	// Filter by source (platform)
	if arOptions.Source == k8s.AlertSourcePlatform {
		source, exists := rule.Labels[k8s.AlertSourceLabel]
		if !exists {
			return false
		}

		return source == k8s.AlertSourcePlatform
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
