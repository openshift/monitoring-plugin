package management_test

import (
	"context"
	"errors"
	"strings"
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
	// upOriginalPlatformRule is as stored in the PrometheusRule (without k8s labels).
	upOriginalPlatformRule = monitoringv1.Rule{
		Alert: "PlatformAlert",
		Expr:  intstr.FromString("node_down == 1"),
		Labels: map[string]string{
			"severity": "critical",
		},
	}
	upOriginalPlatformRuleId = alertrule.GetAlertingRuleId(&upOriginalPlatformRule)

	// upPlatformRule is as seen by RelabeledRules (with k8s labels added).
	upPlatformRule = monitoringv1.Rule{
		Alert: "PlatformAlert",
		Expr:  intstr.FromString("node_down == 1"),
		Labels: map[string]string{
			"severity":                       "critical",
			k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
			k8s.PrometheusRuleLabelName:      "platform-rule",
			k8s.AlertRuleLabelId:             upOriginalPlatformRuleId,
		},
	}
	upPlatformRuleId = alertrule.GetAlertingRuleId(&upPlatformRule)

	upUserRule = monitoringv1.Rule{
		Alert: "UserAlert",
		Labels: map[string]string{
			k8s.PrometheusRuleLabelNamespace: "user-namespace",
			k8s.PrometheusRuleLabelName:      "user-rule",
		},
	}
	upUserRuleId = alertrule.GetAlertingRuleId(&upUserRule)
)

func newUpdatePlatformClient(t *testing.T) (management.Client, *testutils.MockClient) {
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

func mockPlatformRelabeledGet(ruleId string, rule monitoringv1.Rule) func() k8s.RelabeledRulesInterface {
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

func makePlatformPR(namespace, name string, rules ...monitoringv1.Rule) *testutils.MockPrometheusRuleInterface {
	return &testutils.MockPrometheusRuleInterface{
		GetFunc: func(_ context.Context, ns, n string) (*monitoringv1.PrometheusRule, bool, error) {
			return &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: n},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{{Name: "grp", Rules: rules}},
				},
			}, true, nil
		},
	}
}

// --- Managed-by / GitOps blocks ---

func TestUpdatePlatformAlertRule_BlocksOperatorManagedWithGitOpsPR(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	opRule := copyRuleWithLabels(upPlatformRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByOperator)
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upPlatformRuleId, opRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{
						Namespace:   namespace,
						Name:        name,
						Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "gitops-track"},
					},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "grp", Rules: []monitoringv1.Rule{upOriginalPlatformRule}}},
					},
				}, true, nil
			},
		}
	}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return nil, false, nil
			},
		}
	}

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, upOriginalPlatformRule)
	if err == nil || !strings.Contains(err.Error(), "managed by GitOps") {
		t.Errorf("expected GitOps block, got: %v", err)
	}
}

func TestUpdatePlatformAlertRule_BlocksGitOpsManagedARC(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	opRule := copyRuleWithLabels(upPlatformRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByOperator)
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upPlatformRuleId, opRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePlatformPR("openshift-monitoring", "platform-rule", upOriginalPlatformRule)
	}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, ns, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				return &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name: name, Namespace: ns,
						Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "abc"},
					},
				}, true, nil
			},
		}
	}

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, upOriginalPlatformRule)
	if err == nil || !strings.Contains(err.Error(), "managed by GitOps") {
		t.Errorf("expected GitOps block (ARC), got: %v", err)
	}
}

func TestUpdatePlatformAlertRule_BlocksGitOpsManagedRule(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	gitopsRule := copyRuleWithLabels(upPlatformRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByGitOps)
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upPlatformRuleId, gitopsRule)
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

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, upOriginalPlatformRule)
	if err == nil || !strings.Contains(err.Error(), "managed by GitOps") {
		t.Errorf("expected GitOps block (rule), got: %v", err)
	}
}

// --- Not found / wrong type ---

func TestUpdatePlatformAlertRule_NotFound(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, _ string) (monitoringv1.Rule, bool) { return monitoringv1.Rule{}, false },
		}
	}

	err := client.UpdatePlatformAlertRule(context.Background(), "nonexistent-id", upPlatformRule)
	var nf *management.NotFoundError
	if !errors.As(err, &nf) || nf.Resource != "AlertRule" {
		t.Errorf("expected NotFoundError for AlertRule, got: %v", err)
	}
}

func TestUpdatePlatformAlertRule_UserRuleReturnsError(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upUserRuleId, upUserRule)

	err := client.UpdatePlatformAlertRule(context.Background(), upUserRuleId, upUserRule)
	if err == nil || !strings.Contains(err.Error(), "only supported for platform alert rules") {
		t.Errorf("expected user workload error, got: %v", err)
	}
}

func TestUpdatePlatformAlertRule_PRNotFound(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upPlatformRuleId, upPlatformRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, _, _ string) (*monitoringv1.PrometheusRule, bool, error) {
				return nil, false, nil
			},
		}
	}

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, upPlatformRule)
	var nf *management.NotFoundError
	if !errors.As(err, &nf) || nf.Resource != "PrometheusRule" {
		t.Errorf("expected NotFoundError for PrometheusRule, got: %v", err)
	}
}

func TestUpdatePlatformAlertRule_PRGetError(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upPlatformRuleId, upPlatformRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, _, _ string) (*monitoringv1.PrometheusRule, bool, error) {
				return nil, false, errors.New("failed to get PrometheusRule")
			},
		}
	}

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, upPlatformRule)
	if err == nil || !strings.Contains(err.Error(), "failed to get PrometheusRule") {
		t.Errorf("expected PR get error, got: %v", err)
	}
}

// --- No label changes / revert ---

func setupPlatformWithARC(t *testing.T, mockK8s *testutils.MockClient, arcFn func() k8s.AlertRelabelConfigInterface) {
	t.Helper()
	mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(upPlatformRuleId, upPlatformRule)
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePlatformPR("openshift-monitoring", "platform-rule", upOriginalPlatformRule)
	}
	mockK8s.AlertRelabelConfigsFunc = arcFn
}

func TestUpdatePlatformAlertRule_DeletesARCOnRevert(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	deleted := false
	setupPlatformWithARC(t, mockK8s, func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, ns, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				return &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
					Spec:       osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{}},
				}, true, nil
			},
			DeleteFunc: func(_ context.Context, _, _ string) error { deleted = true; return nil },
		}
	})

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, upOriginalPlatformRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !deleted {
		t.Error("expected ARC to be deleted on revert")
	}
}

// --- Label changes / ARC creation ---

func TestUpdatePlatformAlertRule_CreatesARCForLabelChange(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	var createdARC *osmv1.AlertRelabelConfig
	setupPlatformWithARC(t, mockK8s, func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) { return nil, false, nil },
			CreateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
				createdARC = &arc
				return &arc, nil
			},
		}
	})

	updatedRule := copyRule(upOriginalPlatformRule)
	updatedRule.Labels["new_label"] = "new_value"

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if createdARC == nil {
		t.Fatal("expected ARC to be created")
	}
	if createdARC.Namespace != "openshift-monitoring" {
		t.Errorf("expected ARC namespace openshift-monitoring, got %q", createdARC.Namespace)
	}
	if !strings.HasPrefix(createdARC.Name, "arc-") {
		t.Errorf("expected ARC name to start with arc-, got %q", createdARC.Name)
	}
	if len(createdARC.Spec.Configs) == 0 {
		t.Error("expected ARC to have relabel configs")
	}
}

func TestUpdatePlatformAlertRule_IdStampAndSeverityChange(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	var createdARC *osmv1.AlertRelabelConfig
	setupPlatformWithARC(t, mockK8s, func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) { return nil, false, nil },
			CreateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
				createdARC = &arc
				return &arc, nil
			},
		}
	})

	updatedRule := copyRule(upOriginalPlatformRule)
	updatedRule.Labels["severity"] = "info"

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if createdARC == nil {
		t.Fatal("expected ARC to be created")
	}
	if len(createdARC.Spec.Configs) != 2 {
		t.Fatalf("expected 2 relabel configs (id-stamp + severity), got %d", len(createdARC.Spec.Configs))
	}
	cfg0 := createdARC.Spec.Configs[0]
	if string(cfg0.Action) != "Replace" || string(cfg0.TargetLabel) != "openshift_io_alert_rule_id" {
		t.Errorf("cfg0: expected id-stamp Replace, got action=%s target=%s", cfg0.Action, cfg0.TargetLabel)
	}
	if cfg0.Replacement != upPlatformRuleId {
		t.Errorf("cfg0.Replacement: expected %q, got %q", upPlatformRuleId, cfg0.Replacement)
	}
	cfg1 := createdARC.Spec.Configs[1]
	if string(cfg1.Action) != "Replace" || string(cfg1.TargetLabel) != "severity" || cfg1.Replacement != "info" {
		t.Errorf("cfg1: expected severity Replace info, got action=%s target=%s replacement=%s", cfg1.Action, cfg1.TargetLabel, cfg1.Replacement)
	}
}

func TestUpdatePlatformAlertRule_IdStampScopesStaticLabels(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	// Override PR to have extra stable labels.
	origWithExtras := copyRule(upOriginalPlatformRule)
	origWithExtras.Labels = map[string]string{"severity": "critical", "component": "kube", "team": "sre"}
	idForExtras := alertrule.GetAlertingRuleId(&origWithExtras)

	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == idForExtras {
					return monitoringv1.Rule{
						Alert: "PlatformAlert", Expr: intstr.FromString("node_down == 1"),
						Labels: map[string]string{
							k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
							k8s.PrometheusRuleLabelName:      "platform-rule",
							k8s.AlertRuleLabelId:             idForExtras,
							"severity":                       "critical",
						},
					}, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{{Name: "test-group", Rules: []monitoringv1.Rule{origWithExtras}}},
					},
				}, true, nil
			},
		}
	}

	var createdARC *osmv1.AlertRelabelConfig
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) { return nil, false, nil },
			CreateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
				createdARC = &arc
				return &arc, nil
			},
		}
	}

	updatedRule := copyRule(upOriginalPlatformRule)
	updatedRule.Labels = map[string]string{"severity": "info"}

	err := client.UpdatePlatformAlertRule(context.Background(), idForExtras, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if createdARC == nil || len(createdARC.Spec.Configs) != 2 {
		t.Fatalf("expected 2 ARC configs, got %d", len(createdARC.Spec.Configs))
	}

	idCfg := createdARC.Spec.Configs[0]
	if string(idCfg.Action) != "Replace" || string(idCfg.TargetLabel) != "openshift_io_alert_rule_id" {
		t.Errorf("expected id-stamp config, got action=%s target=%s", idCfg.Action, idCfg.TargetLabel)
	}
	var srcLabels []string
	for _, s := range idCfg.SourceLabels {
		srcLabels = append(srcLabels, string(s))
	}
	for _, expected := range []string{"alertname", "component", "severity", "team"} {
		found := false
		for _, sl := range srcLabels {
			if sl == expected {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected source label %q in id-stamp config", expected)
		}
	}
	for _, unexpected := range []string{"namespace"} {
		for _, sl := range srcLabels {
			if sl == unexpected {
				t.Errorf("unexpected source label %q in id-stamp config", unexpected)
			}
		}
	}
	if !strings.HasPrefix(idCfg.Regex, "^") || !strings.HasSuffix(idCfg.Regex, "$") {
		t.Errorf("expected anchored regex, got %q", idCfg.Regex)
	}
	if !strings.Contains(idCfg.Regex, "^PlatformAlert;kube;critical;sre$") {
		t.Errorf("expected sorted label values in regex, got %q", idCfg.Regex)
	}
}

func TestUpdatePlatformAlertRule_UpdatesExistingARC(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	expectedArcName := k8s.GetAlertRelabelConfigName("platform-rule", upPlatformRuleId)
	var updatedARC *osmv1.AlertRelabelConfig

	setupPlatformWithARC(t, mockK8s, func() k8s.AlertRelabelConfigInterface {
		existing := &osmv1.AlertRelabelConfig{
			ObjectMeta: metav1.ObjectMeta{Name: expectedArcName, Namespace: "openshift-monitoring"},
			Spec: osmv1.AlertRelabelConfigSpec{
				Configs: []osmv1.RelabelConfig{{TargetLabel: "testing2", Replacement: "newlabel2", Action: "Replace"}},
			},
		}
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				if name == expectedArcName {
					return existing, true, nil
				}
				return nil, false, nil
			},
			UpdateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) error { updatedARC = &arc; return nil },
		}
	})

	updatedRule := copyRule(upOriginalPlatformRule)
	updatedRule.Labels["severity"] = "info"

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedARC == nil {
		t.Fatal("expected existing ARC to be updated")
	}
	if len(updatedARC.Spec.Configs) == 0 {
		t.Error("expected updated ARC to have configs")
	}
}

func TestUpdatePlatformAlertRule_DeletesARCWhenNoOverridesRemain(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	expectedArcName := k8s.GetAlertRelabelConfigName("platform-rule", upPlatformRuleId)
	deleted := false
	var updatedARC *osmv1.AlertRelabelConfig

	setupPlatformWithARC(t, mockK8s, func() k8s.AlertRelabelConfigInterface {
		existing := &osmv1.AlertRelabelConfig{
			ObjectMeta: metav1.ObjectMeta{Name: expectedArcName, Namespace: "openshift-monitoring"},
			Spec: osmv1.AlertRelabelConfigSpec{
				Configs: []osmv1.RelabelConfig{{TargetLabel: "testing2", Replacement: "newlabel2", Action: "Replace"}},
			},
		}
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				if name == expectedArcName {
					return existing, true, nil
				}
				return nil, false, nil
			},
			UpdateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) error { updatedARC = &arc; return nil },
			DeleteFunc: func(_ context.Context, _, _ string) error { deleted = true; return nil },
		}
	})

	// Drop testing2 (explicit delete); keep severity unchanged (no override needed)
	updatedRule := copyRule(upOriginalPlatformRule)
	updatedRule.Labels = map[string]string{"severity": "critical", "testing2": ""}

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedARC != nil {
		t.Error("expected ARC to be deleted, not updated")
	}
	if !deleted {
		t.Error("expected ARC to be deleted when no overrides remain")
	}
}

// --- Validation ---

func TestUpdatePlatformAlertRule_RejectDropSeverity(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPlatformWithARC(t, mockK8s, func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{}
	})

	updatedRule := copyRule(upOriginalPlatformRule)
	updatedRule.Labels = map[string]string{"severity": ""}

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updatedRule)
	if err == nil || !strings.Contains(err.Error(), `label "severity" cannot be dropped`) {
		t.Errorf("expected severity drop error, got: %v", err)
	}
}

func TestUpdatePlatformAlertRule_IgnoresProtectedLabels(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)

	var createdARC *osmv1.AlertRelabelConfig
	setupPlatformWithARC(t, mockK8s, func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) { return nil, false, nil },
			CreateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
				createdARC = &arc
				return &arc, nil
			},
		}
	})

	updatedRule := copyRule(upOriginalPlatformRule)
	updatedRule.Labels["openshift_io_alert_rule_id"] = "fake"

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updatedRule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_ = createdARC
}

func TestUpdatePlatformAlertRule_RejectsAlertNameChange(t *testing.T) {
	client, mockK8s := newUpdatePlatformClient(t)
	setupPlatformWithARC(t, mockK8s, func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{}
	})

	updatedRule := copyRule(upOriginalPlatformRule)
	updatedRule.Labels = map[string]string{"alertname": "NewName"}

	err := client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updatedRule)
	if err == nil || !strings.Contains(err.Error(), "immutable") {
		t.Errorf("expected immutable alertname error, got: %v", err)
	}
}

// ============================================================
// Drop/Restore Platform Alert Rule tests
// ============================================================

var (
	drOriginalPlatformRule = monitoringv1.Rule{
		Alert: "PlatformAlertDrop",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity": "warning",
			"team":     "sre",
		},
	}
	drOriginalPlatformRuleId = alertrule.GetAlertingRuleId(&drOriginalPlatformRule)

	drPlatformRule = monitoringv1.Rule{
		Alert: "PlatformAlertDrop",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity":                       "warning",
			"team":                           "sre",
			k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
			k8s.PrometheusRuleLabelName:      "platform-rule-drop",
			k8s.AlertRuleLabelId:             drOriginalPlatformRuleId,
		},
	}
	drPlatformRuleId = alertrule.GetAlertingRuleId(&drPlatformRule)
)

func newDropRestoreClient(t *testing.T) (management.Client, *testutils.MockClient) {
	t.Helper()
	mockK8s := &testutils.MockClient{}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool { return name == "openshift-monitoring" },
		}
	}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == drPlatformRuleId {
					return drPlatformRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return makePlatformPR("openshift-monitoring", "platform-rule-drop", drOriginalPlatformRule)
	}
	return management.New(context.Background(), mockK8s), mockK8s
}

func TestDropAlertRule_CreatesARCWithIdStampAndDrop(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)

	var result *osmv1.AlertRelabelConfig
	existing := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{Name: "arc-platform-rule-drop-xxxx", Namespace: "openshift-monitoring"},
		Spec: osmv1.AlertRelabelConfigSpec{
			Configs: []osmv1.RelabelConfig{{TargetLabel: "component", Replacement: "kube-apiserver", Action: "Replace"}},
		},
	}

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, ns, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				if ns == "openshift-monitoring" && strings.HasPrefix(name, "arc-") {
					return existing, true, nil
				}
				return nil, false, nil
			},
			UpdateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) error { result = &arc; return nil },
			CreateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
				result = &arc
				return &arc, nil
			},
		}
	}

	err := client.DropAlertRule(context.Background(), drPlatformRuleId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected ARC to be created/updated")
	}
	if result.Namespace != "openshift-monitoring" || !strings.HasPrefix(result.Name, "arc-") {
		t.Errorf("unexpected ARC name/namespace: %s/%s", result.Namespace, result.Name)
	}

	var hasPriorReplace, hasIdStamp, hasDrop bool
	for _, rc := range result.Spec.Configs {
		switch string(rc.Action) {
		case "Replace":
			if string(rc.TargetLabel) == "component" && rc.Replacement == "kube-apiserver" {
				hasPriorReplace = true
			}
			if string(rc.TargetLabel) == "openshift_io_alert_rule_id" && rc.Replacement == drPlatformRuleId {
				hasIdStamp = true
			}
		case "Drop":
			if len(rc.SourceLabels) == 1 && string(rc.SourceLabels[0]) == "openshift_io_alert_rule_id" && rc.Regex == drPlatformRuleId {
				hasDrop = true
			}
		}
	}
	if !hasPriorReplace {
		t.Error("expected prior Replace config to be preserved")
	}
	if !hasIdStamp {
		t.Error("expected id-stamp Replace config")
	}
	if !hasDrop {
		t.Error("expected Drop config")
	}
}

func TestDropAlertRule_Idempotent(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)

	var stored *osmv1.AlertRelabelConfig
	var last *osmv1.AlertRelabelConfig

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				if stored == nil {
					return nil, false, nil
				}
				return stored, true, nil
			},
			CreateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
				stored = &arc
				last = &arc
				return &arc, nil
			},
			UpdateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) error {
				stored = &arc
				last = &arc
				return nil
			},
		}
	}

	if err := client.DropAlertRule(context.Background(), drPlatformRuleId); err != nil {
		t.Fatalf("first drop: %v", err)
	}
	cfgCount := len(last.Spec.Configs)

	if err := client.DropAlertRule(context.Background(), drPlatformRuleId); err != nil {
		t.Fatalf("second drop: %v", err)
	}
	if len(last.Spec.Configs) != cfgCount {
		t.Errorf("expected same config count after second drop: got %d, want %d", len(last.Spec.Configs), cfgCount)
	}
}

func TestRestoreAlertRule_DeletesARCWhenOnlyDropRemains(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	deleted := false

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		onlyDrop := &osmv1.AlertRelabelConfig{
			ObjectMeta: metav1.ObjectMeta{Name: "arc-to-delete", Namespace: "openshift-monitoring"},
			Spec: osmv1.AlertRelabelConfigSpec{
				Configs: []osmv1.RelabelConfig{
					{SourceLabels: []osmv1.LabelName{"openshift_io_alert_rule_id"}, Regex: drPlatformRuleId, Action: "Drop"},
				},
			},
		}
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return onlyDrop, true, nil
			},
			DeleteFunc: func(_ context.Context, _, _ string) error { deleted = true; return nil },
			UpdateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) error { return errors.New("should not update") },
		}
	}

	if err := client.RestoreAlertRule(context.Background(), drPlatformRuleId); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !deleted {
		t.Error("expected ARC to be deleted")
	}
}

func TestRestoreAlertRule_KeepsOtherConfigsRemovesDropOnly(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	deleted := false
	var updated *osmv1.AlertRelabelConfig

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		withOthers := &osmv1.AlertRelabelConfig{
			ObjectMeta: metav1.ObjectMeta{Name: "arc-keep", Namespace: "openshift-monitoring"},
			Spec: osmv1.AlertRelabelConfigSpec{
				Configs: []osmv1.RelabelConfig{
					{TargetLabel: "component", Replacement: "kube-apiserver", Action: "Replace"},
					{SourceLabels: []osmv1.LabelName{"openshift_io_alert_rule_id"}, Regex: drPlatformRuleId, Action: "Drop"},
				},
			},
		}
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return withOthers, true, nil
			},
			DeleteFunc: func(_ context.Context, _, _ string) error { deleted = true; return nil },
			UpdateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) error { updated = &arc; return nil },
		}
	}

	if err := client.RestoreAlertRule(context.Background(), drPlatformRuleId); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted {
		t.Error("expected ARC to be updated, not deleted")
	}
	if updated == nil {
		t.Fatal("expected ARC to be updated")
	}
	for _, rc := range updated.Spec.Configs {
		if string(rc.Action) == "Drop" {
			t.Error("Drop config should have been removed")
		}
	}
	found := false
	for _, rc := range updated.Spec.Configs {
		if string(rc.Action) == "Replace" && string(rc.TargetLabel) == "component" && rc.Replacement == "kube-apiserver" {
			found = true
		}
	}
	if !found {
		t.Error("expected Replace config for component to be preserved")
	}
}

func TestRestoreAlertRule_DeletesARCWhenOnlyStampAndDropRemain(t *testing.T) {
	client, mockK8s := newDropRestoreClient(t)
	deleted := false
	var updated *osmv1.AlertRelabelConfig

	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		stampAndDrop := &osmv1.AlertRelabelConfig{
			ObjectMeta: metav1.ObjectMeta{Name: "arc-stamp-drop", Namespace: "openshift-monitoring"},
			Spec: osmv1.AlertRelabelConfigSpec{
				Configs: []osmv1.RelabelConfig{
					{
						SourceLabels: []osmv1.LabelName{"alertname", "severity", "team"},
						Regex:        "^PlatformAlertDrop;warning;sre$",
						TargetLabel:  "openshift_io_alert_rule_id",
						Replacement:  drPlatformRuleId,
						Action:       "Replace",
					},
					{SourceLabels: []osmv1.LabelName{"openshift_io_alert_rule_id"}, Regex: drPlatformRuleId, Action: "Drop"},
				},
			},
		}
		return &testutils.MockAlertRelabelConfigInterface{
			GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
				return stampAndDrop, true, nil
			},
			DeleteFunc: func(_ context.Context, _, _ string) error { deleted = true; return nil },
			UpdateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) error { updated = &arc; return nil },
		}
	}

	if err := client.RestoreAlertRule(context.Background(), drPlatformRuleId); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !deleted {
		t.Error("expected ARC to be deleted when only stamp remains after removing Drop")
	}
	if updated != nil {
		t.Error("ARC should not be updated when deleted")
	}
}
