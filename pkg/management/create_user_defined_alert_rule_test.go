package management_test

import (
	"context"
	"errors"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var testRule = monitoringv1.Rule{
	Alert: "TestAlert",
	Expr:  intstr.FromString("up == 0"),
	For:   (*monitoringv1.Duration)(stringPtr("5m")),
	Labels: map[string]string{
		"severity": "warning",
	},
	Annotations: map[string]string{
		"summary": "Test alert",
	},
}

func stringPtr(s string) *string { return &s }

func containsString(s, sub string) bool {
	if len(sub) == 0 {
		return true
	}
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func TestCreateUserDefinedAlertRule_GitOpsManaged(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				GetFunc: func(_ context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
					return &monitoringv1.PrometheusRule{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:   namespace,
							Name:        name,
							Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "abc"},
						},
					}, true, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-pr", Namespace: "user-ns"})
	if err == nil || !containsString(err.Error(), "This PrometheusRule is managed by GitOps; create the alert in Git.") {
		t.Fatalf("expected GitOps error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_OperatorManaged(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				GetFunc: func(_ context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
					return &monitoringv1.PrometheusRule{
						ObjectMeta: metav1.ObjectMeta{
							Namespace: namespace,
							Name:      name,
							OwnerReferences: []metav1.OwnerReference{
								{Kind: "Deployment", Name: "some-operator"},
							},
						},
					}, true, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-pr", Namespace: "user-ns"})
	if err == nil || !containsString(err.Error(), "This PrometheusRule is managed by an operator; you cannot add alerts to it.") {
		t.Fatalf("expected operator-managed error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_MissingName(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Namespace: "test-namespace"})
	if err == nil || !containsString(err.Error(), "PrometheusRule Name and Namespace must be specified") {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_MissingNamespace(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "test-rule"})
	if err == nil || !containsString(err.Error(), "PrometheusRule Name and Namespace must be specified") {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_EmptyAlertName(t *testing.T) {
	rule := testRule
	rule.Alert = " "
	mockK8s := &testutils.MockClient{}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), rule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err == nil || !containsString(err.Error(), "alert name is required") {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_EmptyExpr(t *testing.T) {
	rule := testRule
	rule.Expr = intstr.FromString(" ")
	mockK8s := &testutils.MockClient{}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), rule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err == nil || !containsString(err.Error(), "expr is required") {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_InvalidSeverity(t *testing.T) {
	rule := testRule
	rule.Labels = map[string]string{"severity": "fatal"}
	mockK8s := &testutils.MockClient{}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), rule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err == nil || !containsString(err.Error(), "invalid severity") {
		t.Fatalf("expected severity error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_PlatformManagedNamespace(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool {
					return name == "openshift-monitoring"
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "platform-rule", Namespace: "openshift-monitoring"})
	if err == nil || !containsString(err.Error(), "cannot add user-defined alert rule to a platform-managed PrometheusRule") {
		t.Fatalf("expected platform error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_DuplicateRuleId(t *testing.T) {
	ruleId := alertrule.GetAlertingRuleId(&testRule)
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					if id == ruleId {
						return testRule, true
					}
					return monitoringv1.Rule{}, false
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err == nil || !containsString(err.Error(), "alert rule with exact config already exists") {
		t.Fatalf("expected conflict error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_AddRuleFails(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				AddRuleFunc: func(_ context.Context, _ types.NamespacedName, _ string, _ monitoringv1.Rule) error {
					return errors.New("failed to add rule")
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err == nil || !containsString(err.Error(), "failed to add rule") {
		t.Fatalf("expected add rule error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_Success(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				AddRuleFunc: func(_ context.Context, _ types.NamespacedName, _ string, _ monitoringv1.Rule) error {
					return nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	ruleId, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ruleId == "" || ruleId != alertrule.GetAlertingRuleId(&testRule) {
		t.Errorf("unexpected ruleId: %q", ruleId)
	}
}

func TestCreateUserDefinedAlertRule_DefaultGroupName(t *testing.T) {
	var capturedGroupName string
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				AddRuleFunc: func(_ context.Context, _ types.NamespacedName, groupName string, _ monitoringv1.Rule) error {
					capturedGroupName = groupName
					return nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedGroupName != "user-defined-rules" {
		t.Errorf("expected 'user-defined-rules', got %q", capturedGroupName)
	}
}

func TestCreateUserDefinedAlertRule_CustomGroupName(t *testing.T) {
	var capturedGroupName string
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				AddRuleFunc: func(_ context.Context, _ types.NamespacedName, groupName string, _ monitoringv1.Rule) error {
					capturedGroupName = groupName
					return nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace", GroupName: "custom-group"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedGroupName != "custom-group" {
		t.Errorf("expected 'custom-group', got %q", capturedGroupName)
	}
}

func TestCreateUserDefinedAlertRule_EquivalentSpecDenied(t *testing.T) {
	existing := monitoringv1.Rule{}
	testRule.DeepCopyInto(&existing)
	existing.Alert = "OtherName"

	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{existing}
				},
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)
	_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err == nil || !containsString(err.Error(), "equivalent spec already exists") {
		t.Fatalf("expected equivalent spec error, got %v", err)
	}
}
