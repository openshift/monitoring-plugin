package management

import (
	"context"
	"errors"
	"fmt"
	"strings"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

const openshiftMonitoringNamespace = "openshift-monitoring"

func (c *client) UpdatePlatformAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) error {
	prId, err := c.mapper.FindAlertRuleById(mapper.PrometheusAlertRuleId(alertRuleId))
	if err != nil {
		return err
	}

	if !IsPlatformAlertRule(types.NamespacedName(*prId)) {
		return errors.New("cannot update non-platform alert rule from " + prId.Namespace + "/" + prId.Name)
	}

	originalRule, err := c.getOriginalPlatformRule(ctx, prId, alertRuleId)
	if err != nil {
		return err
	}

	labelChanges := calculateLabelChanges(originalRule.Labels, alertRule.Labels)
	if len(labelChanges) == 0 {
		return errors.New("no label changes detected; platform alert rules can only have labels updated")
	}

	return c.applyLabelChangesViaAlertRelabelConfig(ctx, alertRuleId, originalRule.Alert, labelChanges)
}

func (c *client) getOriginalPlatformRule(ctx context.Context, prId *mapper.PrometheusRuleId, alertRuleId string) (*monitoringv1.Rule, error) {
	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, prId.Namespace, prId.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", prId.Namespace, prId.Name, err)
	}

	if !found {
		return nil, &NotFoundError{Resource: "PrometheusRule", Id: fmt.Sprintf("%s/%s", prId.Namespace, prId.Name)}
	}

	for groupIdx := range pr.Spec.Groups {
		for ruleIdx := range pr.Spec.Groups[groupIdx].Rules {
			rule := &pr.Spec.Groups[groupIdx].Rules[ruleIdx]
			if c.shouldUpdateRule(*rule, alertRuleId) {
				return rule, nil
			}
		}
	}

	return nil, fmt.Errorf("alert rule with id %s not found in PrometheusRule %s/%s", alertRuleId, prId.Namespace, prId.Name)
}

type labelChange struct {
	action      string
	sourceLabel string
	targetLabel string
	value       string
}

func calculateLabelChanges(originalLabels, newLabels map[string]string) []labelChange {
	var changes []labelChange

	for key, newValue := range newLabels {
		originalValue, exists := originalLabels[key]
		if !exists || originalValue != newValue {
			changes = append(changes, labelChange{
				action:      "Replace",
				targetLabel: key,
				value:       newValue,
			})
		}
	}

	for key := range originalLabels {
		// alertname is a special label that is used to identify the alert rule
		// and should not be dropped
		if key == "alertname" {
			continue
		}

		if _, exists := newLabels[key]; !exists {
			changes = append(changes, labelChange{
				action:      "LabelDrop",
				sourceLabel: key,
			})
		}
	}

	return changes
}

func (c *client) applyLabelChangesViaAlertRelabelConfig(ctx context.Context, alertRuleId string, alertName string, changes []labelChange) error {
	arcName := fmt.Sprintf("alertmanagement-%s", strings.ToLower(strings.ReplaceAll(alertRuleId, "/", "-")))

	existingArc, found, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, openshiftMonitoringNamespace, arcName)
	if err != nil {
		return fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", openshiftMonitoringNamespace, arcName, err)
	}

	relabelConfigs := c.buildRelabelConfigs(alertName, changes)

	var arc *osmv1.AlertRelabelConfig
	if found {
		arc = existingArc
		arc.Spec = osmv1.AlertRelabelConfigSpec{
			Configs: relabelConfigs,
		}

		err = c.k8sClient.AlertRelabelConfigs().Update(ctx, *arc)
		if err != nil {
			return fmt.Errorf("failed to update AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
		}
	} else {
		arc = &osmv1.AlertRelabelConfig{
			ObjectMeta: metav1.ObjectMeta{
				Name:      arcName,
				Namespace: openshiftMonitoringNamespace,
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

func (c *client) buildRelabelConfigs(alertName string, changes []labelChange) []osmv1.RelabelConfig {
	var configs []osmv1.RelabelConfig

	for _, change := range changes {
		switch change.action {
		case "Replace":
			config := osmv1.RelabelConfig{
				SourceLabels: []osmv1.LabelName{"alertname", osmv1.LabelName(change.targetLabel)},
				Regex:        fmt.Sprintf("%s;.*", alertName),
				TargetLabel:  change.targetLabel,
				Replacement:  change.value,
				Action:       "Replace",
			}
			configs = append(configs, config)
		case "LabelDrop":
			config := osmv1.RelabelConfig{
				SourceLabels: []osmv1.LabelName{"alertname"},
				Regex:        alertName,
				TargetLabel:  change.sourceLabel,
				Replacement:  "",
				Action:       "Replace",
			}
			configs = append(configs, config)
		}
	}

	return configs
}
