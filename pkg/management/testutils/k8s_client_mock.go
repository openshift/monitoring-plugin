package testutils

import (
	"context"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/prometheus/model/relabel"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

// MockClient is a mock implementation of k8s.Client interface
type MockClient struct {
	TestConnectionFunc      func(ctx context.Context) error
	AlertingHealthFunc      func(ctx context.Context) (k8s.AlertingHealth, error)
	PrometheusAlertsFunc    func() k8s.PrometheusAlertsInterface
	PrometheusRulesFunc     func() k8s.PrometheusRuleInterface
	AlertRelabelConfigsFunc func() k8s.AlertRelabelConfigInterface
	AlertingRulesFunc       func() k8s.AlertingRuleInterface
	RelabeledRulesFunc      func() k8s.RelabeledRulesInterface
	NamespaceFunc           func() k8s.NamespaceInterface
	ConfigMapsFunc          func() k8s.ConfigMapInterface
}

// TestConnection mocks the TestConnection method
func (m *MockClient) TestConnection(ctx context.Context) error {
	if m.TestConnectionFunc != nil {
		return m.TestConnectionFunc(ctx)
	}
	return nil
}

// AlertingHealth mocks the AlertingHealth method
func (m *MockClient) AlertingHealth(ctx context.Context) (k8s.AlertingHealth, error) {
	if m.AlertingHealthFunc != nil {
		return m.AlertingHealthFunc(ctx)
	}
	return k8s.AlertingHealth{}, nil
}

// PrometheusAlerts mocks the PrometheusAlerts method
func (m *MockClient) PrometheusAlerts() k8s.PrometheusAlertsInterface {
	if m.PrometheusAlertsFunc != nil {
		return m.PrometheusAlertsFunc()
	}
	return &MockPrometheusAlertsInterface{}
}

// PrometheusRules mocks the PrometheusRules method
func (m *MockClient) PrometheusRules() k8s.PrometheusRuleInterface {
	if m.PrometheusRulesFunc != nil {
		return m.PrometheusRulesFunc()
	}
	return &MockPrometheusRuleInterface{}
}

// AlertRelabelConfigs mocks the AlertRelabelConfigs method
func (m *MockClient) AlertRelabelConfigs() k8s.AlertRelabelConfigInterface {
	if m.AlertRelabelConfigsFunc != nil {
		return m.AlertRelabelConfigsFunc()
	}
	return &MockAlertRelabelConfigInterface{}
}

// AlertingRules mocks the AlertingRules method
func (m *MockClient) AlertingRules() k8s.AlertingRuleInterface {
	if m.AlertingRulesFunc != nil {
		return m.AlertingRulesFunc()
	}
	return &MockAlertingRuleInterface{}
}

// RelabeledRules mocks the RelabeledRules method
func (m *MockClient) RelabeledRules() k8s.RelabeledRulesInterface {
	if m.RelabeledRulesFunc != nil {
		return m.RelabeledRulesFunc()
	}
	return &MockRelabeledRulesInterface{}
}

// Namespace mocks the Namespace method
func (m *MockClient) Namespace() k8s.NamespaceInterface {
	if m.NamespaceFunc != nil {
		return m.NamespaceFunc()
	}
	return &MockNamespaceInterface{}
}

// ConfigMaps mocks the ConfigMaps method
func (m *MockClient) ConfigMaps() k8s.ConfigMapInterface {
	if m.ConfigMapsFunc != nil {
		return m.ConfigMapsFunc()
	}
	return &MockConfigMapInterface{}
}

// MockPrometheusAlertsInterface is a mock implementation of k8s.PrometheusAlertsInterface
type MockPrometheusAlertsInterface struct {
	GetAlertsFunc func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error)
	GetRulesFunc  func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error)

	// Storage for test data
	ActiveAlerts []k8s.PrometheusAlert
	RuleGroups   []k8s.PrometheusRuleGroup
}

func (m *MockPrometheusAlertsInterface) SetActiveAlerts(alerts []k8s.PrometheusAlert) {
	m.ActiveAlerts = alerts
}

func (m *MockPrometheusAlertsInterface) SetRuleGroups(groups []k8s.PrometheusRuleGroup) {
	m.RuleGroups = groups
}

// GetAlerts mocks the GetAlerts method
func (m *MockPrometheusAlertsInterface) GetAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
	if m.GetAlertsFunc != nil {
		return m.GetAlertsFunc(ctx, req)
	}

	if m.ActiveAlerts != nil {
		return m.ActiveAlerts, nil
	}
	return []k8s.PrometheusAlert{}, nil
}

// GetRules mocks the GetRules method
func (m *MockPrometheusAlertsInterface) GetRules(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
	if m.GetRulesFunc != nil {
		return m.GetRulesFunc(ctx, req)
	}
	if m.RuleGroups != nil {
		return m.RuleGroups, nil
	}
	return []k8s.PrometheusRuleGroup{}, nil
}

// MockPrometheusRuleInterface is a mock implementation of k8s.PrometheusRuleInterface
type MockPrometheusRuleInterface struct {
	ListFunc    func(ctx context.Context, namespace string) ([]monitoringv1.PrometheusRule, error)
	GetFunc     func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error)
	UpdateFunc  func(ctx context.Context, pr monitoringv1.PrometheusRule) error
	DeleteFunc  func(ctx context.Context, namespace string, name string) error
	AddRuleFunc func(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error

	// Storage for test data
	PrometheusRules map[string]*monitoringv1.PrometheusRule
}

func (m *MockPrometheusRuleInterface) SetPrometheusRules(rules map[string]*monitoringv1.PrometheusRule) {
	m.PrometheusRules = rules
}

// List mocks the List method
func (m *MockPrometheusRuleInterface) List(ctx context.Context, namespace string) ([]monitoringv1.PrometheusRule, error) {
	if m.ListFunc != nil {
		return m.ListFunc(ctx, namespace)
	}

	var rules []monitoringv1.PrometheusRule
	if m.PrometheusRules != nil {
		for _, rule := range m.PrometheusRules {
			if namespace == "" || rule.Namespace == namespace {
				rules = append(rules, *rule)
			}
		}
	}
	return rules, nil
}

// Get mocks the Get method
func (m *MockPrometheusRuleInterface) Get(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, namespace, name)
	}

	key := namespace + "/" + name
	if m.PrometheusRules != nil {
		if rule, exists := m.PrometheusRules[key]; exists {
			return rule, true, nil
		}
	}

	return nil, false, nil
}

// Update mocks the Update method
func (m *MockPrometheusRuleInterface) Update(ctx context.Context, pr monitoringv1.PrometheusRule) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, pr)
	}

	key := pr.Namespace + "/" + pr.Name
	if m.PrometheusRules == nil {
		m.PrometheusRules = make(map[string]*monitoringv1.PrometheusRule)
	}
	m.PrometheusRules[key] = &pr
	return nil
}

// Delete mocks the Delete method
func (m *MockPrometheusRuleInterface) Delete(ctx context.Context, namespace string, name string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, namespace, name)
	}

	key := namespace + "/" + name
	if m.PrometheusRules != nil {
		delete(m.PrometheusRules, key)
	}
	return nil
}

// AddRule mocks the AddRule method
func (m *MockPrometheusRuleInterface) AddRule(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
	if m.AddRuleFunc != nil {
		return m.AddRuleFunc(ctx, namespacedName, groupName, rule)
	}

	key := namespacedName.Namespace + "/" + namespacedName.Name
	if m.PrometheusRules == nil {
		m.PrometheusRules = make(map[string]*monitoringv1.PrometheusRule)
	}

	// Get or create PrometheusRule
	pr, exists := m.PrometheusRules[key]
	if !exists {
		pr = &monitoringv1.PrometheusRule{
			Spec: monitoringv1.PrometheusRuleSpec{
				Groups: []monitoringv1.RuleGroup{},
			},
		}
		pr.Name = namespacedName.Name
		pr.Namespace = namespacedName.Namespace
		m.PrometheusRules[key] = pr
	}

	// Find or create the group
	var group *monitoringv1.RuleGroup
	for i := range pr.Spec.Groups {
		if pr.Spec.Groups[i].Name == groupName {
			group = &pr.Spec.Groups[i]
			break
		}
	}
	if group == nil {
		pr.Spec.Groups = append(pr.Spec.Groups, monitoringv1.RuleGroup{
			Name:  groupName,
			Rules: []monitoringv1.Rule{},
		})
		group = &pr.Spec.Groups[len(pr.Spec.Groups)-1]
	}

	// Add the new rule to the group
	group.Rules = append(group.Rules, rule)

	return nil
}

// MockAlertRelabelConfigInterface is a mock implementation of k8s.AlertRelabelConfigInterface
type MockAlertRelabelConfigInterface struct {
	ListFunc   func(ctx context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error)
	GetFunc    func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error)
	CreateFunc func(ctx context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error)
	UpdateFunc func(ctx context.Context, arc osmv1.AlertRelabelConfig) error
	DeleteFunc func(ctx context.Context, namespace string, name string) error

	// Storage for test data
	AlertRelabelConfigs map[string]*osmv1.AlertRelabelConfig
}

func (m *MockAlertRelabelConfigInterface) SetAlertRelabelConfigs(configs map[string]*osmv1.AlertRelabelConfig) {
	m.AlertRelabelConfigs = configs
}

// List mocks the List method
func (m *MockAlertRelabelConfigInterface) List(ctx context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
	if m.ListFunc != nil {
		return m.ListFunc(ctx, namespace)
	}

	var configs []osmv1.AlertRelabelConfig
	if m.AlertRelabelConfigs != nil {
		for _, config := range m.AlertRelabelConfigs {
			if namespace == "" || config.Namespace == namespace {
				configs = append(configs, *config)
			}
		}
	}
	return configs, nil
}

// Get mocks the Get method
func (m *MockAlertRelabelConfigInterface) Get(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, namespace, name)
	}

	key := namespace + "/" + name
	if m.AlertRelabelConfigs != nil {
		if config, exists := m.AlertRelabelConfigs[key]; exists {
			return config, true, nil
		}
	}

	return nil, false, nil
}

// Create mocks the Create method
func (m *MockAlertRelabelConfigInterface) Create(ctx context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, arc)
	}

	key := arc.Namespace + "/" + arc.Name
	if m.AlertRelabelConfigs == nil {
		m.AlertRelabelConfigs = make(map[string]*osmv1.AlertRelabelConfig)
	}
	m.AlertRelabelConfigs[key] = &arc
	return &arc, nil
}

// Update mocks the Update method
func (m *MockAlertRelabelConfigInterface) Update(ctx context.Context, arc osmv1.AlertRelabelConfig) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, arc)
	}

	key := arc.Namespace + "/" + arc.Name
	if m.AlertRelabelConfigs == nil {
		m.AlertRelabelConfigs = make(map[string]*osmv1.AlertRelabelConfig)
	}
	m.AlertRelabelConfigs[key] = &arc
	return nil
}

// Delete mocks the Delete method
func (m *MockAlertRelabelConfigInterface) Delete(ctx context.Context, namespace string, name string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, namespace, name)
	}

	key := namespace + "/" + name
	if m.AlertRelabelConfigs != nil {
		delete(m.AlertRelabelConfigs, key)
	}
	return nil
}

// MockAlertingRuleInterface is a mock implementation of k8s.AlertingRuleInterface
type MockAlertingRuleInterface struct {
	ListFunc   func(ctx context.Context) ([]osmv1.AlertingRule, error)
	GetFunc    func(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error)
	CreateFunc func(ctx context.Context, ar osmv1.AlertingRule) (*osmv1.AlertingRule, error)
	UpdateFunc func(ctx context.Context, ar osmv1.AlertingRule) error
	DeleteFunc func(ctx context.Context, name string) error

	// Storage for test data
	AlertingRules map[string]*osmv1.AlertingRule
}

func (m *MockAlertingRuleInterface) SetAlertingRules(rules map[string]*osmv1.AlertingRule) {
	m.AlertingRules = rules
}

// List mocks the List method
func (m *MockAlertingRuleInterface) List(ctx context.Context) ([]osmv1.AlertingRule, error) {
	if m.ListFunc != nil {
		return m.ListFunc(ctx)
	}

	var rules []osmv1.AlertingRule
	if m.AlertingRules != nil {
		for _, rule := range m.AlertingRules {
			if rule.Namespace == k8s.ClusterMonitoringNamespace {
				rules = append(rules, *rule)
			}
		}
	}
	return rules, nil
}

// Get mocks the Get method
func (m *MockAlertingRuleInterface) Get(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, name)
	}

	key := k8s.ClusterMonitoringNamespace + "/" + name
	if m.AlertingRules != nil {
		if rule, exists := m.AlertingRules[key]; exists {
			return rule, true, nil
		}
	}

	return nil, false, nil
}

// Create mocks the Create method
func (m *MockAlertingRuleInterface) Create(ctx context.Context, ar osmv1.AlertingRule) (*osmv1.AlertingRule, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, ar)
	}

	key := ar.Namespace + "/" + ar.Name
	if m.AlertingRules == nil {
		m.AlertingRules = make(map[string]*osmv1.AlertingRule)
	}
	m.AlertingRules[key] = &ar
	return &ar, nil
}

// Update mocks the Update method
func (m *MockAlertingRuleInterface) Update(ctx context.Context, ar osmv1.AlertingRule) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, ar)
	}

	key := ar.Namespace + "/" + ar.Name
	if m.AlertingRules == nil {
		m.AlertingRules = make(map[string]*osmv1.AlertingRule)
	}
	m.AlertingRules[key] = &ar
	return nil
}

// Delete mocks the Delete method
func (m *MockAlertingRuleInterface) Delete(ctx context.Context, name string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, name)
	}

	key := k8s.ClusterMonitoringNamespace + "/" + name
	if m.AlertingRules != nil {
		delete(m.AlertingRules, key)
	}
	return nil
}

// MockRelabeledRulesInterface is a mock implementation of k8s.RelabeledRulesInterface
type MockRelabeledRulesInterface struct {
	ListFunc   func(ctx context.Context) []monitoringv1.Rule
	GetFunc    func(ctx context.Context, id string) (monitoringv1.Rule, bool)
	ConfigFunc func() []*relabel.Config
}

func (m *MockRelabeledRulesInterface) List(ctx context.Context) []monitoringv1.Rule {
	if m.ListFunc != nil {
		return m.ListFunc(ctx)
	}
	return []monitoringv1.Rule{}
}

func (m *MockRelabeledRulesInterface) Get(ctx context.Context, id string) (monitoringv1.Rule, bool) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, id)
	}
	return monitoringv1.Rule{}, false
}

func (m *MockRelabeledRulesInterface) Config() []*relabel.Config {
	if m.ConfigFunc != nil {
		return m.ConfigFunc()
	}
	return []*relabel.Config{}
}

// MockNamespaceInterface is a mock implementation of k8s.NamespaceInterface
type MockNamespaceInterface struct {
	IsClusterMonitoringNamespaceFunc func(name string) bool

	// Storage for test data
	MonitoringNamespaces map[string]bool
}

func (m *MockNamespaceInterface) SetMonitoringNamespaces(namespaces map[string]bool) {
	m.MonitoringNamespaces = namespaces
}

// IsClusterMonitoringNamespace mocks the IsClusterMonitoringNamespace method
func (m *MockNamespaceInterface) IsClusterMonitoringNamespace(name string) bool {
	if m.IsClusterMonitoringNamespaceFunc != nil {
		return m.IsClusterMonitoringNamespaceFunc(name)
	}
	return m.MonitoringNamespaces[name]
}

// MockConfigMapInterface is a mock implementation of k8s.ConfigMapInterface
type MockConfigMapInterface struct {
	GetFunc    func(ctx context.Context, namespace string, name string) (*corev1.ConfigMap, bool, error)
	UpdateFunc func(ctx context.Context, cm corev1.ConfigMap) error
	CreateFunc func(ctx context.Context, cm corev1.ConfigMap) (*corev1.ConfigMap, error)

	// Storage
	ConfigMaps map[string]*corev1.ConfigMap
}

func (m *MockConfigMapInterface) Get(ctx context.Context, namespace string, name string) (*corev1.ConfigMap, bool, error) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, namespace, name)
	}
	key := namespace + "/" + name
	if m.ConfigMaps != nil {
		if cm, ok := m.ConfigMaps[key]; ok {
			return cm, true, nil
		}
	}
	return nil, false, nil
}

func (m *MockConfigMapInterface) Update(ctx context.Context, cm corev1.ConfigMap) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, cm)
	}
	key := cm.Namespace + "/" + cm.Name
	if m.ConfigMaps == nil {
		m.ConfigMaps = make(map[string]*corev1.ConfigMap)
	}
	copy := cm
	m.ConfigMaps[key] = &copy
	return nil
}

func (m *MockConfigMapInterface) Create(ctx context.Context, cm corev1.ConfigMap) (*corev1.ConfigMap, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, cm)
	}
	key := cm.Namespace + "/" + cm.Name
	if m.ConfigMaps == nil {
		m.ConfigMaps = make(map[string]*corev1.ConfigMap)
	}
	copy := cm
	m.ConfigMaps[key] = &copy
	return &copy, nil
}
