package mapper

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type mapper struct {
	k8sClient k8s.Client
	mu        sync.RWMutex

	prometheusRules     map[PrometheusRuleId][]PrometheusAlertRuleId
	alertRelabelConfigs map[AlertRelabelConfigId][]osmv1.RelabelConfig
}

var _ Client = (*mapper)(nil)

func (m *mapper) GetAlertingRuleId(alertRule *monitoringv1.Rule) PrometheusAlertRuleId {
	var kind, name string
	if alertRule.Alert != "" {
		kind = "alert"
		name = alertRule.Alert
	} else if alertRule.Record != "" {
		kind = "record"
		name = alertRule.Record
	} else {
		return ""
	}

	expr := alertRule.Expr.String()
	forDuration := ""
	if alertRule.For != nil {
		forDuration = string(*alertRule.For)
	}

	var sortedLabels []string
	if alertRule.Labels != nil {
		for key, value := range alertRule.Labels {
			sortedLabels = append(sortedLabels, fmt.Sprintf("%s=%s", key, value))
		}
		sort.Strings(sortedLabels)
	}

	var sortedAnnotations []string
	if alertRule.Annotations != nil {
		for key, value := range alertRule.Annotations {
			sortedAnnotations = append(sortedAnnotations, fmt.Sprintf("%s=%s", key, value))
		}
		sort.Strings(sortedAnnotations)
	}

	// Build the hash input string
	hashInput := strings.Join([]string{
		kind,
		name,
		expr,
		forDuration,
		strings.Join(sortedLabels, ","),
		strings.Join(sortedAnnotations, ","),
	}, "\n")

	// Generate SHA256 hash
	hash := sha256.Sum256([]byte(hashInput))

	return PrometheusAlertRuleId(fmt.Sprintf("%s/%x", name, hash))
}

func (m *mapper) FindAlertRuleById(alertRuleId PrometheusAlertRuleId) (*PrometheusRuleId, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for id, rules := range m.prometheusRules {
		if slices.Contains(rules, alertRuleId) {
			return &id, nil
		}
	}

	// If the PrometheusRuleId is not found, return an error
	return nil, fmt.Errorf("alert rule with id %s not found", alertRuleId)
}

func (m *mapper) WatchPrometheusRules(ctx context.Context) {
	go func() {
		callbacks := k8s.PrometheusRuleInformerCallback{
			OnAdd: func(pr *monitoringv1.PrometheusRule) {
				m.AddPrometheusRule(pr)
			},
			OnUpdate: func(pr *monitoringv1.PrometheusRule) {
				m.AddPrometheusRule(pr)
			},
			OnDelete: func(pr *monitoringv1.PrometheusRule) {
				m.DeletePrometheusRule(pr)
			},
		}

		err := m.k8sClient.PrometheusRuleInformer().Run(ctx, callbacks)
		if err != nil {
			log.Fatalf("Failed to run PrometheusRule informer: %v", err)
		}
	}()
}

func (m *mapper) AddPrometheusRule(pr *monitoringv1.PrometheusRule) {
	m.mu.Lock()
	defer m.mu.Unlock()

	promRuleId := PrometheusRuleId(types.NamespacedName{Namespace: pr.Namespace, Name: pr.Name})
	delete(m.prometheusRules, promRuleId)

	rules := make([]PrometheusAlertRuleId, 0)
	for _, group := range pr.Spec.Groups {
		for _, rule := range group.Rules {
			if rule.Alert != "" {
				ruleId := m.GetAlertingRuleId(&rule)
				if ruleId != "" {
					rules = append(rules, ruleId)
				}
			}
		}
	}

	m.prometheusRules[promRuleId] = rules
}

func (m *mapper) DeletePrometheusRule(pr *monitoringv1.PrometheusRule) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.prometheusRules, PrometheusRuleId(types.NamespacedName{Namespace: pr.Namespace, Name: pr.Name}))
}

func (m *mapper) WatchAlertRelabelConfigs(ctx context.Context) {
	go func() {
		callbacks := k8s.AlertRelabelConfigInformerCallback{
			OnAdd: func(arc *osmv1.AlertRelabelConfig) {
				m.AddAlertRelabelConfig(arc)
			},
			OnUpdate: func(arc *osmv1.AlertRelabelConfig) {
				m.AddAlertRelabelConfig(arc)
			},
			OnDelete: func(arc *osmv1.AlertRelabelConfig) {
				m.DeleteAlertRelabelConfig(arc)
			},
		}

		err := m.k8sClient.AlertRelabelConfigInformer().Run(ctx, callbacks)
		if err != nil {
			log.Fatalf("Failed to run AlertRelabelConfig informer: %v", err)
		}
	}()
}

func (m *mapper) AddAlertRelabelConfig(arc *osmv1.AlertRelabelConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()

	arcId := AlertRelabelConfigId(types.NamespacedName{Namespace: arc.Namespace, Name: arc.Name})

	// Clean up old entries
	delete(m.alertRelabelConfigs, arcId)

	configs := make([]osmv1.RelabelConfig, 0)

	for _, config := range arc.Spec.Configs {
		if slices.Contains(config.SourceLabels, "alertname") {
			alertname := parseAlertnameFromRelabelConfig(config)
			if alertname != "" {
				configs = append(configs, config)
			}
		}
	}

	if len(configs) > 0 {
		m.alertRelabelConfigs[arcId] = configs
	}
}

func parseAlertnameFromRelabelConfig(config osmv1.RelabelConfig) string {
	separator := config.Separator
	if separator == "" {
		separator = ";"
	}

	regex := config.Regex
	if regex == "" {
		return ""
	}

	values := strings.Split(regex, separator)
	if len(values) != len(config.SourceLabels) {
		return ""
	}

	// Find the alertname value from source labels
	for i, labelName := range config.SourceLabels {
		if string(labelName) == "alertname" {
			return values[i]
		}
	}

	return ""
}

func (m *mapper) DeleteAlertRelabelConfig(arc *osmv1.AlertRelabelConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()

	arcId := AlertRelabelConfigId(types.NamespacedName{Namespace: arc.Namespace, Name: arc.Name})
	delete(m.alertRelabelConfigs, arcId)
}

func (m *mapper) GetAlertRelabelConfigSpec(alertRule *monitoringv1.Rule) []osmv1.RelabelConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if alertRule == nil {
		return nil
	}

	var matchingConfigs []osmv1.RelabelConfig

	// Iterate through all AlertRelabelConfigs
	for _, configs := range m.alertRelabelConfigs {
		for _, config := range configs {
			if m.configMatchesAlert(config, alertRule) {
				matchingConfigs = append(matchingConfigs, config)
			}
		}
	}

	return matchingConfigs
}

// configMatchesAlert checks if a RelabelConfig matches the given alert rule's labels
func (m *mapper) configMatchesAlert(config osmv1.RelabelConfig, alertRule *monitoringv1.Rule) bool {
	separator := config.Separator
	if separator == "" {
		separator = ";"
	}

	var labelValues []string
	for _, labelName := range config.SourceLabels {
		labelValue := ""

		if string(labelName) == "alertname" {
			if alertRule.Alert != "" {
				labelValue = alertRule.Alert
			}
		} else {
			if alertRule.Labels != nil {
				if val, exists := alertRule.Labels[string(labelName)]; exists {
					labelValue = val
				}
			}
		}

		labelValues = append(labelValues, labelValue)
	}

	ruleLabels := strings.Join(labelValues, separator)

	regex := config.Regex
	if regex == "" {
		regex = "(.*)"
	}

	matched, err := regexp.MatchString(regex, ruleLabels)
	if err != nil {
		return false
	}

	return matched
}
