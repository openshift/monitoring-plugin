package managementrouter_test

import (
	"encoding/json"
	"testing"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
)

func TestAlertRuleClassificationPatch_FieldOmitted(t *testing.T) {
	var p managementrouter.AlertRuleClassificationPatch
	if err := json.Unmarshal([]byte(`{}`), &p); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.ComponentSet {
		t.Error("expected ComponentSet to be false when field is omitted")
	}
	if p.Component != nil {
		t.Error("expected Component to be nil when field is omitted")
	}
}

func TestAlertRuleClassificationPatch_FieldExplicitNull(t *testing.T) {
	var p managementrouter.AlertRuleClassificationPatch
	if err := json.Unmarshal([]byte(`{"openshift_io_alert_rule_component":null}`), &p); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !p.ComponentSet {
		t.Error("expected ComponentSet to be true when field is explicitly null")
	}
	if p.Component != nil {
		t.Error("expected Component to be nil when field is explicitly null")
	}
}

func TestAlertRuleClassificationPatch_FieldString(t *testing.T) {
	var p managementrouter.AlertRuleClassificationPatch
	if err := json.Unmarshal([]byte(`{"openshift_io_alert_rule_component":"team-x"}`), &p); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !p.ComponentSet {
		t.Error("expected ComponentSet to be true when field is a string")
	}
	if p.Component == nil {
		t.Fatal("expected Component to be non-nil when field is a string")
	}
	if *p.Component != "team-x" {
		t.Errorf("expected Component %q, got %q", "team-x", *p.Component)
	}
}
