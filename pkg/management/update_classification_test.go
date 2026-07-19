package management_test

import (
	"context"
	"errors"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

var (
	platformOriginal = monitoringv1.Rule{
		Alert: "CannotRetrieveUpdates",
		Labels: map[string]string{
			"severity": "warning",
		},
	}
	platformRuleId = alertrule.GetAlertingRuleId(&platformOriginal)

	userOriginal = monitoringv1.Rule{
		Alert: "HighLatency",
		Labels: map[string]string{
			"severity": "warning",
		},
	}
	userRuleId = alertrule.GetAlertingRuleId(&userOriginal)

	clTestPlatformNamespace = "openshift-monitoring"
	clTestUserNamespace     = "my-app"
	clTestRuleName          = "my-rules"
)

func makePlatformRelabeled() monitoringv1.Rule {
	return monitoringv1.Rule{
		Alert: platformOriginal.Alert,
		Labels: map[string]string{
			k8s.AlertRuleLabelId:             platformRuleId,
			k8s.PrometheusRuleLabelNamespace: clTestPlatformNamespace,
			k8s.PrometheusRuleLabelName:      clTestRuleName,
			"severity":                       "warning",
		},
	}
}

func makeUserRelabeled() monitoringv1.Rule {
	return monitoringv1.Rule{
		Alert: userOriginal.Alert,
		Labels: map[string]string{
			k8s.AlertRuleLabelId:             userRuleId,
			k8s.PrometheusRuleLabelNamespace: clTestUserNamespace,
			k8s.PrometheusRuleLabelName:      clTestRuleName,
			"severity":                       "warning",
		},
	}
}

func makeClassificationPR(ns, name string, rules ...monitoringv1.Rule) *monitoringv1.PrometheusRule {
	return &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{{Name: "default", Rules: rules}},
		},
	}
}

func newClassificationClient(t *testing.T) (management.Client, *testutils.MockClient) {
	t.Helper()
	mockK8s := &testutils.MockClient{}
	return management.New(context.Background(), mockK8s), mockK8s
}

func mockRelabeledRules(id string, rule monitoringv1.Rule) func() k8s.RelabeledRulesInterface {
	return func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, gotID string) (monitoringv1.Rule, bool) {
				if gotID == id {
					return rule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
}

// --- Validation tests ---

func TestUpdateAlertRuleClassification_EmptyRuleId(t *testing.T) {
	client, _ := newClassificationClient(t)
	err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{})
	if err == nil {
		t.Fatal("expected error for empty ruleId")
	}
	var ve *management.ValidationError
	if !errors.As(err, &ve) {
		t.Errorf("expected ValidationError, got %T: %v", err, err)
	}
}

func TestUpdateAlertRuleClassification_InvalidLayer(t *testing.T) {
	client, mockK8s := newClassificationClient(t)
	rule := makePlatformRelabeled()
	mockK8s.RelabeledRulesFunc = mockRelabeledRules(platformRuleId, rule)

	bad := "invalid"
	err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId:   platformRuleId,
		Layer:    &bad,
		LayerSet: true,
	})
	if err == nil {
		t.Fatal("expected ValidationError for invalid layer")
	}
	var ve *management.ValidationError
	if !errors.As(err, &ve) {
		t.Errorf("expected ValidationError, got %T: %v", err, err)
	}
}

func TestUpdateAlertRuleClassification_InvalidComponent(t *testing.T) {
	client, mockK8s := newClassificationClient(t)
	rule := makePlatformRelabeled()
	mockK8s.RelabeledRulesFunc = mockRelabeledRules(platformRuleId, rule)

	empty := ""
	err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId:       platformRuleId,
		Component:    &empty,
		ComponentSet: true,
	})
	if err == nil {
		t.Fatal("expected ValidationError for empty component")
	}
	var ve *management.ValidationError
	if !errors.As(err, &ve) {
		t.Errorf("expected ValidationError, got %T: %v", err, err)
	}
}

func TestUpdateAlertRuleClassification_InvalidComponentFrom(t *testing.T) {
	client, mockK8s := newClassificationClient(t)
	rule := makePlatformRelabeled()
	mockK8s.RelabeledRulesFunc = mockRelabeledRules(platformRuleId, rule)

	bad := "bad-label"
	err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId:           platformRuleId,
		ComponentFrom:    &bad,
		ComponentFromSet: true,
	})
	if err == nil {
		t.Fatal("expected ValidationError for invalid component_from")
	}
	var ve *management.ValidationError
	if !errors.As(err, &ve) {
		t.Errorf("expected ValidationError, got %T: %v", err, err)
	}
}

func TestUpdateAlertRuleClassification_InvalidLayerFrom(t *testing.T) {
	client, mockK8s := newClassificationClient(t)
	rule := makePlatformRelabeled()
	mockK8s.RelabeledRulesFunc = mockRelabeledRules(platformRuleId, rule)

	bad := "1layer"
	err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId:       platformRuleId,
		LayerFrom:    &bad,
		LayerFromSet: true,
	})
	if err == nil {
		t.Fatal("expected ValidationError for invalid layer_from")
	}
	var ve *management.ValidationError
	if !errors.As(err, &ve) {
		t.Errorf("expected ValidationError, got %T: %v", err, err)
	}
}

func TestUpdateAlertRuleClassification_NotFound(t *testing.T) {
	client, mockK8s := newClassificationClient(t)
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, _ string) (monitoringv1.Rule, bool) {
				return monitoringv1.Rule{}, false
			},
		}
	}

	val := "cluster"
	err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId:   "missing",
		Layer:    &val,
		LayerSet: true,
	})
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
}

func TestUpdateAlertRuleClassification_EmptyPayloadIsNoOp(t *testing.T) {
	client, mockK8s := newClassificationClient(t)
	rule := makePlatformRelabeled()
	mockK8s.RelabeledRulesFunc = mockRelabeledRules(platformRuleId, rule)

	if err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId: platformRuleId,
	}); err != nil {
		t.Fatalf("expected no-op but got error: %v", err)
	}
}

// --- Platform rules (ARC path) ---

func TestUpdateAlertRuleClassification_PlatformRule_CreatesARC(t *testing.T) {
	client, mockK8s := newClassificationClient(t)

	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			MonitoringNamespaces: map[string]bool{clTestPlatformNamespace: true},
		}
	}

	relabeled := makePlatformRelabeled()
	pr := makeClassificationPR(clTestPlatformNamespace, clTestRuleName, platformOriginal)

	mockK8s.RelabeledRulesFunc = mockRelabeledRules(platformRuleId, relabeled)
	prStore := &testutils.MockPrometheusRuleInterface{
		PrometheusRules: map[string]*monitoringv1.PrometheusRule{
			clTestPlatformNamespace + "/" + clTestRuleName: pr,
		},
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return prStore }

	arcStore := &testutils.MockAlertRelabelConfigInterface{}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface { return arcStore }

	component := "networking"
	layer := "cluster"
	if err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId:       platformRuleId,
		Component:    &component,
		ComponentSet: true,
		Layer:        &layer,
		LayerSet:     true,
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(arcStore.AlertRelabelConfigs) != 1 {
		t.Fatalf("expected 1 ARC, got %d", len(arcStore.AlertRelabelConfigs))
	}

	for _, arc := range arcStore.AlertRelabelConfigs {
		if arc.Labels[managementlabels.ARCLabelPrometheusRuleNameKey] != clTestRuleName {
			t.Errorf("ARC missing expected prometheus rule name label")
		}
		if arc.Labels[managementlabels.ARCLabelAlertNameKey] != "CannotRetrieveUpdates" {
			t.Errorf("ARC missing expected alert name label")
		}
		if arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey] != platformRuleId {
			t.Errorf("ARC missing expected alert rule ID annotation")
		}

		hasComponent, hasLayer, hasManagedBy := false, false, false
		for _, rc := range arc.Spec.Configs {
			if rc.Action == "Replace" && rc.TargetLabel == k8s.AlertRuleClassificationComponentKey {
				if rc.Replacement != "networking" {
					t.Errorf("expected component replacement %q, got %q", "networking", rc.Replacement)
				}
				hasComponent = true
			}
			if rc.Action == "Replace" && rc.TargetLabel == k8s.AlertRuleClassificationLayerKey {
				if rc.Replacement != "cluster" {
					t.Errorf("expected layer replacement %q, got %q", "cluster", rc.Replacement)
				}
				hasLayer = true
			}
			if rc.Action == "Replace" && rc.TargetLabel == managementlabels.ClassificationManagedByKey {
				hasManagedBy = true
			}
		}
		if !hasComponent {
			t.Error("ARC should have component replace config")
		}
		if !hasLayer {
			t.Error("ARC should have layer replace config")
		}
		if !hasManagedBy {
			t.Error("ARC should have managed-by replace config")
		}
	}
}

func TestUpdateAlertRuleClassification_PlatformRule_CreatesARCWithFromLabels(t *testing.T) {
	client, mockK8s := newClassificationClient(t)

	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			MonitoringNamespaces: map[string]bool{clTestPlatformNamespace: true},
		}
	}

	relabeled := makePlatformRelabeled()
	pr := makeClassificationPR(clTestPlatformNamespace, clTestRuleName, platformOriginal)

	mockK8s.RelabeledRulesFunc = mockRelabeledRules(platformRuleId, relabeled)
	prStore := &testutils.MockPrometheusRuleInterface{
		PrometheusRules: map[string]*monitoringv1.PrometheusRule{
			clTestPlatformNamespace + "/" + clTestRuleName: pr,
		},
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return prStore }

	arcStore := &testutils.MockAlertRelabelConfigInterface{}
	mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface { return arcStore }

	componentFrom := "namespace"
	layerFrom := "tier"
	if err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId:           platformRuleId,
		ComponentFrom:    &componentFrom,
		ComponentFromSet: true,
		LayerFrom:        &layerFrom,
		LayerFromSet:     true,
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(arcStore.AlertRelabelConfigs) != 1 {
		t.Fatalf("expected 1 ARC, got %d", len(arcStore.AlertRelabelConfigs))
	}

	for _, arc := range arcStore.AlertRelabelConfigs {
		hasComponentFrom, hasLayerFrom := false, false
		for _, rc := range arc.Spec.Configs {
			if rc.Action == "Replace" && rc.TargetLabel == k8s.AlertRuleClassificationComponentFromKey {
				if rc.Replacement != "namespace" {
					t.Errorf("expected component_from replacement %q, got %q", "namespace", rc.Replacement)
				}
				hasComponentFrom = true
			}
			if rc.Action == "Replace" && rc.TargetLabel == k8s.AlertRuleClassificationLayerFromKey {
				if rc.Replacement != "tier" {
					t.Errorf("expected layer_from replacement %q, got %q", "tier", rc.Replacement)
				}
				hasLayerFrom = true
			}
		}
		if !hasComponentFrom {
			t.Error("ARC should have component_from replace config")
		}
		if !hasLayerFrom {
			t.Error("ARC should have layer_from replace config")
		}
	}
}

// --- User-defined rules ---

func TestUpdateAlertRuleClassification_UserRule_NotAllowed(t *testing.T) {
	client, mockK8s := newClassificationClient(t)

	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			MonitoringNamespaces: map[string]bool{clTestPlatformNamespace: true},
		}
	}

	relabeled := makeUserRelabeled()
	mockK8s.RelabeledRulesFunc = mockRelabeledRules(userRuleId, relabeled)

	component := "team_a"
	err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
		RuleId:       userRuleId,
		Component:    &component,
		ComponentSet: true,
	})
	if err == nil {
		t.Fatal("expected NotAllowedError for user-defined rule classification")
	}
	var na *management.NotAllowedError
	if !errors.As(err, &na) {
		t.Errorf("expected NotAllowedError, got %T: %v", err, err)
	}
}

// --- ApplyDynamicClassification tests ---

func TestApplyDynamicClassification_DefaultsWhenNoFromLabels(t *testing.T) {
	c, l := management.ApplyDynamicClassification(nil, nil, "comp", "cluster")
	if c != "comp" {
		t.Errorf("expected %q, got %q", "comp", c)
	}
	if l != "cluster" {
		t.Errorf("expected %q, got %q", "cluster", l)
	}
}

func TestApplyDynamicClassification_UsesComponentFrom(t *testing.T) {
	ruleLabels := map[string]string{
		k8s.AlertRuleClassificationComponentFromKey: "name",
	}
	alertLabels := map[string]string{
		"name": "dns",
	}
	c, _ := management.ApplyDynamicClassification(ruleLabels, alertLabels, "default", "cluster")
	if c != "dns" {
		t.Errorf("expected %q, got %q", "dns", c)
	}
}

func TestApplyDynamicClassification_UsesLayerFrom(t *testing.T) {
	ruleLabels := map[string]string{
		k8s.AlertRuleClassificationLayerFromKey: "tier",
	}
	alertLabels := map[string]string{
		"tier": "Cluster",
	}
	_, l := management.ApplyDynamicClassification(ruleLabels, alertLabels, "comp", "namespace")
	if l != "cluster" {
		t.Errorf("expected %q (lowercased), got %q", "cluster", l)
	}
}

func TestApplyDynamicClassification_FallsBackWhenFromLabelMissing(t *testing.T) {
	ruleLabels := map[string]string{
		k8s.AlertRuleClassificationComponentFromKey: "missing_label",
	}
	c, _ := management.ApplyDynamicClassification(ruleLabels, map[string]string{}, "fallback", "cluster")
	if c != "fallback" {
		t.Errorf("expected fallback %q, got %q", "fallback", c)
	}
}
