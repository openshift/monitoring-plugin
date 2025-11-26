package testutils

import (
	"context"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

var _ mapper.Client = &MockMapperClient{}

// MockMapperClient is a simple mock for the mapper.Client interface
type MockMapperClient struct {
	GetAlertingRuleIdFunc         func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId
	FindAlertRuleByIdFunc         func(alertRuleId mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error)
	WatchPrometheusRulesFunc      func(ctx context.Context)
	AddPrometheusRuleFunc         func(pr *monitoringv1.PrometheusRule)
	DeletePrometheusRuleFunc      func(pr *monitoringv1.PrometheusRule)
	WatchAlertRelabelConfigsFunc  func(ctx context.Context)
	AddAlertRelabelConfigFunc     func(arc *osmv1.AlertRelabelConfig)
	DeleteAlertRelabelConfigFunc  func(arc *osmv1.AlertRelabelConfig)
	GetAlertRelabelConfigSpecFunc func(alertRule *monitoringv1.Rule) []osmv1.RelabelConfig
}

func (m *MockMapperClient) GetAlertingRuleId(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
	if m.GetAlertingRuleIdFunc != nil {
		return m.GetAlertingRuleIdFunc(alertRule)
	}
	return mapper.PrometheusAlertRuleId("mock-id")
}

func (m *MockMapperClient) FindAlertRuleById(alertRuleId mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
	if m.FindAlertRuleByIdFunc != nil {
		return m.FindAlertRuleByIdFunc(alertRuleId)
	}
	return nil, nil
}

func (m *MockMapperClient) WatchPrometheusRules(ctx context.Context) {
	if m.WatchPrometheusRulesFunc != nil {
		m.WatchPrometheusRulesFunc(ctx)
	}
}

func (m *MockMapperClient) AddPrometheusRule(pr *monitoringv1.PrometheusRule) {
	if m.AddPrometheusRuleFunc != nil {
		m.AddPrometheusRuleFunc(pr)
	}
}

func (m *MockMapperClient) DeletePrometheusRule(pr *monitoringv1.PrometheusRule) {
	if m.DeletePrometheusRuleFunc != nil {
		m.DeletePrometheusRuleFunc(pr)
	}
}

func (m *MockMapperClient) WatchAlertRelabelConfigs(ctx context.Context) {
	if m.WatchAlertRelabelConfigsFunc != nil {
		m.WatchAlertRelabelConfigsFunc(ctx)
	}
}

func (m *MockMapperClient) AddAlertRelabelConfig(arc *osmv1.AlertRelabelConfig) {
	if m.AddAlertRelabelConfigFunc != nil {
		m.AddAlertRelabelConfigFunc(arc)
	}
}

func (m *MockMapperClient) DeleteAlertRelabelConfig(arc *osmv1.AlertRelabelConfig) {
	if m.DeleteAlertRelabelConfigFunc != nil {
		m.DeleteAlertRelabelConfigFunc(arc)
	}
}

func (m *MockMapperClient) GetAlertRelabelConfigSpec(alertRule *monitoringv1.Rule) []osmv1.RelabelConfig {
	if m.GetAlertRelabelConfigSpecFunc != nil {
		return m.GetAlertRelabelConfigSpecFunc(alertRule)
	}
	return nil
}
