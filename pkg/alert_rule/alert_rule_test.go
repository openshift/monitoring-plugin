package alertrule_test

import (
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
)

func durPtr(s monitoringv1.Duration) *monitoringv1.Duration { return &s }

// TestNormalizeExpr_BasicCanonicalization verifies that the PromQL parser
// produces a deterministic canonical form.
func TestNormalizeExpr_BasicCanonicalization(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "leading/trailing whitespace stripped",
			in:   "  up  ",
			want: "up",
		},
		{
			name: "extra spaces between tokens collapsed",
			in:   "up  ==  0",
			want: "up == 0",
		},
		{
			name: "label selector formatting normalised",
			in:   `up{job="prometheus"}`,
			want: `up{job="prometheus"}`,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := alertrule.NormalizeExpr(tc.in)
			if got != tc.want {
				t.Errorf("NormalizeExpr(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// TestNormalizeExpr_PreservesWhitespaceInsideStringLiteral verifies that
// whitespace inside a quoted label value is NOT collapsed.  This was the bug
// with the previous strings.Fields-based implementation.
func TestNormalizeExpr_PreservesWhitespaceInsideStringLiteral(t *testing.T) {
	single := `up{job="job 1"}`
	double := `up{job="job  1"}`

	normSingle := alertrule.NormalizeExpr(single)
	normDouble := alertrule.NormalizeExpr(double)

	if normSingle == normDouble {
		t.Errorf("NormalizeExpr collapsed whitespace inside quoted string: %q == %q", normSingle, normDouble)
	}
}

// TestNormalizeExpr_UnparseableExprFallback checks that an expression that the
// PromQL parser cannot parse (e.g. a recording rule metric name alone) is
// returned trimmed without crashing.
func TestNormalizeExpr_UnparseableExprFallback(t *testing.T) {
	in := "  some_record_rule  "
	got := alertrule.NormalizeExpr(in)
	want := "some_record_rule"
	if got != want {
		t.Errorf("NormalizeExpr(%q) = %q, want %q", in, got, want)
	}
}

// TestGetAlertingRuleId_Stability checks that the same rule always produces
// the same ID.
func TestGetAlertingRuleId_Stability(t *testing.T) {
	rule := &monitoringv1.Rule{
		Alert: "TestAlert",
		Expr:  intstr.FromString("up == 0"),
		For:   durPtr("5m"),
		Labels: map[string]string{
			"severity": "warning",
		},
	}
	id1 := alertrule.GetAlertingRuleId(rule)
	id2 := alertrule.GetAlertingRuleId(rule)
	if id1 != id2 {
		t.Errorf("GetAlertingRuleId is not stable: %q != %q", id1, id2)
	}
	if id1 == "" {
		t.Error("GetAlertingRuleId returned empty string")
	}
}

// TestGetAlertingRuleId_SystemLabelExcluded verifies that changing an
// openshift_io_* label (system label) does not change the ID.
func TestGetAlertingRuleId_SystemLabelExcluded(t *testing.T) {
	base := &monitoringv1.Rule{
		Alert: "TestAlert",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity": "warning",
		},
	}
	withSystem := &monitoringv1.Rule{
		Alert: "TestAlert",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity":                          "warning",
			"openshift_io_rule_managed_by":      "operator",
			"openshift_io_alerting_rule_id_key": "some-id",
		},
	}
	if alertrule.GetAlertingRuleId(base) != alertrule.GetAlertingRuleId(withSystem) {
		t.Error("system labels should not affect the rule ID")
	}
}

// TestGetAlertingRuleId_DifferentRulesDifferentIds verifies that two rules
// with different expressions produce different IDs.
func TestGetAlertingRuleId_DifferentRulesDifferentIds(t *testing.T) {
	r1 := &monitoringv1.Rule{Alert: "A", Expr: intstr.FromString("up == 0")}
	r2 := &monitoringv1.Rule{Alert: "A", Expr: intstr.FromString("up == 1")}
	if alertrule.GetAlertingRuleId(r1) == alertrule.GetAlertingRuleId(r2) {
		t.Error("different expressions should produce different IDs")
	}
}

// TestGetAlertingRuleId_QuotedStringDistinction verifies that two rules whose
// only difference is whitespace inside a quoted label value get different IDs.
func TestGetAlertingRuleId_QuotedStringDistinction(t *testing.T) {
	r1 := &monitoringv1.Rule{Alert: "A", Expr: intstr.FromString(`up{job="job 1"}`)}
	r2 := &monitoringv1.Rule{Alert: "A", Expr: intstr.FromString(`up{job="job  1"}`)}
	if alertrule.GetAlertingRuleId(r1) == alertrule.GetAlertingRuleId(r2) {
		t.Error("selectors with different quoted-string whitespace should have different IDs")
	}
}

// TestGetAlertingRuleId_EmptyRule verifies that a rule with no alert or record
// name returns an empty string.
func TestGetAlertingRuleId_EmptyRule(t *testing.T) {
	rule := &monitoringv1.Rule{Expr: intstr.FromString("up")}
	if id := alertrule.GetAlertingRuleId(rule); id != "" {
		t.Errorf("expected empty ID for unnamed rule, got %q", id)
	}
}
