package management_test

import (
	"context"
	"errors"
	"maps"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

var (
	grTestRule = monitoringv1.Rule{
		Alert: "TestAlert",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity":                       "warning",
			k8s.PrometheusRuleLabelNamespace: "test-namespace",
			k8s.PrometheusRuleLabelName:      "test-rule",
		},
	}
	grTestRuleId = alertrule.GetAlertingRuleId(&grTestRule)
)

func newGetRuleClient(t *testing.T) (management.Client, *testutils.MockClient) {
	t.Helper()
	mockK8s := &testutils.MockClient{}
	return management.New(context.Background(), mockK8s), mockK8s
}

func TestGetRuleById_Found(t *testing.T) {
	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == grTestRuleId {
					return grTestRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	rule, err := client.GetRuleById(context.Background(), grTestRuleId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rule.Alert != "TestAlert" {
		t.Errorf("expected alert %q, got %q", "TestAlert", rule.Alert)
	}
	if rule.Labels["severity"] != "warning" {
		t.Errorf("expected severity %q, got %q", "warning", rule.Labels["severity"])
	}
}

func TestGetRuleById_NotFound(t *testing.T) {
	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, _ string) (monitoringv1.Rule, bool) {
				return monitoringv1.Rule{}, false
			},
		}
	}

	_, err := client.GetRuleById(context.Background(), "nonexistent-id")
	if err == nil {
		t.Fatal("expected NotFoundError")
	}
	var nf *management.NotFoundError
	if !errors.As(err, &nf) {
		t.Errorf("expected NotFoundError, got %T: %v", err, err)
	}
	if nf.Resource != "AlertRule" {
		t.Errorf("expected Resource %q, got %q", "AlertRule", nf.Resource)
	}
	if nf.Id != "nonexistent-id" {
		t.Errorf("expected Id %q, got %q", "nonexistent-id", nf.Id)
	}
}

func TestGetRuleById_MultipleRules(t *testing.T) {
	rule1 := monitoringv1.Rule{Alert: "Alert1", Expr: intstr.FromString("up == 0")}
	rule1Id := alertrule.GetAlertingRuleId(&rule1)
	rule2 := monitoringv1.Rule{Alert: "Alert2", Expr: intstr.FromString("down == 1")}
	rule2Id := alertrule.GetAlertingRuleId(&rule2)

	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				switch id {
				case rule1Id:
					return rule1, true
				case rule2Id:
					return rule2, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	r1, err := client.GetRuleById(context.Background(), rule1Id)
	if err != nil || r1.Alert != "Alert1" {
		t.Errorf("rule1: got alert=%q err=%v", r1.Alert, err)
	}
	r2, err := client.GetRuleById(context.Background(), rule2Id)
	if err != nil || r2.Alert != "Alert2" {
		t.Errorf("rule2: got alert=%q err=%v", r2.Alert, err)
	}
}

func TestGetRuleById_RecordingRule(t *testing.T) {
	recRule := monitoringv1.Rule{
		Record: "job:request_latency_seconds:mean5m",
		Expr:   intstr.FromString("avg by (job) (request_latency_seconds)"),
	}
	recRuleId := alertrule.GetAlertingRuleId(&recRule)

	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == recRuleId {
					return recRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	rule, err := client.GetRuleById(context.Background(), recRuleId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rule.Record != "job:request_latency_seconds:mean5m" {
		t.Errorf("expected record name, got %q", rule.Record)
	}
}

func buildRuleWithManagedBy(base monitoringv1.Rule, ruleId string, prName, prNS string,
	ruleManagedBy, relabelManagedBy string) monitoringv1.Rule {
	r := base
	r.Labels = maps.Clone(base.Labels)
	if r.Labels == nil {
		r.Labels = make(map[string]string)
	}
	r.Labels[managementlabels.AlertNameLabel] = r.Alert
	r.Labels[k8s.AlertRuleLabelId] = ruleId
	r.Labels[k8s.PrometheusRuleLabelNamespace] = prNS
	r.Labels[k8s.PrometheusRuleLabelName] = prName
	if ruleManagedBy != "" {
		r.Labels[managementlabels.RuleManagedByLabel] = ruleManagedBy
	}
	if relabelManagedBy != "" {
		r.Labels[managementlabels.RelabelConfigManagedByLabel] = relabelManagedBy
	}
	return r
}

func TestGetRuleById_OperatorManagedByLabel(t *testing.T) {
	ctx := context.Background()
	mockARC := &testutils.MockAlertRelabelConfigInterface{}
	mockNS := &testutils.MockNamespaceInterface{
		IsClusterMonitoringNamespaceFunc: func(_ string) bool { return false },
	}

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name: "operator-rule", Namespace: "test-namespace",
			OwnerReferences: []metav1.OwnerReference{
				{APIVersion: "apps/v1", Kind: "Deployment", Name: "test-operator", UID: "test-uid"},
			},
		},
	}
	ruleManagedBy, relabelManagedBy := k8s.DetermineManagedBy(ctx, mockARC, mockNS, promRule, grTestRuleId)
	ruleWithLabel := buildRuleWithManagedBy(grTestRule, grTestRuleId, promRule.Name, promRule.Namespace, ruleManagedBy, relabelManagedBy)

	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == grTestRuleId {
					return ruleWithLabel, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	rule, err := client.GetRuleById(context.Background(), grTestRuleId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rule.Labels[managementlabels.RuleManagedByLabel] != "operator" {
		t.Errorf("expected managed_by=operator, got %q", rule.Labels[managementlabels.RuleManagedByLabel])
	}
}

func TestGetRuleById_NoManagedByLabelForNormalRule(t *testing.T) {
	ctx := context.Background()
	mockARC := &testutils.MockAlertRelabelConfigInterface{}
	mockNS := &testutils.MockNamespaceInterface{
		IsClusterMonitoringNamespaceFunc: func(_ string) bool { return false },
	}

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{Name: "local-rule", Namespace: "test-namespace"},
	}
	ruleManagedBy, relabelManagedBy := k8s.DetermineManagedBy(ctx, mockARC, mockNS, promRule, grTestRuleId)
	ruleWithLabel := buildRuleWithManagedBy(grTestRule, grTestRuleId, promRule.Name, promRule.Namespace, ruleManagedBy, relabelManagedBy)

	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == grTestRuleId {
					return ruleWithLabel, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	rule, err := client.GetRuleById(context.Background(), grTestRuleId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := rule.Labels[managementlabels.RuleManagedByLabel]; ok {
		t.Error("expected no managed_by label for normal rule")
	}
}

func TestGetRuleById_RelabelConfigGitOpsManagedBy(t *testing.T) {
	ctx := context.Background()
	mockARC := &testutils.MockAlertRelabelConfigInterface{
		GetFunc: func(_ context.Context, ns, name string) (*osmv1.AlertRelabelConfig, bool, error) {
			return &osmv1.AlertRelabelConfig{
				ObjectMeta: metav1.ObjectMeta{
					Name: name, Namespace: ns,
					Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "test-id"},
				},
			}, true, nil
		},
	}
	mockNS := &testutils.MockNamespaceInterface{
		IsClusterMonitoringNamespaceFunc: func(_ string) bool { return true },
	}

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name: "platform-rule", Namespace: "openshift-monitoring",
			OwnerReferences: []metav1.OwnerReference{
				{APIVersion: "apps/v1", Kind: "Deployment", Name: "test-operator", UID: "test-uid"},
			},
		},
	}
	ruleManagedBy, relabelManagedBy := k8s.DetermineManagedBy(ctx, mockARC, mockNS, promRule, grTestRuleId)
	ruleWithLabel := buildRuleWithManagedBy(grTestRule, grTestRuleId, promRule.Name, promRule.Namespace, ruleManagedBy, relabelManagedBy)

	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == grTestRuleId {
					return ruleWithLabel, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	rule, err := client.GetRuleById(context.Background(), grTestRuleId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rule.Labels[managementlabels.RuleManagedByLabel] != "operator" {
		t.Errorf("expected managed_by=operator, got %q", rule.Labels[managementlabels.RuleManagedByLabel])
	}
	if rule.Labels[managementlabels.RelabelConfigManagedByLabel] != "gitops" {
		t.Errorf("expected relabel_config_managed_by=gitops, got %q", rule.Labels[managementlabels.RelabelConfigManagedByLabel])
	}
}

func TestGetRuleById_GitOpsManagedByLabel(t *testing.T) {
	ctx := context.Background()
	mockARC := &testutils.MockAlertRelabelConfigInterface{}
	mockNS := &testutils.MockNamespaceInterface{
		IsClusterMonitoringNamespaceFunc: func(_ string) bool { return true },
	}

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name: "platform-rule", Namespace: "openshift-monitoring",
			Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "test-id"},
		},
	}
	ruleManagedBy, relabelManagedBy := k8s.DetermineManagedBy(ctx, mockARC, mockNS, promRule, grTestRuleId)
	ruleWithLabel := buildRuleWithManagedBy(grTestRule, grTestRuleId, promRule.Name, promRule.Namespace, ruleManagedBy, relabelManagedBy)

	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == grTestRuleId {
					return ruleWithLabel, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	rule, err := client.GetRuleById(context.Background(), grTestRuleId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rule.Labels[managementlabels.RuleManagedByLabel] != "gitops" {
		t.Errorf("expected managed_by=gitops, got %q", rule.Labels[managementlabels.RuleManagedByLabel])
	}
}

func TestGetRuleById_NoRelabelConfigManagedByWhenNotGitOps(t *testing.T) {
	ctx := context.Background()
	mockARC := &testutils.MockAlertRelabelConfigInterface{
		GetFunc: func(_ context.Context, ns, name string) (*osmv1.AlertRelabelConfig, bool, error) {
			return &osmv1.AlertRelabelConfig{
				ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			}, true, nil
		},
	}
	mockNS := &testutils.MockNamespaceInterface{
		IsClusterMonitoringNamespaceFunc: func(_ string) bool { return true },
	}

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name: "platform-rule", Namespace: "openshift-monitoring",
			OwnerReferences: []metav1.OwnerReference{
				{APIVersion: "apps/v1", Kind: "Deployment", Name: "test-operator", UID: "test-uid"},
			},
		},
	}
	ruleManagedBy, relabelManagedBy := k8s.DetermineManagedBy(ctx, mockARC, mockNS, promRule, grTestRuleId)
	ruleWithLabel := buildRuleWithManagedBy(grTestRule, grTestRuleId, promRule.Name, promRule.Namespace, ruleManagedBy, relabelManagedBy)

	client, mockK8s := newGetRuleClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == grTestRuleId {
					return ruleWithLabel, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	rule, err := client.GetRuleById(context.Background(), grTestRuleId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rule.Labels[managementlabels.RuleManagedByLabel] != "operator" {
		t.Errorf("expected managed_by=operator, got %q", rule.Labels[managementlabels.RuleManagedByLabel])
	}
	if _, ok := rule.Labels[managementlabels.RelabelConfigManagedByLabel]; ok {
		t.Error("expected no relabel_config_managed_by label when ARC not GitOps-managed")
	}
}
