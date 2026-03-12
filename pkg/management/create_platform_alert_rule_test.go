package management_test

import (
	"context"
	"errors"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

func newPlatformBaseRule() monitoringv1.Rule {
	return monitoringv1.Rule{
		Alert: "PlatformAlert",
		Expr:  intstr.FromString("up == 0"),
		For:   (*monitoringv1.Duration)(stringPtr("5m")),
		Labels: map[string]string{
			"severity": "warning",
		},
		Annotations: map[string]string{
			"summary": "platform alert",
		},
	}
}

func TestCreatePlatformAlertRule_EmptyAlertName(t *testing.T) {
	rule := newPlatformBaseRule()
	rule.Alert = " "
	mockK8s := &testutils.MockClient{}
	client := management.New(context.Background(), mockK8s)

	_, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err == nil || !containsString(err.Error(), "alert name is required") {
		t.Fatalf("expected 'alert name is required', got %v", err)
	}
}

func TestCreatePlatformAlertRule_EmptyExpr(t *testing.T) {
	rule := newPlatformBaseRule()
	rule.Expr = intstr.FromString(" ")
	mockK8s := &testutils.MockClient{}
	client := management.New(context.Background(), mockK8s)

	_, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err == nil || !containsString(err.Error(), "expr is required") {
		t.Fatalf("expected 'expr is required', got %v", err)
	}
}

func TestCreatePlatformAlertRule_InvalidSeverity(t *testing.T) {
	rule := newPlatformBaseRule()
	rule.Labels = map[string]string{"severity": "fatal"}
	mockK8s := &testutils.MockClient{}
	client := management.New(context.Background(), mockK8s)

	_, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err == nil || !containsString(err.Error(), "invalid severity") {
		t.Fatalf("expected 'invalid severity', got %v", err)
	}
}

func TestCreatePlatformAlertRule_DuplicateRuleId(t *testing.T) {
	rule := newPlatformBaseRule()
	ruleID := alertrule.GetAlertingRuleId(&rule)

	mockK8s := &testutils.MockClient{
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					if id == ruleID {
						return rule, true
					}
					return monitoringv1.Rule{}, false
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	_, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err == nil || !containsString(err.Error(), "exact config already exists") {
		t.Fatalf("expected conflict error, got %v", err)
	}
}

func TestCreatePlatformAlertRule_GitOpsManaged(t *testing.T) {
	rule := newPlatformBaseRule()
	mockK8s := &testutils.MockClient{
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		AlertingRulesFunc: func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
					return &osmv1.AlertingRule{
						ObjectMeta: metav1.ObjectMeta{
							Name:        name,
							Namespace:   k8s.ClusterMonitoringNamespace,
							Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "abc"},
						},
					}, true, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	_, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err == nil || !containsString(err.Error(), "managed by GitOps") {
		t.Fatalf("expected GitOps error, got %v", err)
	}
}

func TestCreatePlatformAlertRule_UpdateExisting(t *testing.T) {
	rule := newPlatformBaseRule()
	var updated osmv1.AlertingRule

	mockK8s := &testutils.MockClient{
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		AlertingRulesFunc: func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
					return &osmv1.AlertingRule{
						ObjectMeta: metav1.ObjectMeta{
							Name:      name,
							Namespace: k8s.ClusterMonitoringNamespace,
						},
						Spec: osmv1.AlertingRuleSpec{
							Groups: []osmv1.RuleGroup{
								{
									Name: "platform-alert-rules",
									Rules: []osmv1.Rule{
										{Alert: "ExistingAlert", Expr: intstr.FromString("vector(1)")},
									},
								},
							},
						},
					}, true, nil
				},
				UpdateFunc: func(_ context.Context, ar osmv1.AlertingRule) error {
					updated = ar
					return nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	ruleID, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ruleID != alertrule.GetAlertingRuleId(&rule) {
		t.Errorf("wrong ruleID: %q", ruleID)
	}
	if updated.Name != "platform-alert-rules" {
		t.Errorf("wrong AlertingRule name: %q", updated.Name)
	}
	if len(updated.Spec.Groups) != 1 || len(updated.Spec.Groups[0].Rules) != 2 {
		t.Errorf("expected 1 group with 2 rules, got %v", updated.Spec.Groups)
	}
	if _, ok := updated.Spec.Groups[0].Rules[1].Labels[k8s.AlertRuleLabelId]; !ok {
		t.Error("expected AlertRuleLabelId on new rule")
	}
}

func TestCreatePlatformAlertRule_ConflictAlertName(t *testing.T) {
	rule := newPlatformBaseRule()
	mockK8s := &testutils.MockClient{
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		AlertingRulesFunc: func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
					return &osmv1.AlertingRule{
						ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: k8s.ClusterMonitoringNamespace},
						Spec: osmv1.AlertingRuleSpec{
							Groups: []osmv1.RuleGroup{
								{
									Name: "platform-alert-rules",
									Rules: []osmv1.Rule{
										{Alert: "PlatformAlert", Expr: intstr.FromString("vector(1)")},
									},
								},
							},
						},
					}, true, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	_, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err == nil || !containsString(err.Error(), "already exists in group") {
		t.Fatalf("expected conflict error, got %v", err)
	}
}

func TestCreatePlatformAlertRule_CreateNew(t *testing.T) {
	rule := newPlatformBaseRule()
	var created osmv1.AlertingRule

	mockK8s := &testutils.MockClient{
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		AlertingRulesFunc: func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
					return nil, false, nil
				},
				CreateFunc: func(_ context.Context, ar osmv1.AlertingRule) (*osmv1.AlertingRule, error) {
					created = ar
					return &ar, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	_, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if created.Name != "platform-alert-rules" {
		t.Errorf("wrong name: %q", created.Name)
	}
	if created.Namespace != k8s.ClusterMonitoringNamespace {
		t.Errorf("wrong namespace: %q", created.Namespace)
	}
	if len(created.Spec.Groups) != 1 || len(created.Spec.Groups[0].Rules) != 1 {
		t.Errorf("unexpected groups: %v", created.Spec.Groups)
	}
	if _, ok := created.Spec.Groups[0].Rules[0].Labels[k8s.AlertRuleLabelId]; !ok {
		t.Error("expected AlertRuleLabelId on created rule")
	}
}

func TestCreatePlatformAlertRule_GetFails(t *testing.T) {
	rule := newPlatformBaseRule()
	mockK8s := &testutils.MockClient{
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		AlertingRulesFunc: func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
					return nil, false, errors.New("get failed")
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	_, err := client.CreatePlatformAlertRule(context.Background(), rule)
	if err == nil || !containsString(err.Error(), "failed to get AlertingRule") || !containsString(err.Error(), "get failed") {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}
