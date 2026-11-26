package management_test

import (
	"context"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func TestUpdateAlertRuleLabels_IgnoresProtectedLabelsOnUserRule(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)

	var savedPR *monitoringv1.PrometheusRule
	pr := makePRWithRule("user-namespace", "user-rule", originalUserRule)
	pr.UpdateFunc = func(_ context.Context, p monitoringv1.PrometheusRule) error {
		savedPR = &p
		return nil
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return pr }

	fakeID := "fake-id"
	critical := "critical"
	labels := map[string]*string{
		k8s.AlertRuleLabelId: &fakeID,
		"severity":           &critical,
	}

	_, err := client.UpdateAlertRuleLabels(context.Background(), originalUserRuleId, labels)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if savedPR == nil {
		t.Fatal("expected PR to be updated")
	}

	savedLabels := savedPR.Spec.Groups[0].Rules[0].Labels
	if savedLabels[k8s.AlertRuleLabelId] == fakeID {
		t.Errorf("protected label %q must not be overridden by the request", k8s.AlertRuleLabelId)
	}
	if savedLabels["severity"] != "critical" {
		t.Errorf("expected severity=critical, got %q", savedLabels["severity"])
	}
}

// TestUpdateAlertRuleLabels_IgnoresProvenanceLabelsOnUserRule guards against
// regressions where a labels update request could overwrite the internal
// provenance labels (PrometheusRule namespace/name, managed-by markers) that
// isPreviewProvenanceLabel hides from preview diffs but isProtectedLabel does
// not cover on its own.
func TestUpdateAlertRuleLabels_IgnoresProvenanceLabelsOnUserRule(t *testing.T) {
	client, mockK8s := newUpdateUserDefinedClient(t)
	mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, udUserRule)

	var savedPR *monitoringv1.PrometheusRule
	pr := makePRWithRule("user-namespace", "user-rule", originalUserRule)
	pr.UpdateFunc = func(_ context.Context, p monitoringv1.PrometheusRule) error {
		savedPR = &p
		return nil
	}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface { return pr }

	bogusManagedBy := "operator"
	critical := "critical"
	labels := map[string]*string{
		managementlabels.RuleManagedByLabel: &bogusManagedBy,
		"severity":                          &critical,
	}

	_, err := client.UpdateAlertRuleLabels(context.Background(), originalUserRuleId, labels)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if savedPR == nil {
		t.Fatal("expected PR to be updated")
	}

	savedLabels := savedPR.Spec.Groups[0].Rules[0].Labels
	if savedLabels[managementlabels.RuleManagedByLabel] == bogusManagedBy {
		t.Errorf("provenance label %q must not be overridden by the request", managementlabels.RuleManagedByLabel)
	}
	if savedLabels["severity"] != "critical" {
		t.Errorf("expected severity=critical, got %q", savedLabels["severity"])
	}
}
