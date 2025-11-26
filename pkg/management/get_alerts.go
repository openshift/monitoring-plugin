package management

import (
	"context"
	"fmt"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func (c *client) GetAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
	alerts, err := c.k8sClient.PrometheusAlerts().GetAlerts(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get prometheus alerts: %w", err)
	}

	var result []k8s.PrometheusAlert
	for _, alert := range alerts {
		// Apply relabel configurations to the alert
		updatedAlert, err := c.updateAlertBasedOnRelabelConfig(&alert)
		if err != nil {
			// Alert was dropped by relabel config, skip it
			continue
		}
		result = append(result, updatedAlert)
	}

	return result, nil
}

func (c *client) updateAlertBasedOnRelabelConfig(alert *k8s.PrometheusAlert) (k8s.PrometheusAlert, error) {
	// Create a temporary rule to match relabel configs
	rule := &monitoringv1.Rule{
		Alert:  alert.Labels["alertname"],
		Labels: alert.Labels,
	}

	configs := c.mapper.GetAlertRelabelConfigSpec(rule)

	updatedLabels, err := applyRelabelConfigs(string(rule.Alert), alert.Labels, configs)
	if err != nil {
		return k8s.PrometheusAlert{}, err
	}

	alert.Labels = updatedLabels
	// Update severity if it was changed
	if severity, exists := updatedLabels["severity"]; exists {
		alert.Labels["severity"] = severity
	}

	return *alert, nil
}
