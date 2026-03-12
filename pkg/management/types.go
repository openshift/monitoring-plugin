package management

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

// Client is the interface for managing alert rules
type Client interface {
	// GetRuleById retrieves a specific alert rule by its ID
	GetRuleById(ctx context.Context, alertRuleId string) (monitoringv1.Rule, error)

	// CreateUserDefinedAlertRule creates a new user-defined alert rule
	CreateUserDefinedAlertRule(ctx context.Context, alertRule monitoringv1.Rule, prOptions PrometheusRuleOptions) (alertRuleId string, err error)

	// UpdateUserDefinedAlertRule updates an existing user-defined alert rule by its ID
	// Returns the new rule ID after the update
	UpdateUserDefinedAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) (newRuleId string, err error)

	// DeleteUserDefinedAlertRuleById deletes a user-defined alert rule by its ID
	DeleteUserDefinedAlertRuleById(ctx context.Context, alertRuleId string) error

	// CreatePlatformAlertRule creates a new platform alert rule
	CreatePlatformAlertRule(ctx context.Context, alertRule monitoringv1.Rule) (alertRuleId string, err error)

	// UpdatePlatformAlertRule updates an existing platform alert rule by its ID
	// Platform alert rules can only have the labels updated through AlertRelabelConfigs
	UpdatePlatformAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) error

	// DropPlatformAlertRule hides a platform alert by adding a scoped Drop relabel entry
	DropPlatformAlertRule(ctx context.Context, alertRuleId string) error

	// RestorePlatformAlertRule restores a previously dropped platform alert by removing its Drop relabel entry
	RestorePlatformAlertRule(ctx context.Context, alertRuleId string) error

	// UpdateAlertRuleClassification updates component/layer for a single alert rule id
	UpdateAlertRuleClassification(ctx context.Context, req UpdateRuleClassificationRequest) error
	// BulkUpdateAlertRuleClassification updates classification for multiple rule ids
	BulkUpdateAlertRuleClassification(ctx context.Context, items []UpdateRuleClassificationRequest) []error

	// ListRules lists alert rules, optionally paginated via cursor-based pagination
	ListRules(ctx context.Context, prOptions PrometheusRuleOptions, arOptions AlertRuleOptions, pgOptions PaginationOptions) (ListRulesResult, error)

	// GetAlerts retrieves Prometheus alerts
	GetAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error)
	// GetRules retrieves Prometheus alerting rules and active alerts
	GetRules(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error)

	// GetAlertingHealth retrieves alerting health details
	GetAlertingHealth(ctx context.Context) (k8s.AlertingHealth, error)
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

type AlertRuleOptions struct {
	// Name filters alert rules by alert name
	Name string `json:"name,omitempty"`

	// Source filters alert rules by source type (platform or user-defined)
	Source string `json:"source,omitempty"`

	// Labels filters alert rules by arbitrary label key-value pairs
	Labels map[string]string `json:"labels,omitempty"`
}

// PaginationOptions controls cursor-based pagination for list endpoints.
type PaginationOptions struct {
	// Limit is the maximum number of results to return. Zero means no limit.
	Limit int

	// NextToken is an opaque cursor returned by a previous call; results will
	// start after the rule identified by this token.
	NextToken string
}

// ListRulesResult holds a page of rules and an optional cursor for the next page.
type ListRulesResult struct {
	Rules     []monitoringv1.Rule `json:"rules"`
	NextToken string              `json:"nextToken,omitempty"`
}
