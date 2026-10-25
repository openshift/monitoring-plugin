package management

import (
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func TestRuleWithStampedID_DoesNotMutateCallerLabels(t *testing.T) {
	original := map[string]string{"severity": "warning"}
	rule := monitoringv1.Rule{Alert: "CallerOwned", Labels: original}

	prepared := ruleWithStampedID(rule, "rule-id-1")
	if _, ok := original[k8s.AlertRuleLabelId]; ok {
		t.Fatal("ruleWithStampedID mutated the caller's Labels map")
	}
	if prepared.Labels[k8s.AlertRuleLabelId] != "rule-id-1" {
		t.Fatalf("stamped id missing: %+v", prepared.Labels)
	}
	if prepared.Labels["severity"] != "warning" {
		t.Fatalf("expected severity=warning, got %+v", prepared.Labels)
	}
}
