package management_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var (
	deleteUserRule1 = monitoringv1.Rule{
		Alert: "UserAlert1",
		Labels: map[string]string{
			k8s.PrometheusRuleLabelNamespace: "user-namespace",
			k8s.PrometheusRuleLabelName:      "user-rule",
		},
	}
	deleteUserRule1Id = alertrule.GetAlertingRuleId(&deleteUserRule1)

	deleteUserRule2 = monitoringv1.Rule{
		Alert: "UserAlert2",
		Labels: map[string]string{
			k8s.PrometheusRuleLabelNamespace: "user-namespace",
			k8s.PrometheusRuleLabelName:      "user-rule",
		},
	}

	deletePlatformRule = monitoringv1.Rule{
		Alert: "PlatformAlert",
		Labels: map[string]string{
			k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
			k8s.PrometheusRuleLabelName:      "platform-rule",
		},
	}
	deletePlatformRuleId = alertrule.GetAlertingRuleId(&deletePlatformRule)
)

func newDeleteClient(mockK8s *testutils.MockClient) management.Client {
	return management.New(context.Background(), mockK8s)
}

func TestDeleteUserDefinedAlertRuleById_NotFoundInRelabeledRules(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, _ string) (monitoringv1.Rule, bool) {
				return monitoringv1.Rule{}, false
			},
		}
	}
	client := newDeleteClient(mockK8s)

	err := client.DeleteUserDefinedAlertRuleById(context.Background(), "nonexistent-id")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var notFoundErr *management.NotFoundError
	if !errors.As(err, &notFoundErr) {
		t.Fatalf("expected NotFoundError, got %T: %v", err, err)
	}
	if notFoundErr.Resource != "AlertRule" {
		t.Errorf("expected Resource='AlertRule', got %q", notFoundErr.Resource)
	}
	if notFoundErr.Id != "nonexistent-id" {
		t.Errorf("expected Id='nonexistent-id', got %q", notFoundErr.Id)
	}
}

func TestDeleteUserDefinedAlertRuleById_PlatformRuleNotOperatorManaged(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deletePlatformRuleId {
					return deletePlatformRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool {
				return name == "openshift-monitoring"
			},
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{deletePlatformRule}}},
					},
				}, true, nil
			},
		}
	}
	mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
		return &testutils.MockAlertingRuleInterface{
			GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
				if name == "platform-alert-rules" {
					return &osmv1.AlertingRule{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "platform-alert-rules",
							Namespace: k8s.ClusterMonitoringNamespace,
						},
						Spec: osmv1.AlertingRuleSpec{
							Groups: []osmv1.RuleGroup{
								{Name: "test-group", Rules: []osmv1.Rule{{Alert: deletePlatformRule.Alert}}},
							},
						},
					}, true, nil
				}
				return nil, false, nil
			},
			UpdateFunc: func(_ context.Context, _ osmv1.AlertingRule) error { return nil },
		}
	}

	if err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deletePlatformRuleId); err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
}

func TestDeleteUserDefinedAlertRuleById_PlatformRuleGitOpsManaged(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deletePlatformRuleId {
					return deletePlatformRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool { return name == "openshift-monitoring" },
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "grp", Rules: []monitoringv1.Rule{deletePlatformRule}}},
					},
				}, true, nil
			},
		}
	}
	mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
		return &testutils.MockAlertingRuleInterface{
			GetFunc: func(_ context.Context, _ string) (*osmv1.AlertingRule, bool, error) {
				return &osmv1.AlertingRule{
					ObjectMeta: metav1.ObjectMeta{
						Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "gitops"},
					},
					Spec: osmv1.AlertingRuleSpec{
						Groups: []osmv1.RuleGroup{{Name: "grp", Rules: []osmv1.Rule{{Alert: deletePlatformRule.Alert}}}},
					},
				}, true, nil
			},
		}
	}

	err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deletePlatformRuleId)
	if err == nil {
		t.Fatal("expected error for GitOps-managed rule")
	}
	if !errors.As(err, new(*management.NotAllowedError)) {
		t.Errorf("expected NotAllowedError, got %T: %v", err, err)
	}
}

func TestDeleteUserDefinedAlertRuleById_PlatformRuleOperatorManaged(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deletePlatformRuleId {
					return deletePlatformRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool { return name == "openshift-monitoring" },
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "grp", Rules: []monitoringv1.Rule{deletePlatformRule}}},
					},
				}, true, nil
			},
		}
	}
	controller := true
	mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
		return &testutils.MockAlertingRuleInterface{
			GetFunc: func(_ context.Context, _ string) (*osmv1.AlertingRule, bool, error) {
				return &osmv1.AlertingRule{
					ObjectMeta: metav1.ObjectMeta{
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "SomeOperatorKind", Name: "operator", Controller: &controller},
						},
					},
					Spec: osmv1.AlertingRuleSpec{
						Groups: []osmv1.RuleGroup{{Name: "grp", Rules: []osmv1.Rule{{Alert: deletePlatformRule.Alert}}}},
					},
				}, true, nil
			},
		}
	}

	err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deletePlatformRuleId)
	if err == nil {
		t.Fatal("expected error for operator-managed rule")
	}
	if !errors.As(err, new(*management.NotAllowedError)) {
		t.Errorf("expected NotAllowedError, got %T: %v", err, err)
	}
}

func TestDeleteUserDefinedAlertRuleById_PrometheusRuleNotFound(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deleteUserRule1Id {
					return deleteUserRule1, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(_ string) bool { return false },
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, _, _ string) (*monitoringv1.PrometheusRule, bool, error) {
				return nil, false, nil
			},
		}
	}

	err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deleteUserRule1Id)
	if err == nil {
		t.Fatal("expected error")
	}
	var notFoundErr *management.NotFoundError
	if !errors.As(err, &notFoundErr) {
		t.Fatalf("expected NotFoundError, got %T: %v", err, err)
	}
	if notFoundErr.Resource != "PrometheusRule" {
		t.Errorf("expected Resource='PrometheusRule', got %q", notFoundErr.Resource)
	}
}

func TestDeleteUserDefinedAlertRuleById_PrometheusRuleGetError(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deleteUserRule1Id {
					return deleteUserRule1, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(_ string) bool { return false },
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, _, _ string) (*monitoringv1.PrometheusRule, bool, error) {
				return nil, false, errors.New("failed to get PrometheusRule")
			},
		}
	}

	err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deleteUserRule1Id)
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "failed to get PrometheusRule") {
		t.Errorf("expected 'failed to get PrometheusRule' in error, got: %v", err)
	}
}

func TestDeleteUserDefinedAlertRuleById_RuleNotInPrometheusRule(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deleteUserRule1Id {
					return deleteUserRule1, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(_ string) bool { return false },
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{deleteUserRule2}}},
					},
				}, true, nil
			},
		}
	}

	err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deleteUserRule1Id)
	if err == nil {
		t.Fatal("expected NotFoundError")
	}
	var notFoundErr *management.NotFoundError
	if !errors.As(err, &notFoundErr) {
		t.Fatalf("expected NotFoundError, got %T: %v", err, err)
	}
	if notFoundErr.Id != deleteUserRule1Id {
		t.Errorf("expected Id=%q, got %q", deleteUserRule1Id, notFoundErr.Id)
	}
}

func TestDeleteUserDefinedAlertRuleById_DeletesEntirePrometheusRule(t *testing.T) {
	var deleteCalled bool
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deleteUserRule1Id {
					return deleteUserRule1, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(_ string) bool { return false },
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{deleteUserRule1}}},
					},
				}, true, nil
			},
			DeleteFunc: func(_ context.Context, _, _ string) error {
				deleteCalled = true
				return nil
			},
		}
	}

	if err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deleteUserRule1Id); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !deleteCalled {
		t.Error("expected PrometheusRule.Delete to be called")
	}
}

func TestDeleteUserDefinedAlertRuleById_UpdatesRemainingRules(t *testing.T) {
	var updatedPR *monitoringv1.PrometheusRule
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deleteUserRule1Id {
					return deleteUserRule1, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(_ string) bool { return false },
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{deleteUserRule1, deleteUserRule2}}},
					},
				}, true, nil
			},
			UpdateFunc: func(_ context.Context, pr monitoringv1.PrometheusRule) error {
				updatedPR = &pr
				return nil
			},
		}
	}

	if err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deleteUserRule1Id); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedPR == nil {
		t.Fatal("expected PrometheusRule.Update to be called")
	}
	if len(updatedPR.Spec.Groups) != 1 || len(updatedPR.Spec.Groups[0].Rules) != 1 {
		t.Errorf("expected 1 group with 1 rule, got groups=%v", updatedPR.Spec.Groups)
	}
	if updatedPR.Spec.Groups[0].Rules[0].Alert != "UserAlert2" {
		t.Errorf("expected remaining rule to be UserAlert2, got %q", updatedPR.Spec.Groups[0].Rules[0].Alert)
	}
}

func TestDeleteUserDefinedAlertRuleById_RemovesEmptyGroup(t *testing.T) {
	anotherRule := monitoringv1.Rule{
		Alert: "AnotherAlert",
		Labels: map[string]string{
			k8s.PrometheusRuleLabelNamespace: "user-namespace",
			k8s.PrometheusRuleLabelName:      "user-rule",
		},
	}

	var updatedPR *monitoringv1.PrometheusRule
	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == deleteUserRule1Id {
					return deleteUserRule1, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(_ string) bool { return false },
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{
							{Name: "group-to-be-empty", Rules: []monitoringv1.Rule{deleteUserRule1}},
							{Name: "group-with-rules", Rules: []monitoringv1.Rule{anotherRule}},
						},
					},
				}, true, nil
			},
			UpdateFunc: func(_ context.Context, pr monitoringv1.PrometheusRule) error {
				updatedPR = &pr
				return nil
			},
		}
	}

	if err := newDeleteClient(mockK8s).DeleteUserDefinedAlertRuleById(context.Background(), deleteUserRule1Id); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(updatedPR.Spec.Groups) != 1 || updatedPR.Spec.Groups[0].Name != "group-with-rules" {
		t.Errorf("expected only 'group-with-rules' to remain, got %v", updatedPR.Spec.Groups)
	}
}
