package management

import (
	"context"
	"errors"
	"fmt"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

const (
	alertRuleIdLabel    = "alert_rule_id"
	sourceLabel         = "source"
	platformSourceValue = "platform"
)

func (c *client) ListRules(ctx context.Context, prOptions PrometheusRuleOptions, arOptions AlertRuleOptions) ([]monitoringv1.Rule, error) {
	if prOptions.Name != "" && prOptions.Namespace == "" {
		return nil, errors.New("PrometheusRule Namespace must be specified when Name is provided")
	}

	// Name and Namespace specified
	if prOptions.Name != "" && prOptions.Namespace != "" {
		pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, prOptions.Namespace, prOptions.Name)
		if err != nil {
			return nil, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", prOptions.Namespace, prOptions.Name, err)
		}
		if !found {
			return nil, &NotFoundError{Resource: "PrometheusRule", Id: fmt.Sprintf("%s/%s", prOptions.Namespace, prOptions.Name)}
		}
		return c.extractAndFilterRules(*pr, &prOptions, &arOptions), nil
	}

	// Name not specified
	allPrometheusRules, err := c.k8sClient.PrometheusRules().List(ctx, prOptions.Namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to list PrometheusRules: %w", err)
	}

	var allRules []monitoringv1.Rule
	for _, pr := range allPrometheusRules {
		rules := c.extractAndFilterRules(pr, &prOptions, &arOptions)
		allRules = append(allRules, rules...)
	}

	return allRules, nil
}

func (c *client) extractAndFilterRules(pr monitoringv1.PrometheusRule, prOptions *PrometheusRuleOptions, arOptions *AlertRuleOptions) []monitoringv1.Rule {
	var rules []monitoringv1.Rule
	prId := types.NamespacedName{Name: pr.Name, Namespace: pr.Namespace}
	isPlatformRule := c.IsPlatformAlertRule(prId)

	for _, group := range pr.Spec.Groups {
		// Filter by group name if specified
		if prOptions.GroupName != "" && group.Name != prOptions.GroupName {
			continue
		}

		for _, rule := range group.Rules {
			// Skip recording rules (only process alert rules)
			if rule.Alert == "" {
				continue
			}

			// Apply alert rule filters
			if !c.matchesAlertRuleFilters(rule, pr, arOptions) {
				continue
			}

			// Parse and update the rule based on relabeling configurations
			r := c.parseRule(rule)
			if r != nil {
				c.addPlatformSourceLabel(r, isPlatformRule)
				rules = append(rules, *r)
			}
		}
	}

	return rules
}

func (c *client) addPlatformSourceLabel(rule *monitoringv1.Rule, isPlatformRule bool) {
	if rule == nil || !isPlatformRule {
		return
	}

	if rule.Labels == nil {
		rule.Labels = make(map[string]string)
	}
	rule.Labels[sourceLabel] = platformSourceValue
}

func (c *client) matchesAlertRuleFilters(rule monitoringv1.Rule, pr monitoringv1.PrometheusRule, arOptions *AlertRuleOptions) bool {
	// Filter by alert name
	if arOptions.Name != "" && string(rule.Alert) != arOptions.Name {
		return false
	}

	// Filter by source (platform or user-defined)
	if arOptions.Source != "" {
		prId := types.NamespacedName{Name: pr.Name, Namespace: pr.Namespace}
		isPlatform := c.IsPlatformAlertRule(prId)

		if arOptions.Source == "platform" && !isPlatform {
			return false
		}
		if arOptions.Source == "user-defined" && isPlatform {
			return false
		}
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

func (c *client) parseRule(rule monitoringv1.Rule) *monitoringv1.Rule {
	alertRuleId := c.mapper.GetAlertingRuleId(&rule)
	if alertRuleId == "" {
		return nil
	}

	_, err := c.mapper.FindAlertRuleById(mapper.PrometheusAlertRuleId(alertRuleId))
	if err != nil {
		return nil
	}

	rule, err = c.updateRuleBasedOnRelabelConfig(&rule)
	if err != nil {
		return nil
	}

	if rule.Labels == nil {
		rule.Labels = make(map[string]string)
	}
	rule.Labels[alertRuleIdLabel] = string(alertRuleId)

	return &rule
}
