package management_test

import (
	"context"
	"strings"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func firstPreviewResource(t *testing.T, plan *management.RuleChangePlan) management.ResourceChangePlan {
	t.Helper()
	if len(plan.Resources) != 1 {
		t.Fatalf("expected one resource, got %d", len(plan.Resources))
	}
	return plan.Resources[0]
}

func findPreviewResource(plan *management.RuleChangePlan, kind string) (management.ResourceChangePlan, bool) {
	for _, res := range plan.Resources {
		if res.Resource.Kind == kind {
			return res, true
		}
	}
	return management.ResourceChangePlan{}, false
}

func TestPreviewCreateUserDefined_WritablePrometheusRule(t *testing.T) {
	mockRules := &testutils.MockPrometheusRuleInterface{
		AddRuleFunc: func(context.Context, types.NamespacedName, string, monitoringv1.Rule) error {
			t.Fatal("preview must not add a rule to PrometheusRule")
			return nil
		},
		UpdateFunc: func(context.Context, monitoringv1.PrometheusRule) error {
			t.Fatal("preview must not update PrometheusRule")
			return nil
		},
	}
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface { return mockRules },
	}
	client := management.New(context.Background(), mockK8s)

	plan, err := client.PreviewAlertRuleCreate(context.Background(), management.PreviewCreateRequest{
		AlertRule: testRule,
		PROptions: &management.PrometheusRuleOptions{Name: "user-pr", Namespace: "default"},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleCreate: %v", err)
	}
	if !plan.Writable {
		t.Fatal("expected writable=true")
	}
	res := firstPreviewResource(t, plan)
	if res.Resource.Kind != "PrometheusRule" || res.Resource.Name != "user-pr" {
		t.Fatalf("unexpected resource: %+v", res.Resource)
	}
	if len(res.Changes) != 1 || res.Changes[0].Operation != management.RuleChangeOpAdd {
		t.Fatalf("expected single add change, got %+v", res.Changes)
	}
	if res.Changes[0].Field != "rule" {
		t.Fatalf("expected field=rule, got %q", res.Changes[0].Field)
	}
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for PrometheusRule")
	}
	if plan.DesiredRule.Alert != testRule.Alert {
		t.Fatalf("expected desiredRule.alert=%q, got %q", testRule.Alert, plan.DesiredRule.Alert)
	}
	if plan.DesiredRule.Labels["severity"] != "warning" {
		t.Fatalf("expected desiredRule.labels.severity=warning, got %+v", plan.DesiredRule.Labels)
	}
}

func TestPreviewCreateUserDefined_GitOpsManaged(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
					return &monitoringv1.PrometheusRule{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:   namespace,
							Name:        name,
							Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "gitops"},
						},
					}, true, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	plan, err := client.PreviewAlertRuleCreate(context.Background(), management.PreviewCreateRequest{
		AlertRule: testRule,
		PROptions: &management.PrometheusRuleOptions{Name: "user-pr", Namespace: "default"},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleCreate: %v", err)
	}
	if plan.Writable {
		t.Fatal("expected writable=false for GitOps-managed PR")
	}
	if plan.ManagedBy == nil || *plan.ManagedBy != management.ManagedByGitOps {
		t.Fatalf("expected managedBy=gitops, got %+v", plan.ManagedBy)
	}
	res := firstPreviewResource(t, plan)
	if len(res.Changes) != 1 {
		t.Fatalf("expected preview changes, got %+v", res.Changes)
	}
	if plan.DesiredRule.Alert == "" {
		t.Fatal("expected populated desiredRule for create preview")
	}

	_, err = client.CreateUserDefinedAlertRule(context.Background(), testRule, management.PrometheusRuleOptions{Name: "user-pr", Namespace: "default"})
	if err == nil || !strings.Contains(err.Error(), "GitOps") {
		t.Fatalf("expected create to remain blocked, got %v", err)
	}
}

func TestPreviewCreateUserDefined_OperatorManaged(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
					return &monitoringv1.PrometheusRule{
						ObjectMeta: metav1.ObjectMeta{
							Namespace: namespace,
							Name:      name,
							OwnerReferences: []metav1.OwnerReference{
								{Kind: "Deployment", Name: "op"},
							},
						},
					}, true, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	plan, err := client.PreviewAlertRuleCreate(context.Background(), management.PreviewCreateRequest{
		AlertRule: testRule,
		PROptions: &management.PrometheusRuleOptions{Name: "user-pr", Namespace: "default"},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleCreate: %v", err)
	}
	if plan.Writable {
		t.Fatal("expected writable=false for operator-managed PR")
	}
	if plan.ManagedBy == nil || *plan.ManagedBy != management.ManagedByOperator {
		t.Fatalf("expected managedBy=operator, got %+v", plan.ManagedBy)
	}
}

func TestPreviewCreateUserDefined_InvalidRequest(t *testing.T) {
	client := management.New(context.Background(), &testutils.MockClient{})
	_, err := client.PreviewAlertRuleCreate(context.Background(), management.PreviewCreateRequest{
		AlertRule: testRule,
		PROptions: &management.PrometheusRuleOptions{Namespace: "default"},
	})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestPreviewUpdateUserDefined_WritableSeverityChange(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	pr := makePRWithRule("user-namespace", "user-rule", originalUserRule)
	var updateCalled bool
	pr.UpdateFunc = func(context.Context, monitoringv1.PrometheusRule) error {
		updateCalled = true
		return nil
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return pr }

	sev := "critical"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: originalUserRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	if !plan.Writable {
		t.Fatal("expected writable=true")
	}
	res := firstPreviewResource(t, plan)
	if len(res.Changes) != 1 {
		t.Fatalf("expected one change, got %+v", res.Changes)
	}
	if res.Changes[0].Operation != management.RuleChangeOpReplace {
		t.Fatalf("expected replace, got %q", res.Changes[0].Operation)
	}
	if res.Changes[0].Field != "labels.severity" {
		t.Fatalf("expected labels.severity field, got %q", res.Changes[0].Field)
	}
	if res.Changes[0].CurrentValue != "warning" || res.Changes[0].NewValue != "critical" {
		t.Fatalf("unexpected severity diff: %+v", res.Changes[0])
	}
	if res.Resource.Kind != "PrometheusRule" {
		t.Fatalf("expected PrometheusRule resource, got %q", res.Resource.Kind)
	}
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for PrometheusRule")
	}
	if plan.DesiredRule.Labels["severity"] != "critical" {
		t.Fatalf("expected desiredRule severity=critical, got %+v", plan.DesiredRule.Labels)
	}
	if updateCalled {
		t.Fatal("preview must not persist updates")
	}
}

func TestPreviewUpdateUserDefined_GitOpsManaged(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	gitopsRule := copyRuleWithLabels(udUserRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByGitOps)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, gitopsRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePRWithRule("user-namespace", "user-rule", originalUserRule)
	}

	sev := "critical"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: originalUserRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	if plan.Writable {
		t.Fatal("expected writable=false")
	}
	if plan.ManagedBy == nil || *plan.ManagedBy != management.ManagedByGitOps {
		t.Fatalf("expected managedBy=gitops, got %+v", plan.ManagedBy)
	}

	_, err = client.UpdateAlertRuleLabels(context.Background(), originalUserRuleId, map[string]*string{"severity": &sev})
	if err == nil || !strings.Contains(err.Error(), "GitOps") {
		t.Fatalf("expected update to remain blocked, got %v", err)
	}
}

func TestPreviewUpdateUserDefined_NoOp(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePRWithRule("user-namespace", "user-rule", originalUserRule)
	}

	sev := "warning"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: originalUserRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	res := firstPreviewResource(t, plan)
	if len(res.Changes) != 0 {
		t.Fatalf("expected no changes for no-op update, got %+v", res.Changes)
	}
}

func TestPreviewUpdateUserDefined_NotFound(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{}
	}
	_, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: "missing-id",
		Labels: map[string]*string{"severity": stringPtr("critical")},
	})
	if err == nil {
		t.Fatal("expected not found error")
	}
}

func setupPreviewPlatformMocks(t *testing.T, mockK8s *testutils.MockClient, withAlertingRule bool) {
	t.Helper()
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool {
				return name == "openshift-monitoring"
			},
		}
	}
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upPlatformRuleId, upPlatformRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePlatformPR("openshift-monitoring", "platform-rule", upOriginalPlatformRule)
	}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return nil, false, nil
			},
		}
	}
	if withAlertingRule {
		mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
					return &osmv1.AlertingRule{
						ObjectMeta: metav1.ObjectMeta{
							Name:      name,
							Namespace: k8s.ClusterMonitoringNamespace,
						},
						Spec: osmv1.AlertingRuleSpec{
							Groups: []osmv1.RuleGroup{{
								Name: "platform-alert-rules",
								Rules: []osmv1.Rule{{
									Alert:  upOriginalPlatformRule.Alert,
									Expr:   intstr.FromString(upOriginalPlatformRule.Expr.String()),
									Labels: copyStringMap(upOriginalPlatformRule.Labels),
								}},
							}},
						},
					}, true, nil
				},
			}
		}
	}
}

func TestPreviewUpdatePlatform_SeverityViaAlertRelabelConfig(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPreviewPlatformMocks(t, mockK8s, false)

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return nil, false, nil
			},
			CreateFunc: func(_ context.Context, _ osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
				t.Fatal("preview must not persist ARC changes")
				return nil, nil
			},
			UpdateFunc: func(_ context.Context, _ osmv1.AlertRelabelConfig) error {
				t.Fatal("preview must not persist ARC changes")
				return nil
			},
		}
	}

	sev := "info"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: upPlatformRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	res, ok := findPreviewResource(plan, "AlertRelabelConfig")
	if !ok {
		t.Fatalf("expected AlertRelabelConfig resource, got %+v", plan.Resources)
	}
	if len(res.Changes) != 1 || res.Changes[0].Field != "severity" {
		t.Fatalf("expected severity change on ARC, got %+v", res.Changes)
	}
	if res.Changes[0].CurrentValue != "critical" || res.Changes[0].NewValue != "info" {
		t.Fatalf("unexpected severity diff: %+v", res.Changes[0])
	}
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for AlertRelabelConfig")
	}
	spec, ok := res.DesiredObject["spec"].(map[string]any)
	if !ok {
		t.Fatalf("expected spec in desiredObject, got %+v", res.DesiredObject)
	}
	configs, ok := spec["configs"].([]any)
	if !ok || len(configs) < 2 {
		t.Fatalf("expected relabel configs in desiredObject, got %+v", spec["configs"])
	}
}

func TestPreviewUpdatePlatform_ClassificationAndLabelsMultiResource(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPreviewPlatformMocks(t, mockK8s, true)

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return nil, false, nil
			},
			CreateFunc: func(_ context.Context, _ osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
				t.Fatal("preview must not persist ARC changes")
				return nil, nil
			},
			UpdateFunc: func(_ context.Context, _ osmv1.AlertRelabelConfig) error {
				t.Fatal("preview must not persist ARC changes")
				return nil
			},
		}
	}
	mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
		return &testutils.MockAlertingRuleInterface{
			GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
				return &osmv1.AlertingRule{
					ObjectMeta: metav1.ObjectMeta{
						Name:      name,
						Namespace: k8s.ClusterMonitoringNamespace,
					},
					Spec: osmv1.AlertingRuleSpec{
						Groups: []osmv1.RuleGroup{{
							Name: "platform-alert-rules",
							Rules: []osmv1.Rule{{
								Alert:  upOriginalPlatformRule.Alert,
								Expr:   intstr.FromString(upOriginalPlatformRule.Expr.String()),
								Labels: copyStringMap(upOriginalPlatformRule.Labels),
							}},
						}},
					},
				}, true, nil
			},
			UpdateFunc: func(_ context.Context, _ osmv1.AlertingRule) error {
				t.Fatal("preview must not persist AlertingRule changes")
				return nil
			},
		}
	}

	component := "networking"
	sev := "info"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: upPlatformRuleId,
		Labels: map[string]*string{"severity": &sev},
		Classification: &management.UpdateRuleClassificationRequest{
			RuleId:       upPlatformRuleId,
			Component:    &component,
			ComponentSet: true,
		},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	if len(plan.Resources) != 2 {
		t.Fatalf("expected two resources, got %d: %+v", len(plan.Resources), plan.Resources)
	}

	arcRes, ok := findPreviewResource(plan, "AlertRelabelConfig")
	if !ok {
		t.Fatal("expected AlertRelabelConfig in preview resources")
	}
	if len(arcRes.Changes) == 0 {
		t.Fatal("expected classification changes on ARC")
	}
	foundComponent := false
	for _, ch := range arcRes.Changes {
		if ch.Field == k8s.AlertRuleClassificationComponentKey {
			foundComponent = true
		}
	}
	if !foundComponent {
		t.Fatalf("expected component change on ARC, got %+v", arcRes.Changes)
	}
	if arcRes.DesiredObject == nil {
		t.Fatal("expected ARC desiredObject")
	}

	arRes, ok := findPreviewResource(plan, "AlertingRule")
	if !ok {
		t.Fatal("expected AlertingRule in preview resources")
	}
	if len(arRes.Changes) != 1 || arRes.Changes[0].Field != "labels.severity" {
		t.Fatalf("expected severity change on AlertingRule, got %+v", arRes.Changes)
	}
	if arRes.DesiredObject == nil {
		t.Fatal("expected AlertingRule desiredObject")
	}

	if plan.DesiredRule.Labels["severity"] != "info" {
		t.Fatalf("expected desiredRule severity=info, got %+v", plan.DesiredRule.Labels)
	}
	if plan.DesiredRule.Labels[k8s.AlertRuleClassificationComponentKey] != "networking" {
		t.Fatalf("expected desiredRule component=networking, got %+v", plan.DesiredRule.Labels)
	}
}

func copyStringMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}
