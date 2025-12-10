package mapper

import (
	osmv1 "github.com/openshift/api/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

// New creates a new instance of the mapper client.
func New(k8sClient k8s.Client) Client {
	return &mapper{
		k8sClient:           k8sClient,
		prometheusRules:     make(map[PrometheusRuleId][]PrometheusAlertRuleId),
		alertRelabelConfigs: make(map[AlertRelabelConfigId][]osmv1.RelabelConfig),
	}
}
