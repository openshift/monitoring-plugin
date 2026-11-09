package management_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
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

func desiredPrometheusRule(t *testing.T, desiredObject map[string]any) monitoringv1.PrometheusRule {
	t.Helper()
	data, err := json.Marshal(desiredObject)
	if err != nil {
		t.Fatalf("marshal desired PrometheusRule: %v", err)
	}
	var pr monitoringv1.PrometheusRule
	if err := json.Unmarshal(data, &pr); err != nil {
		t.Fatalf("decode desired PrometheusRule: %v", err)
	}
	return pr
}

func TestPreviewCreateUserDefined_WritablePrometheusRule(t *testing.T) {
	mockRules := &testutils.MockPrometheusRuleInterface{
		AddRuleFunc: func(context.Context, types.NamespacedName, string, monitoringv1.Rule, func(*monitoringv1.PrometheusRule) error) error {
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
	if _, ok := testRule.Labels[k8s.AlertRuleLabelId]; ok {
		t.Fatal("preview must not mutate the caller's Labels map")
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
	expectedRule := copyRule(originalUserRule)
	expectedRule.Labels["severity"] = "critical"
	expectedID := alertrule.GetAlertingRuleId(&expectedRule)
	desiredPR := desiredPrometheusRule(t, res.DesiredObject)
	desiredID := desiredPR.Spec.Groups[0].Rules[0].Labels[k8s.AlertRuleLabelId]
	if desiredID != expectedID {
		t.Fatalf("expected desiredObject rule ID %q, got %q", expectedID, desiredID)
	}
	if plan.DesiredRule.Labels["severity"] != "critical" {
		t.Fatalf("expected desiredRule severity=critical, got %+v", plan.DesiredRule.Labels)
	}
	if updateCalled {
		t.Fatal("preview must not persist updates")
	}
}

func TestPreviewUpdateUserDefined_RejectsRuleIDCollision(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)

	duplicate := copyRule(originalUserRule)
	duplicate.Labels["severity"] = "critical"
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{
							Name:  "test-group",
							Rules: []monitoringv1.Rule{originalUserRule, duplicate},
						}},
					},
				}, true, nil
			},
		}
	}

	sev := "critical"
	_, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: originalUserRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	var conflict *management.ConflictError
	if !errors.As(err, &conflict) || conflict.Error() != "alert rule with exact config already exists" {
		t.Fatalf("expected conflict %q, got %v", "alert rule with exact config already exists", err)
	}
}

func TestPreviewUpdateUserDefined_GitOpsManaged(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	gitopsRule := copyRuleWithLabels(udUserRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByGitOps)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, gitopsRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makeManagedPRWithRule("user-namespace", "user-rule", originalUserRule,
			map[string]string{"argocd.argoproj.io/tracking-id": "gitops"}, nil)
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

func TestPreviewUpdateUserDefined_LivePrometheusRuleIsAuthoritative(t *testing.T) {
	sev := "critical"

	// A stale GitOps marker must not block updates when the live
	// PrometheusRule is no longer externally managed: the relabeled rule's
	// managed-by label is only a relabel-time snapshot.
	client, mockK8s := newUpdateUserDefinedClient(t)
	staleGitOps := copyRuleWithLabels(udUserRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByGitOps)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, staleGitOps)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePRWithRule("user-namespace", "user-rule", originalUserRule)
	}

	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: originalUserRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	if !plan.Writable {
		t.Fatalf("expected writable=true with stale marker and unmanaged PrometheusRule, got managedBy=%v", plan.ManagedBy)
	}
	if _, err := client.UpdateAlertRuleLabels(context.Background(), originalUserRuleId, map[string]*string{"severity": &sev}); err != nil {
		t.Fatalf("expected execute to follow the live PrometheusRule, got %v", err)
	}

	// Conversely, a freshly GitOps-managed PrometheusRule must block the
	// update even when the cached marker still says operator.
	client, mockK8s = newUpdateUserDefinedClient(t)
	staleOperator := copyRuleWithLabels(udUserRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByOperator)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, staleOperator)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makeManagedPRWithRule("user-namespace", "user-rule", originalUserRule,
			map[string]string{"argocd.argoproj.io/tracking-id": "gitops"}, nil)
	}

	plan, err = client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: originalUserRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	if plan.Writable {
		t.Fatal("expected writable=false with GitOps-managed PrometheusRule")
	}
	if plan.ManagedBy == nil || *plan.ManagedBy != management.ManagedByGitOps {
		t.Fatalf("expected managedBy=gitops, got %+v", plan.ManagedBy)
	}
}

func TestPreviewUpdateUserDefined_RejectsInvalidLabelName(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePRWithRule("user-namespace", "user-rule", originalUserRule)
	}

	value := "value"
	_, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: originalUserRuleId,
		Labels: map[string]*string{"bad~name": &value},
	})
	var ve *management.ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected ValidationError, got %T: %v", err, err)
	}
	if !strings.Contains(err.Error(), "invalid label name") {
		t.Fatalf("expected invalid label name error, got %v", err)
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

func TestPreviewRestoreDroppedRuleWithoutRelabeledCache(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{}
	}
	sourceNamespace := "openshift-kube-apiserver"
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(namespace string) bool {
				return namespace == sourceNamespace || namespace == k8s.ClusterMonitoringNamespace
			},
		}
	}
	sourcePR := monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{Name: "platform-rule-drop", Namespace: sourceNamespace},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{drOriginalPlatformRule}}},
		},
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			ListFunc: func() ([]monitoringv1.PrometheusRule, error) {
				return []monitoringv1.PrometheusRule{sourcePR}, nil
			},
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				if namespace != sourceNamespace || name != sourcePR.Name {
					t.Fatalf(
						"expected PrometheusRule lookup %s/%s, got %s/%s",
						sourceNamespace, sourcePR.Name, namespace, name,
					)
				}
				return sourcePR.DeepCopy(), true, nil
			},
		}
	}
	droppedARC := osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "arc-platform-rule-drop",
			Namespace: k8s.ClusterMonitoringNamespace,
			Labels: map[string]string{
				managementlabels.ARCLabelPrometheusRuleNameKey: "platform-rule-drop",
				managementlabels.ARCLabelAlertNameKey:          drOriginalPlatformRule.Alert,
			},
			Annotations: map[string]string{
				managementlabels.ARCAnnotationAlertRuleIDKey: drPlatformRuleId,
			},
		},
		Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{
			{TargetLabel: "team", Replacement: "platform", Action: "Replace"},
			{SourceLabels: []osmv1.LabelName{k8s.AlertRuleLabelId}, Regex: drPlatformRuleId, Action: "Drop"},
		}},
	}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			ListFunc: func(_ context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
				if namespace != k8s.ClusterMonitoringNamespace {
					t.Fatalf(
						"expected ARC namespace %q, got %q",
						k8s.ClusterMonitoringNamespace, namespace,
					)
				}
				return []osmv1.AlertRelabelConfig{droppedARC}, nil
			},
			GetFunc: func(_ context.Context, namespace, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				if namespace != k8s.ClusterMonitoringNamespace || name != droppedARC.Name {
					return nil, false, nil
				}
				return droppedARC.DeepCopy(), true, nil
			},
		}
	}

	enabled := true
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID:              drPlatformRuleId,
		AlertingRuleEnabled: &enabled,
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate restore: %v", err)
	}
	res := firstPreviewResource(t, plan)
	if res.DesiredObject == nil {
		t.Fatal("expected restore preview to preserve the remaining ARC config")
	}
	if len(res.Changes) != 1 || res.Changes[0].Field != "alertingRuleEnabled" {
		t.Fatalf("expected exactly one alertingRuleEnabled change, got %+v", res.Changes)
	}
}

func TestPreviewRestoreDroppedRule_GitOpsSourceBlocks(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{}
	}
	sourceNamespace := "openshift-kube-apiserver"
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(namespace string) bool {
				return namespace == sourceNamespace || namespace == k8s.ClusterMonitoringNamespace
			},
		}
	}
	// The source PrometheusRule became GitOps-managed after the rule was
	// dropped: restoring must be blocked even though the rule is absent
	// from the relabeled rules cache.
	sourcePR := monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "platform-rule-drop",
			Namespace:   sourceNamespace,
			Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "gitops"},
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{drOriginalPlatformRule}}},
		},
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			ListFunc: func() ([]monitoringv1.PrometheusRule, error) {
				return []monitoringv1.PrometheusRule{sourcePR}, nil
			},
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				if namespace != sourceNamespace || name != sourcePR.Name {
					t.Fatalf(
						"expected PrometheusRule lookup %s/%s, got %s/%s",
						sourceNamespace, sourcePR.Name, namespace, name,
					)
				}
				return sourcePR.DeepCopy(), true, nil
			},
		}
	}
	droppedARC := osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "arc-platform-rule-drop",
			Namespace: k8s.ClusterMonitoringNamespace,
			Labels: map[string]string{
				managementlabels.ARCLabelPrometheusRuleNameKey: "platform-rule-drop",
				managementlabels.ARCLabelAlertNameKey:          drOriginalPlatformRule.Alert,
			},
			Annotations: map[string]string{
				managementlabels.ARCAnnotationAlertRuleIDKey: drPlatformRuleId,
			},
		},
		Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{
			{SourceLabels: []osmv1.LabelName{k8s.AlertRuleLabelId}, Regex: drPlatformRuleId, Action: "Drop"},
		}},
	}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			ListFunc: func(_ context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
				return []osmv1.AlertRelabelConfig{droppedARC}, nil
			},
			GetFunc: func(_ context.Context, namespace, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				if namespace != k8s.ClusterMonitoringNamespace || name != droppedARC.Name {
					return nil, false, nil
				}
				return droppedARC.DeepCopy(), true, nil
			},
		}
	}

	enabled := true
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID:              drPlatformRuleId,
		AlertingRuleEnabled: &enabled,
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate restore: %v", err)
	}
	if plan.Writable {
		t.Fatal("expected writable=false for a GitOps-managed source PrometheusRule")
	}
	if plan.ManagedBy == nil || *plan.ManagedBy != management.ManagedByGitOps {
		t.Fatalf("expected managedBy=gitops, got %+v", plan.ManagedBy)
	}
}

func TestPreviewRestoreReportsARCDeletion(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	stampAndDrop := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "arc-platform-rule-drop",
			Namespace: k8s.ClusterMonitoringNamespace,
		},
		Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{
			{TargetLabel: k8s.AlertRuleLabelId, Replacement: drPlatformRuleId, Action: "Replace"},
			{SourceLabels: []osmv1.LabelName{k8s.AlertRuleLabelId}, Regex: drPlatformRuleId, Action: "Drop"},
		}},
	}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return stampAndDrop, true, nil
			},
		}
	}

	enabled := true
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID:              drPlatformRuleId,
		AlertingRuleEnabled: &enabled,
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate restore: %v", err)
	}
	res := firstPreviewResource(t, plan)
	if res.DesiredObject != nil {
		t.Fatalf("expected nil desiredObject for ARC deletion, got %+v", res.DesiredObject)
	}
	foundRemoval := false
	for _, change := range res.Changes {
		if change.Field == "resource" && change.Operation == management.RuleChangeOpRemove {
			foundRemoval = true
		}
	}
	if !foundRemoval {
		t.Fatalf("expected ARC resource removal, got %+v", res.Changes)
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

func TestPreviewCreateUserDefined_DesiredObjectHasTypeMeta(t *testing.T) {
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
				GetFunc: func(_ context.Context, _, _ string) (*monitoringv1.PrometheusRule, bool, error) {
					return nil, false, nil
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
	res := firstPreviewResource(t, plan)
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for PrometheusRule")
	}
	if res.DesiredObject["apiVersion"] != "monitoring.coreos.com/v1" {
		t.Fatalf("expected desiredObject apiVersion=monitoring.coreos.com/v1, got %v", res.DesiredObject["apiVersion"])
	}
	if res.DesiredObject["kind"] != "PrometheusRule" {
		t.Fatalf("expected desiredObject kind=PrometheusRule, got %v", res.DesiredObject["kind"])
	}
}

func TestPreviewCreatePlatform_DesiredObjectHasTypeMeta(t *testing.T) {
	mockK8s := &testutils.MockClient{
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(_ context.Context, _ string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		},
		AlertingRulesFunc: func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				GetFunc: func(_ context.Context, _ string) (*osmv1.AlertingRule, bool, error) {
					return nil, false, nil
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	plan, err := client.PreviewAlertRuleCreate(context.Background(), management.PreviewCreateRequest{
		AlertRule: testRule,
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleCreate: %v", err)
	}
	if !plan.Writable {
		t.Fatal("expected writable=true")
	}
	res := firstPreviewResource(t, plan)
	if res.Resource.Kind != "AlertingRule" {
		t.Fatalf("unexpected resource: %+v", res.Resource)
	}
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for AlertingRule")
	}
	if res.DesiredObject["apiVersion"] != "monitoring.openshift.io/v1" {
		t.Fatalf("expected desiredObject apiVersion=monitoring.openshift.io/v1, got %v", res.DesiredObject["apiVersion"])
	}
	if res.DesiredObject["kind"] != "AlertingRule" {
		t.Fatalf("expected desiredObject kind=AlertingRule, got %v", res.DesiredObject["kind"])
	}
}

func TestPreviewUpdatePlatform_NewARCDesiredObjectHasTypeMeta(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPreviewPlatformMocks(t, mockK8s, false)

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
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for AlertRelabelConfig")
	}
	if res.DesiredObject["apiVersion"] != "monitoring.openshift.io/v1" {
		t.Fatalf("expected desiredObject apiVersion=monitoring.openshift.io/v1, got %v", res.DesiredObject["apiVersion"])
	}
	if res.DesiredObject["kind"] != "AlertRelabelConfig" {
		t.Fatalf("expected desiredObject kind=AlertRelabelConfig, got %v", res.DesiredObject["kind"])
	}
}

func TestPreviewUpdateUserDefined_ExistingPRDesiredObjectHasTypeMeta(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
		}
	}
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePRWithRule("user-namespace", "user-rule", originalUserRule)
	}

	critical := "critical"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: originalUserRuleId,
		Labels: map[string]*string{"severity": &critical},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	res, ok := findPreviewResource(plan, "PrometheusRule")
	if !ok {
		t.Fatalf("expected PrometheusRule resource, got %+v", plan.Resources)
	}
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for PrometheusRule")
	}
	if res.DesiredObject["apiVersion"] != "monitoring.coreos.com/v1" {
		t.Fatalf("expected desiredObject apiVersion=monitoring.coreos.com/v1, got %v", res.DesiredObject["apiVersion"])
	}
	if res.DesiredObject["kind"] != "PrometheusRule" {
		t.Fatalf("expected desiredObject kind=PrometheusRule, got %v", res.DesiredObject["kind"])
	}
}

func TestPreviewUpdatePlatform_ExistingAlertingRuleDesiredObjectHasTypeMeta(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPreviewPlatformMocks(t, mockK8s, true)

	sev := "info"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: upPlatformRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	res, ok := findPreviewResource(plan, "AlertingRule")
	if !ok {
		t.Fatalf("expected AlertingRule resource, got %+v", plan.Resources)
	}
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for AlertingRule")
	}
	if res.DesiredObject["apiVersion"] != "monitoring.openshift.io/v1" {
		t.Fatalf("expected desiredObject apiVersion=monitoring.openshift.io/v1, got %v", res.DesiredObject["apiVersion"])
	}
	if res.DesiredObject["kind"] != "AlertingRule" {
		t.Fatalf("expected desiredObject kind=AlertingRule, got %v", res.DesiredObject["kind"])
	}
}

func TestPreviewUpdatePlatform_ExistingARCDesiredObjectHasTypeMeta(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPreviewPlatformMocks(t, mockK8s, false)

	existing := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "arc-platform-rule",
			Namespace: k8s.ClusterMonitoringNamespace,
		},
		Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{
			{TargetLabel: k8s.AlertRuleLabelId, Replacement: upPlatformRuleId, Action: "Replace"},
		}},
	}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return existing.DeepCopy(), true, nil
			},
		}
	}

	team := "sre"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: upPlatformRuleId,
		Labels: map[string]*string{"team": &team},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	res, ok := findPreviewResource(plan, "AlertRelabelConfig")
	if !ok {
		t.Fatalf("expected AlertRelabelConfig resource, got %+v", plan.Resources)
	}
	if res.DesiredObject == nil {
		t.Fatal("expected desiredObject for AlertRelabelConfig")
	}
	if res.DesiredObject["apiVersion"] != "monitoring.openshift.io/v1" {
		t.Fatalf("expected desiredObject apiVersion=monitoring.openshift.io/v1, got %v", res.DesiredObject["apiVersion"])
	}
	if res.DesiredObject["kind"] != "AlertRelabelConfig" {
		t.Fatalf("expected desiredObject kind=AlertRelabelConfig, got %v", res.DesiredObject["kind"])
	}
}

func TestPreviewUpdatePlatform_ClearedClassificationRetainsSourceSetLabel(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPreviewPlatformMocks(t, mockK8s, false)

	// The source rule sets the component label. openshift_io_* labels are
	// excluded from the rule ID, so adding it keeps the ID stable.
	sourceRule := copyRuleWithLabels(upOriginalPlatformRule, k8s.AlertRuleClassificationComponentKey, "storage")
	relabeled := copyRuleWithLabels(upPlatformRule, k8s.AlertRuleClassificationComponentKey, "storage")
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upPlatformRuleId, relabeled)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePlatformPR("openshift-monitoring", "platform-rule", sourceRule)
	}

	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: upPlatformRuleId,
		Classification: &management.UpdateRuleClassificationRequest{
			RuleId:       upPlatformRuleId,
			ComponentSet: true,
			// Component left nil: clear the classification label.
		},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	if !plan.Writable {
		t.Fatalf("expected writable preview, got managedBy=%v", plan.ManagedBy)
	}
	// The ARC can only drop its override; it cannot remove a label the
	// source rule sets, so the preview must retain the source value instead
	// of reporting it as removed.
	if got := plan.DesiredRule.Labels[k8s.AlertRuleClassificationComponentKey]; got != "storage" {
		t.Fatalf("expected desiredRule to retain source-set component=storage, got %q", got)
	}
	for _, res := range plan.Resources {
		for _, change := range res.Changes {
			if change.Field == k8s.AlertRuleClassificationComponentKey {
				t.Fatalf("unexpected change for source-set classification label: %+v", change)
			}
		}
	}
}

func TestPreviewDropPlatformRule_OperatorManagedRemainsWritable(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	operatorRule := copyRuleWithLabels(drPlatformRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByOperator)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == drPlatformRuleId {
					return operatorRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}

	disabled := false
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID:              drPlatformRuleId,
		AlertingRuleEnabled: &disabled,
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	// Dropping writes an AlertRelabelConfig, not the operator-managed
	// PrometheusRule, so operator management must not block the preview.
	if !plan.Writable {
		t.Fatalf("expected operator-managed rule drop to stay writable, got managedBy=%v", plan.ManagedBy)
	}
}

func TestPreviewDropKeepsRetainedOverrides(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	// The existing ARC overrides team=sre with team=platform. The desired
	// ARC keeps that override when the drop is added, so the previewed rule
	// must reflect it instead of reverting to the source rule's team=sre.
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{Name: "arc-platform-rule-drop", Namespace: "openshift-monitoring"},
					Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{
						{TargetLabel: "team", Replacement: "platform", Action: "Replace"},
					}},
				}, true, nil
			},
		}
	}

	disabled := false
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID:              drPlatformRuleId,
		AlertingRuleEnabled: &disabled,
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate drop: %v", err)
	}
	if plan.DesiredRule.Labels["team"] != "platform" {
		t.Fatalf("expected desiredRule team=platform (retained override), got %q", plan.DesiredRule.Labels["team"])
	}
}

func TestPreviewUpdatePlatform_DirectAlertingRuleKeepsARCOverride(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPreviewPlatformMocks(t, mockK8s, true)

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "arc-platform-rule",
						Namespace: k8s.ClusterMonitoringNamespace,
					},
					Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{
						{TargetLabel: k8s.AlertRuleLabelId, Replacement: upPlatformRuleId, Action: "Replace"},
						{TargetLabel: "severity", Replacement: "info", Action: "Replace"},
					}},
				}, true, nil
			},
		}
	}

	sev := "warning"
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID: upPlatformRuleId,
		Labels: map[string]*string{"severity": &sev},
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate: %v", err)
	}
	arRes, ok := findPreviewResource(plan, "AlertingRule")
	if !ok {
		t.Fatalf("expected AlertingRule resource, got %+v", plan.Resources)
	}
	if len(arRes.Changes) != 1 || arRes.Changes[0].Field != "labels.severity" {
		t.Fatalf("expected labels.severity change on AlertingRule, got %+v", arRes.Changes)
	}
	if arRes.Changes[0].CurrentValue != "critical" || arRes.Changes[0].NewValue != "warning" {
		t.Fatalf("unexpected AlertingRule severity diff: %+v", arRes.Changes[0])
	}
	// The surviving ARC override still wins at relabel time, so the effective
	// severity stays "info" even though the AlertingRule label is "warning".
	if plan.DesiredRule.Labels["severity"] != "info" {
		t.Fatalf("expected desiredRule severity=info (ARC override wins), got %q", plan.DesiredRule.Labels["severity"])
	}
}

func TestPreviewUpdatePlatform_ReportsLabelReversionOnARCDelete(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPreviewPlatformMocks(t, mockK8s, false)

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "arc-platform-rule",
						Namespace: k8s.ClusterMonitoringNamespace,
					},
					Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{
						{TargetLabel: k8s.AlertRuleLabelId, Replacement: upPlatformRuleId, Action: "Replace"},
						{TargetLabel: "severity", Replacement: "info", Action: "Replace"},
					}},
				}, true, nil
			},
		}
	}

	sev := "critical"
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
	if res.DesiredObject != nil {
		t.Fatalf("expected nil desiredObject for ARC deletion, got %+v", res.DesiredObject)
	}
	foundSeverityReversion := false
	foundRemoval := false
	for _, change := range res.Changes {
		if change.Field == "severity" && change.CurrentValue == "info" && change.NewValue == "critical" {
			foundSeverityReversion = true
		}
		if change.Field == "resource" && change.Operation == management.RuleChangeOpRemove {
			foundRemoval = true
		}
	}
	if !foundSeverityReversion {
		t.Fatalf("expected severity reversion info->critical in changes, got %+v", res.Changes)
	}
	if !foundRemoval {
		t.Fatalf("expected ARC resource removal, got %+v", res.Changes)
	}
	if plan.DesiredRule.Labels["severity"] != "critical" {
		t.Fatalf("expected desiredRule severity=critical, got %q", plan.DesiredRule.Labels["severity"])
	}
}

func TestPreviewRestoreKeepsRetainedOverrides(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{}
	}
	sourceNamespace := "openshift-kube-apiserver"
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(namespace string) bool {
				return namespace == sourceNamespace || namespace == k8s.ClusterMonitoringNamespace
			},
		}
	}
	sourcePR := monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{Name: "platform-rule-drop", Namespace: sourceNamespace},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{drOriginalPlatformRule}}},
		},
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			ListFunc: func() ([]monitoringv1.PrometheusRule, error) {
				return []monitoringv1.PrometheusRule{sourcePR}, nil
			},
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return sourcePR.DeepCopy(), true, nil
			},
		}
	}
	droppedARC := osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "arc-platform-rule-drop",
			Namespace: k8s.ClusterMonitoringNamespace,
			Labels: map[string]string{
				managementlabels.ARCLabelPrometheusRuleNameKey: "platform-rule-drop",
				managementlabels.ARCLabelAlertNameKey:          drOriginalPlatformRule.Alert,
			},
			Annotations: map[string]string{
				managementlabels.ARCAnnotationAlertRuleIDKey: drPlatformRuleId,
			},
		},
		Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{
			{TargetLabel: "team", Replacement: "platform", Action: "Replace"},
			{SourceLabels: []osmv1.LabelName{k8s.AlertRuleLabelId}, Regex: drPlatformRuleId, Action: "Drop"},
		}},
	}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			ListFunc: func(_ context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
				return []osmv1.AlertRelabelConfig{droppedARC}, nil
			},
			GetFunc: func(_ context.Context, namespace, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				if namespace != k8s.ClusterMonitoringNamespace || name != droppedARC.Name {
					return nil, false, nil
				}
				return droppedARC.DeepCopy(), true, nil
			},
		}
	}

	enabled := true
	plan, err := client.PreviewAlertRuleUpdate(context.Background(), management.PreviewUpdateRequest{
		RuleID:              drPlatformRuleId,
		AlertingRuleEnabled: &enabled,
	})
	if err != nil {
		t.Fatalf("PreviewAlertRuleUpdate restore: %v", err)
	}
	// Restoring removes the drop but keeps the team override, so the restored
	// alert keeps team=platform rather than reverting to the source team=sre.
	if plan.DesiredRule.Labels["team"] != "platform" {
		t.Fatalf("expected desiredRule team=platform (retained override), got %q", plan.DesiredRule.Labels["team"])
	}
	if plan.DesiredRule.Labels["severity"] != "warning" {
		t.Fatalf("expected desiredRule severity=warning, got %q", plan.DesiredRule.Labels["severity"])
	}
}

func copyStringMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}
