package management_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

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
	// originalUserRule is as stored in the PrometheusRule (without k8s labels).
	originalUserRule = monitoringv1.Rule{
		Alert: "UserAlert",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity": "warning",
		},
	}
	originalUserRuleId = alertrule.GetAlertingRuleId(&originalUserRule)

	// userRule is as seen by RelabeledRules (with k8s labels added).
	udUserRule = monitoringv1.Rule{
		Alert: "UserAlert",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity":                       "warning",
			k8s.PrometheusRuleLabelNamespace: "user-namespace",
			k8s.PrometheusRuleLabelName:      "user-rule",
		},
	}

	udPlatformRule = monitoringv1.Rule{
		Alert: "PlatformAlert",
		Labels: map[string]string{
			k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
			k8s.PrometheusRuleLabelName:      "platform-rule",
		},
	}
	udPlatformRuleId = alertrule.GetAlertingRuleId(&udPlatformRule)
)

func newUpdateUserDefinedClient(t *testing.T) (management.Client, *testutils.MockClient) {
	t.Helper()
	mockK8s := &testutils.MockClient{}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool {
				return name == "openshift-monitoring"
			},
		}
	}
	return management.New(context.Background(), mockK8s), mockK8s
}

func mockUDRelabeledGet(ruleId string, rule monitoringv1.Rule) func() k8s.RelabeledRulesInterface {
	return func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == ruleId {
					return rule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
}

func makePRWithRule(ns, name string, rule monitoringv1.Rule) *testutils.MockPrometheusRuleInterface {
	return &testutils.MockPrometheusRuleInterface{
		GetFunc: func(_ context.Context, namespace, prName string) (*monitoringv1.PrometheusRule, bool, error) {
			return &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: prName},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{rule}}},
				},
			}, true, nil
		},
	}
}

// --- Managed-by enforcement ---

func TestUpdateUserDefinedAlertRule_BlocksGitOpsManaged(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	gitopsRule := copyRuleWithLabels(udUserRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByGitOps)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, gitopsRule)

	_, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, udUserRule)
	if err == nil || !strings.Contains(err.Error(), "managed by GitOps") {
		t.Errorf("expected GitOps block error, got: %v", err)
	}
}

func TestUpdateUserDefinedAlertRule_BlocksOperatorManaged(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	opRule := copyRuleWithLabels(udUserRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByOperator)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, opRule)

	_, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, udUserRule)
	if err == nil || !strings.Contains(err.Error(), "managed by an operator") {
		t.Errorf("expected operator block error, got: %v", err)
	}
}

// --- Not found ---

func TestUpdateUserDefinedAlertRule_NotFound(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, _ string) (monitoringv1.Rule, bool) { return monitoringv1.Rule{}, false },
		}
	}

	_, err := client.UpdateUserDefinedAlertRule(context.Background(), "nonexistent-id", udUserRule)
	var nf *management.NotFoundError
	if !errors.As(err, &nf) || nf.Resource != "AlertRule" {
		t.Errorf("expected NotFoundError for AlertRule, got: %v", err)
	}
}

func TestUpdateUserDefinedAlertRule_PlatformRuleReturnsError(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(udPlatformRuleId, udPlatformRule)

	_, err := client.UpdateUserDefinedAlertRule(context.Background(), udPlatformRuleId, udPlatformRule)
	if err == nil || !strings.Contains(err.Error(), "cannot update alert rule in a platform-managed PrometheusRule") {
		t.Errorf("expected platform rule error, got: %v", err)
	}
}

// --- PrometheusRule errors ---

func TestUpdateUserDefinedAlertRule_PRNotFound(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, _, _ string) (*monitoringv1.PrometheusRule, bool, error) {
				return nil, false, nil
			},
		}
	}

	_, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, udUserRule)
	var nf *management.NotFoundError
	if !errors.As(err, &nf) || nf.Resource != "PrometheusRule" {
		t.Errorf("expected NotFoundError for PrometheusRule, got: %v", err)
	}
}

func TestUpdateUserDefinedAlertRule_PRGetError(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, _, _ string) (*monitoringv1.PrometheusRule, bool, error) {
				return nil, false, errors.New("failed to get PrometheusRule")
			},
		}
	}

	_, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, udUserRule)
	if err == nil || !strings.Contains(err.Error(), "failed to get PrometheusRule") {
		t.Errorf("expected PR get error, got: %v", err)
	}
}

func TestUpdateUserDefinedAlertRule_RuleNotInPR(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{}}},
					},
				}, true, nil
			},
		}
	}

	_, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, udUserRule)
	if err == nil || !strings.Contains(err.Error(), fmt.Sprintf("AlertRule with id %s not found", originalUserRuleId)) {
		t.Errorf("expected 'not found in PR' error, got: %v", err)
	}
}

func TestUpdateUserDefinedAlertRule_PRUpdateError(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	pr := makePRWithRule("user-namespace", "user-rule", originalUserRule)
	pr.UpdateFunc = func(_ context.Context, _ monitoringv1.PrometheusRule) error {
		return errors.New("failed to update PrometheusRule")
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return pr }

	_, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, originalUserRule)
	if err == nil || !strings.Contains(err.Error(), "failed to update PrometheusRule") {
		t.Errorf("expected PR update error, got: %v", err)
	}
}

// --- Successful updates ---

func TestUpdateUserDefinedAlertRule_UpdatesRule(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)

	var savedPR *monitoringv1.PrometheusRule
	pr := makePRWithRule("user-namespace", "user-rule", originalUserRule)
	pr.UpdateFunc = func(_ context.Context, p monitoringv1.PrometheusRule) error {
		savedPR = &p
		return nil
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return pr }

	updatedRule := copyRule(originalUserRule)
	updatedRule.Labels["severity"] = "critical"
	updatedRule.Expr = intstr.FromString("up == 1")
	expectedId := alertrule.GetAlertingRuleId(&updatedRule)

	newId, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if newId != expectedId {
		t.Errorf("expected newId %q, got %q", expectedId, newId)
	}
	if savedPR == nil {
		t.Fatal("expected PR to be updated")
	}
	if savedPR.Spec.Groups[0].Rules[0].Labels["severity"] != "critical" {
		t.Errorf("expected severity=critical in saved PR")
	}
}

func TestUpdateUserDefinedAlertRule_RuleIdChanges(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)

	var savedPR *monitoringv1.PrometheusRule
	pr := makePRWithRule("user-namespace", "user-rule", originalUserRule)
	pr.UpdateFunc = func(_ context.Context, p monitoringv1.PrometheusRule) error { savedPR = &p; return nil }
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return pr }

	updatedRule := copyRule(originalUserRule)
	updatedRule.Labels["severity"] = "critical"
	updatedRule.Expr = intstr.FromString("up == 1")
	expectedId := alertrule.GetAlertingRuleId(&updatedRule)

	newId, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if newId == originalUserRuleId {
		t.Error("expected new ID to differ from original")
	}
	if newId != expectedId {
		t.Errorf("expected new ID %q, got %q", expectedId, newId)
	}
	if savedPR == nil {
		t.Fatal("expected PR to be saved")
	}
}

func TestUpdateUserDefinedAlertRule_OnlyMatchingRuleUpdated(t *testing.T) {
	anotherRule := monitoringv1.Rule{Alert: "AnotherAlert", Expr: intstr.FromString("down == 1")}

	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)

	var savedPR *monitoringv1.PrometheusRule
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{originalUserRule, anotherRule}}},
					},
				}, true, nil
			},
			UpdateFunc: func(_ context.Context, p monitoringv1.PrometheusRule) error { savedPR = &p; return nil },
		}
	}

	updatedRule := copyRule(originalUserRule)
	updatedRule.Labels["severity"] = "info"
	expectedId := alertrule.GetAlertingRuleId(&updatedRule)

	newId, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if newId != expectedId {
		t.Errorf("expected %q, got %q", expectedId, newId)
	}
	if len(savedPR.Spec.Groups[0].Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(savedPR.Spec.Groups[0].Rules))
	}
	if savedPR.Spec.Groups[0].Rules[0].Labels["severity"] != "info" {
		t.Error("expected severity=info on first rule")
	}
	if savedPR.Spec.Groups[0].Rules[1].Alert != "AnotherAlert" {
		t.Error("expected second rule to be AnotherAlert")
	}
}

func TestUpdateUserDefinedAlertRule_MultipleGroups(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)

	var savedPR *monitoringv1.PrometheusRule
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{
							{Name: "group1", Rules: []monitoringv1.Rule{}},
							{Name: "group2", Rules: []monitoringv1.Rule{originalUserRule}},
						},
					},
				}, true, nil
			},
			UpdateFunc: func(_ context.Context, p monitoringv1.PrometheusRule) error { savedPR = &p; return nil },
		}
	}

	updatedRule := copyRule(originalUserRule)
	updatedRule.Labels["new_label"] = "new_value"
	expectedId := alertrule.GetAlertingRuleId(&updatedRule)

	newId, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if newId != expectedId {
		t.Errorf("expected %q, got %q", expectedId, newId)
	}
	if len(savedPR.Spec.Groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(savedPR.Spec.Groups))
	}
	if len(savedPR.Spec.Groups[0].Rules) != 0 {
		t.Error("expected group1 to remain empty")
	}
	if len(savedPR.Spec.Groups[1].Rules) != 1 {
		t.Error("expected group2 to have 1 rule")
	}
	if savedPR.Spec.Groups[1].Rules[0].Labels["new_label"] != "new_value" {
		t.Error("expected new_label in group2 rule")
	}
}

// --- Severity validation ---

func TestUpdateUserDefinedAlertRule_InvalidSeverity(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	pr := makePRWithRule("user-namespace", "user-rule", originalUserRule)
	pr.UpdateFunc = func(_ context.Context, _ monitoringv1.PrometheusRule) error { return nil }
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return pr }

	updatedRule := copyRule(originalUserRule)
	updatedRule.Labels = map[string]string{"severity": "urgent"}
	_, err := client.UpdateUserDefinedAlertRule(context.Background(), originalUserRuleId, updatedRule)
	if err == nil || !strings.Contains(err.Error(), "invalid severity") {
		t.Errorf("expected invalid severity error, got: %v", err)
	}
}

// --- Helpers ---

func copyRule(r monitoringv1.Rule) monitoringv1.Rule {
	out := r
	out.Labels = make(map[string]string)
	for k, v := range r.Labels {
		out.Labels[k] = v
	}
	return out
}

func copyRuleWithLabels(r monitoringv1.Rule, extraKey, extraVal string) monitoringv1.Rule {
	out := copyRule(r)
	out.Labels[extraKey] = extraVal
	return out
}
