package management

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

// Client is the interface for managing alert rules
type Client interface {
	// CreateUserDefinedAlertRule creates a new user-defined alert rule
	CreateUserDefinedAlertRule(ctx context.Context, alertRule monitoringv1.Rule, prOptions PrometheusRuleOptions) (alertRuleId string, err error)

	// DeleteAlertRuleById deletes an alert rule by its ID (user-defined or platform).
	DeleteAlertRuleById(ctx context.Context, alertRuleId string) error

	// CreatePlatformAlertRule creates a new platform alert rule
	CreatePlatformAlertRule(ctx context.Context, alertRule monitoringv1.Rule) (alertRuleId string, err error)

	// UpdateAlertRuleClassification updates component/layer for a single alert rule id
	UpdateAlertRuleClassification(ctx context.Context, req UpdateRuleClassificationRequest) error
	// BulkUpdateAlertRuleClassification updates classification for multiple rule ids
	BulkUpdateAlertRuleClassification(ctx context.Context, items []UpdateRuleClassificationRequest) []error
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
