package management_test

import (
	"context"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
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
