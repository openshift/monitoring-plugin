package testutils

import (
	"context"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/client-go/tools/cache"

	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

var _ mapper.Client = &MockMapperClient{}

// MockMapperClient is a simple mock for the mapper.Client interface
type MockMapperClient struct {
	GetAlertingRuleIdFunc         func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId
	FindAlertRuleByIdFunc         func(alertRuleId mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error)
	WatchPrometheusRulesFunc      func(ctx context.Context)
	AddPrometheusRuleFunc         func(pr *monitoringv1.PrometheusRule)
	DeletePrometheusRuleFunc      func(key cache.ObjectName)
	WatchAlertRelabelConfigsFunc  func(ctx context.Context)
	AddAlertRelabelConfigFunc     func(arc *osmv1.AlertRelabelConfig)
	DeleteAlertRelabelConfigFunc  func(key cache.ObjectName)
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

func (m *MockMapperClient) DeletePrometheusRule(key cache.ObjectName) {
	if m.DeletePrometheusRuleFunc != nil {
		m.DeletePrometheusRuleFunc(key)
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

func (m *MockMapperClient) DeleteAlertRelabelConfig(key cache.ObjectName) {
	if m.DeleteAlertRelabelConfigFunc != nil {
		m.DeleteAlertRelabelConfigFunc(key)
	}
}

func (m *MockMapperClient) GetAlertRelabelConfigSpec(alertRule *monitoringv1.Rule) []osmv1.RelabelConfig {
	if m.GetAlertRelabelConfigSpecFunc != nil {
		return m.GetAlertRelabelConfigSpecFunc(alertRule)
	}
	return nil
}
