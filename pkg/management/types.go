package management

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

// Client is the interface for managing alert rules
type Client interface {
	// CreateUserDefinedAlertRule creates a new user-defined alert rule
	CreateUserDefinedAlertRule(ctx context.Context, alertRule monitoringv1.Rule, prOptions PrometheusRuleOptions) (alertRuleId string, err error)

	// CreatePlatformAlertRule creates a new platform alert rule
	CreatePlatformAlertRule(ctx context.Context, alertRule monitoringv1.Rule) (alertRuleId string, err error)
}

// PrometheusRuleOptions specifies options for selecting PrometheusRule resources and groups
type PrometheusRuleOptions struct {
	// Name of the PrometheusRule resource where the alert rule will be added/listed from
	Name string `json:"prometheusRuleName"`

	// Namespace of the PrometheusRule resource where the alert rule will be added/listed from
	Namespace string `json:"prometheusRuleNamespace"`

	// GroupName of the RuleGroup within the PrometheusRule resource
	GroupName string `json:"groupName"`
}
