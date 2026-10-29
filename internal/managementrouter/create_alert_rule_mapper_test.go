package managementrouter

import (
	"testing"

	"k8s.io/apimachinery/pkg/util/intstr"
)

func TestAlertRuleSpecToMonitoringV1_AlertFields(t *testing.T) {
	alert := "MyAlert"
	expr := "up == 0"
	forDur := "5m"
	keepFiringFor := "10m"
	labels := map[string]string{"severity": "warning"}
	annotations := map[string]string{"summary": "down"}

	spec := AlertRuleSpec{
		Alert:         &alert,
		Expr:          &expr,
		For:           &forDur,
		KeepFiringFor: &keepFiringFor,
		Labels:        &labels,
		Annotations:   &annotations,
	}

	rule := alertRuleSpecToMonitoringV1(spec)

	if rule.Alert != alert {
		t.Errorf("Alert: want %q, got %q", alert, rule.Alert)
	}
	if rule.Expr != intstr.FromString(expr) {
		t.Errorf("Expr: want %v, got %v", intstr.FromString(expr), rule.Expr)
	}
	if rule.For == nil || string(*rule.For) != forDur {
		t.Errorf("For: want %q, got %v", forDur, rule.For)
	}
	if rule.KeepFiringFor == nil || string(*rule.KeepFiringFor) != keepFiringFor {
		t.Errorf("KeepFiringFor: want %q, got %v", keepFiringFor, rule.KeepFiringFor)
	}
	if rule.Labels["severity"] != "warning" {
		t.Errorf("Labels: want severity=warning, got %v", rule.Labels)
	}
	if rule.Annotations["summary"] != "down" {
		t.Errorf("Annotations: want summary=down, got %v", rule.Annotations)
	}
}

func TestAlertRuleSpecToMonitoringV1_RecordRule(t *testing.T) {
	record := "job:up:sum"
	expr := "sum(up) by (job)"

	spec := AlertRuleSpec{
		Record: &record,
		Expr:   &expr,
	}

	rule := alertRuleSpecToMonitoringV1(spec)

	if rule.Record != record {
		t.Errorf("Record: want %q, got %q", record, rule.Record)
	}
	if rule.Alert != "" {
		t.Errorf("Alert should be empty for record rule, got %q", rule.Alert)
	}
	if rule.For != nil {
		t.Errorf("For should be nil when not set, got %v", rule.For)
	}
}

func TestAlertRuleSpecToMonitoringV1_NilOptionalFields(t *testing.T) {
	// Only required-ish field: nothing is actually required at the spec level.
	// Verify zero values when optional pointers are nil.
	rule := alertRuleSpecToMonitoringV1(AlertRuleSpec{})

	if rule.Alert != "" {
		t.Errorf("expected empty Alert, got %q", rule.Alert)
	}
	if rule.Record != "" {
		t.Errorf("expected empty Record, got %q", rule.Record)
	}
	if rule.Expr != (intstr.IntOrString{}) {
		t.Errorf("expected zero Expr, got %v", rule.Expr)
	}
	if rule.For != nil {
		t.Errorf("expected nil For, got %v", rule.For)
	}
	if rule.KeepFiringFor != nil {
		t.Errorf("expected nil KeepFiringFor, got %v", rule.KeepFiringFor)
	}
	if rule.Labels != nil {
		t.Errorf("expected nil Labels, got %v", rule.Labels)
	}
	if rule.Annotations != nil {
		t.Errorf("expected nil Annotations, got %v", rule.Annotations)
	}
}

func TestAlertRuleSpecToMonitoringV1_ForTypeMapped(t *testing.T) {
	forDur := "2m30s"
	spec := AlertRuleSpec{For: &forDur}
	rule := alertRuleSpecToMonitoringV1(spec)

	if rule.For == nil {
		t.Fatal("expected non-nil For")
	}
	if string(*rule.For) != forDur {
		t.Errorf("For: want %q, got %q", forDur, string(*rule.For))
	}
}

func TestPrometheusRuleTargetToOptions_WithGroupName(t *testing.T) {
	group := "custom-group"
	target := PrometheusRuleTarget{
		PrometheusRuleName:      "my-rule",
		PrometheusRuleNamespace: "my-ns",
		GroupName:               &group,
	}

	opts := prometheusRuleTargetToOptions(target)

	if opts.Name != "my-rule" {
		t.Errorf("Name: want 'my-rule', got %q", opts.Name)
	}
	if opts.Namespace != "my-ns" {
		t.Errorf("Namespace: want 'my-ns', got %q", opts.Namespace)
	}
	if opts.GroupName != "custom-group" {
		t.Errorf("GroupName: want 'custom-group', got %q", opts.GroupName)
	}
}

func TestPrometheusRuleTargetToOptions_WithoutGroupName(t *testing.T) {
	target := PrometheusRuleTarget{
		PrometheusRuleName:      "my-rule",
		PrometheusRuleNamespace: "my-ns",
	}

	opts := prometheusRuleTargetToOptions(target)

	if opts.GroupName != "" {
		t.Errorf("GroupName should be empty when nil, got %q", opts.GroupName)
	}
}
