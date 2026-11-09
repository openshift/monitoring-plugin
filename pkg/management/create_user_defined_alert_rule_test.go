package management_test

import (
	"context"
	"errors"
	"strings"
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

func TestCreateUserDefinedAlertRule_MixedCaseSeverity(t *testing.T) {
	cases := []string{"Critical", "WARNING", "Info", "NONE", "Warning"}
	for _, sev := range cases {
		t.Run(sev, func(t *testing.T) {
			rule := testRule
			rule.Labels = map[string]string{"severity": sev}

			mockK8s := &testutils.MockClient{
				NamespaceFunc: func() k8s.NamespaceInterface {
					return &testutils.MockNamespaceInterface{
						IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
					}
				},
				RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{
						GetFunc: func(_ context.Context, _ string) (monitoringv1.Rule, bool) {
							return monitoringv1.Rule{}, false
						},
					}
				},
				PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
					return &testutils.MockPrometheusRuleInterface{
						GetFunc: func(_ context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
							return nil, false, nil
						},
						AddRuleFunc: func(_ context.Context, _ types.NamespacedName, _ string, _ monitoringv1.Rule, _ func(*monitoringv1.PrometheusRule) error) error {
							return nil
						},
					}
				},
			}
			client := management.New(context.Background(), mockK8s)
			_, err := client.CreateUserDefinedAlertRule(context.Background(), rule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-ns"})
			if err != nil {
				t.Fatalf("severity %q should be accepted, got error: %v", sev, err)
			}
		})
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
				AddRuleFunc: func(_ context.Context, _ types.NamespacedName, _ string, _ monitoringv1.Rule, _ func(*monitoringv1.PrometheusRule) error) error {
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
				AddRuleFunc: func(_ context.Context, _ types.NamespacedName, _ string, _ monitoringv1.Rule, _ func(*monitoringv1.PrometheusRule) error) error {
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
				AddRuleFunc: func(_ context.Context, _ types.NamespacedName, groupName string, _ monitoringv1.Rule, _ func(*monitoringv1.PrometheusRule) error) error {
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
				AddRuleFunc: func(_ context.Context, _ types.NamespacedName, groupName string, _ monitoringv1.Rule, _ func(*monitoringv1.PrometheusRule) error) error {
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
	// The relabeled rule must identify its source PrometheusRule, and the
	// caller must be able to read that PrometheusRule, for the duplicate to
	// be reported.
	existing.Labels = map[string]string{
		"severity":                       "warning",
		k8s.PrometheusRuleLabelNamespace: "user-namespace",
		k8s.PrometheusRuleLabelName:      "user-rule",
	}
	sourcePR := monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{Name: "user-rule", Namespace: "user-namespace"},
	}

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
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
					if namespace != "user-namespace" || name != "user-rule" {
						return nil, false, nil
					}
					return sourcePR.DeepCopy(), true, nil
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

func TestCreateUserDefinedAlertRule_KeepFiringForDistinguishesSpec(t *testing.T) {
	keepFiringFor := func(d monitoringv1.NonEmptyDuration) *monitoringv1.NonEmptyDuration { return &d }

	// The existing rule differs from testRule only in KeepFiringFor.
	existing := monitoringv1.Rule{}
	testRule.DeepCopyInto(&existing)
	existing.Alert = "OtherName"
	existing.KeepFiringFor = keepFiringFor("5m")
	existing.Labels = map[string]string{
		"severity":                       "warning",
		k8s.PrometheusRuleLabelNamespace: "user-namespace",
		k8s.PrometheusRuleLabelName:      "user-rule",
	}
	sourcePR := monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{Name: "user-rule", Namespace: "user-namespace"},
	}

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
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
					if namespace != "user-namespace" || name != "user-rule" {
						return nil, false, nil
					}
					return sourcePR.DeepCopy(), true, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	// A differing KeepFiringFor means the specs are not equivalent, so the
	// create must proceed instead of being denied as a duplicate.
	if _, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"}); err != nil {
		t.Fatalf("expected create with differing KeepFiringFor to proceed, got %v", err)
	}

	// The same KeepFiringFor must still be reported as an equivalent spec.
	sameSpec := *testRule.DeepCopy()
	sameSpec.KeepFiringFor = keepFiringFor("5m")
	_, err := client.CreateUserDefinedAlertRule(context.Background(), sameSpec, management.PrometheusRuleOptions{Name: "user-rule", Namespace: "user-namespace"})
	if err == nil || !containsString(err.Error(), "equivalent spec already exists") {
		t.Fatalf("expected equivalent spec error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_RejectsInvalidLabelName(t *testing.T) {
	rule := *testRule.DeepCopy()
	rule.Labels["bad~name"] = "value"

	client := management.New(context.Background(), &testutils.MockClient{})
	_, err := client.CreateUserDefinedAlertRule(context.Background(), rule, management.PrometheusRuleOptions{
		Name: "user-rule", Namespace: "user-namespace",
	})
	var ve *management.ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected ValidationError, got %T: %v", err, err)
	}
	if !containsString(err.Error(), "invalid label name") {
		t.Fatalf("expected invalid label name error, got %v", err)
	}
}

func TestCreateUserDefinedAlertRule_AddRuleOwnershipGuard(t *testing.T) {
	cases := []struct {
		name       string
		gitOps     bool
		wantSubstr string
	}{
		{
			// Both external-management markers present: GitOps must take
			// precedence over the operator check.
			name:       "gitops_takes_precedence_over_operator",
			gitOps:     true,
			wantSubstr: "managed by GitOps",
		},
		{
			name:       "operator_managed",
			gitOps:     false,
			wantSubstr: "managed by an operator",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			managed := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{Name: "user-rule", Namespace: "user-ns"},
			}
			managed.OwnerReferences = []metav1.OwnerReference{{
				APIVersion: "apps/v1",
				Kind:       "Deployment",
				Name:       "owner",
				UID:        "uid",
			}}
			if tc.gitOps {
				managed.Annotations = map[string]string{"argocd.argoproj.io/tracking-id": "abc"}
			}

			prMock := &testutils.MockPrometheusRuleInterface{
				// Plan-time view: the PrometheusRule is readable and
				// unmanaged, so only the AddRule guard can catch the
				// externally managed object the mock storage holds.
				GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
					return &monitoringv1.PrometheusRule{
						ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					}, true, nil
				},
			}
			prMock.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"user-ns/user-rule": managed,
			})

			mockK8s := &testutils.MockClient{
				NamespaceFunc: func() k8s.NamespaceInterface {
					return &testutils.MockNamespaceInterface{
						IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
					}
				},
				RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{}
				},
				PrometheusRulesFunc: func() k8s.PrometheusRuleInterface { return prMock },
			}
			client := management.New(context.Background(), mockK8s)

			_, err := client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{
				Name: "user-rule", Namespace: "user-ns",
			})
			if err == nil {
				t.Fatal("expected ownership guard to reject the create")
			}
			var na *management.NotAllowedError
			if !errors.As(err, &na) {
				t.Fatalf("expected NotAllowedError, got %T: %v", err, err)
			}
			if !strings.Contains(err.Error(), tc.wantSubstr) {
				t.Fatalf("expected error containing %q, got %v", tc.wantSubstr, err)
			}
			if tc.gitOps && strings.Contains(err.Error(), "operator") {
				t.Fatalf("GitOps must take precedence over the operator marker, got %v", err)
			}
			if got := len(managed.Spec.Groups); got != 0 {
				t.Fatalf("expected no rule appended to the managed PrometheusRule, got %d groups", got)
			}
		})
	}
}

func TestAddRule_RollsBackFreshlyCreatedPrometheusRule(t *testing.T) {
	// Contract test mirroring the real client: when the ownership guard
	// rejects a PrometheusRule that AddRule itself created, the empty
	// resource must be rolled back so it cannot block subsequent retries.
	prMock := &testutils.MockPrometheusRuleInterface{}
	guardErr := errors.New("guard rejected")
	err := prMock.AddRule(
		context.Background(),
		types.NamespacedName{Namespace: "user-ns", Name: "user-rule"},
		"group", testRule,
		func(_ *monitoringv1.PrometheusRule) error { return guardErr },
	)
	if !errors.Is(err, guardErr) {
		t.Fatalf("expected guard error, got %v", err)
	}
	if len(prMock.PrometheusRules) != 0 {
		t.Fatalf("expected freshly created PrometheusRule to be rolled back, storage: %v", prMock.PrometheusRules)
	}

	// A PrometheusRule that already existed must survive a guard rejection.
	prMock = &testutils.MockPrometheusRuleInterface{}
	prMock.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
		"user-ns/user-rule": {ObjectMeta: metav1.ObjectMeta{Namespace: "user-ns", Name: "user-rule"}},
	})
	err = prMock.AddRule(
		context.Background(),
		types.NamespacedName{Namespace: "user-ns", Name: "user-rule"},
		"group", testRule,
		func(_ *monitoringv1.PrometheusRule) error { return guardErr },
	)
	if !errors.Is(err, guardErr) {
		t.Fatalf("expected guard error, got %v", err)
	}
	if len(prMock.PrometheusRules) != 1 {
		t.Fatalf("expected pre-existing PrometheusRule to be kept, storage: %v", prMock.PrometheusRules)
	}
}
