package management

import (
	"context"
	"fmt"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"

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
		result = append(result, alert)
	}

	return result, nil
}
