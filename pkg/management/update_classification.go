package management

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/classification"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// UpdateRuleClassificationRequest represents a single classification update
type UpdateRuleClassificationRequest struct {
	RuleId           string  `json:"ruleId"`
	Component        *string `json:"openshift_io_alert_rule_component,omitempty"`
	ComponentSet     bool    `json:"-"`
	Layer            *string `json:"openshift_io_alert_rule_layer,omitempty"`
	LayerSet         bool    `json:"-"`
	ComponentFrom    *string `json:"openshift_io_alert_rule_component_from,omitempty"`
	ComponentFromSet bool    `json:"-"`
	LayerFrom        *string `json:"openshift_io_alert_rule_layer_from,omitempty"`
	LayerFromSet     bool    `json:"-"`
}

// UpdateAlertRuleClassification updates component/layer for a single alertRuleId
func (c *client) UpdateAlertRuleClassification(ctx context.Context, req UpdateRuleClassificationRequest) error {
	if req.RuleId == "" {
		return &ValidationError{Message: "ruleId is required"}
	}
	// Validate inputs if provided
	if req.Component != nil && !classification.ValidateComponent(*req.Component) {
		return &ValidationError{Message: fmt.Sprintf("invalid component %q", *req.Component)}
	}
	if req.Layer != nil && !classification.ValidateLayer(*req.Layer) {
		return &ValidationError{Message: fmt.Sprintf("invalid layer %q (allowed: cluster, namespace)", *req.Layer)}
	}
	if req.ComponentFrom != nil {
		v := strings.TrimSpace(*req.ComponentFrom)
		if v != "" && !classification.ValidatePromLabelName(v) {
			return &ValidationError{Message: fmt.Sprintf("invalid openshift_io_alert_rule_component_from %q (must be a valid Prometheus label name)", *req.ComponentFrom)}
		}
	}
	if req.LayerFrom != nil {
		v := strings.TrimSpace(*req.LayerFrom)
		if v != "" && !classification.ValidatePromLabelName(v) {
			return &ValidationError{Message: fmt.Sprintf("invalid openshift_io_alert_rule_layer_from %q (must be a valid Prometheus label name)", *req.LayerFrom)}
		}
	}

	// Find the base rule to locate its PrometheusRule namespace
	rule, found := c.k8sClient.RelabeledRules().Get(ctx, req.RuleId)
	if !found {
		return &NotFoundError{Resource: "AlertRule", Id: req.RuleId}
	}

	// Nothing to update. Treat as a no-op and avoid creating/updating ConfigMaps.
	if !req.ComponentSet && !req.LayerSet && !req.ComponentFromSet && !req.LayerFromSet {
		return nil
	}

	ns := rule.Labels[k8s.PrometheusRuleLabelNamespace]
	cmName := OverrideConfigMapName(ns)
	overrideNamespace := c.overrideNamespace

	for i := 0; i < 3; i++ {
		cm, exists, err := c.k8sClient.ConfigMaps().Get(ctx, overrideNamespace, cmName)
		if err != nil {
			return err
		}
		if !exists {
			cm = &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      cmName,
					Namespace: overrideNamespace,
					Labels: map[string]string{
						managementlabels.AlertClassificationOverridesTypeLabelKey:      managementlabels.AlertClassificationOverridesTypeLabelValue,
						managementlabels.AlertClassificationOverridesManagedByLabelKey: managementlabels.AlertClassificationOverridesManagedByLabelValue,
						k8s.PrometheusRuleLabelNamespace:                               ns,
					},
				},
				Data: map[string]string{},
			}
		}

		key := classificationOverrideKey(req.RuleId)
		var entry alertRuleClassificationOverridePayload
		if raw, ok := cm.Data[key]; ok && raw != "" {
			_ = json.Unmarshal([]byte(raw), &entry)
		}

		if req.ComponentSet {
			if req.Component == nil {
				entry.Classification.Component = ""
			} else {
				entry.Classification.Component = *req.Component
			}
		}
		if req.LayerSet {
			if req.Layer == nil {
				entry.Classification.Layer = ""
			} else {
				entry.Classification.Layer = strings.ToLower(strings.TrimSpace(*req.Layer))
			}
		}
		if req.ComponentFromSet {
			if req.ComponentFrom == nil {
				entry.Classification.ComponentFrom = ""
			} else {
				entry.Classification.ComponentFrom = strings.TrimSpace(*req.ComponentFrom)
			}
		}
		if req.LayerFromSet {
			if req.LayerFrom == nil {
				entry.Classification.LayerFrom = ""
			} else {
				entry.Classification.LayerFrom = strings.TrimSpace(*req.LayerFrom)
			}
		}

		if entry.Classification.Component == "" &&
			entry.Classification.Layer == "" &&
			entry.Classification.ComponentFrom == "" &&
			entry.Classification.LayerFrom == "" {
			delete(cm.Data, key)
		} else {
			entry.AlertName = rule.Alert
			entry.RuleName = rule.Labels[k8s.PrometheusRuleLabelName]
			entry.RuleNamespace = ns
			encoded, err := json.Marshal(entry)
			if err != nil {
				return fmt.Errorf("failed to marshal updated classification: %w", err)
			}
			if cm.Data == nil {
				cm.Data = make(map[string]string)
			}
			cm.Data[key] = string(encoded)
		}

		if exists {
			if cm.Labels == nil {
				cm.Labels = map[string]string{}
			}
			cm.Labels[managementlabels.AlertClassificationOverridesTypeLabelKey] = managementlabels.AlertClassificationOverridesTypeLabelValue
			cm.Labels[managementlabels.AlertClassificationOverridesManagedByLabelKey] = managementlabels.AlertClassificationOverridesManagedByLabelValue
			cm.Labels[k8s.PrometheusRuleLabelNamespace] = ns
			if err := c.k8sClient.ConfigMaps().Update(ctx, *cm); err != nil {
				if apierrors.IsConflict(err) {
					continue
				}
				return err
			}
			return nil
		}

		if len(cm.Data) == 0 {
			return nil
		}
		if _, err := c.k8sClient.ConfigMaps().Create(ctx, *cm); err != nil {
			if apierrors.IsAlreadyExists(err) {
				continue
			}
			return err
		}
		return nil
	}

	return fmt.Errorf("failed to update %s after retries", cmName)
}

// BulkUpdateAlertRuleClassification updates multiple entries; returns per-item errors collected by caller
func (c *client) BulkUpdateAlertRuleClassification(ctx context.Context, items []UpdateRuleClassificationRequest) []error {
	errs := make([]error, len(items))
	for i := range items {
		errs[i] = c.UpdateAlertRuleClassification(ctx, items[i])
	}
	return errs
}
