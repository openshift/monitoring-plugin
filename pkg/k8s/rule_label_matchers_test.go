package k8s

import "testing"

func TestCompileRuleLabelMatchers_IgnoresNamespaceLabel(t *testing.T) {
	matchers, err := compileRuleLabelMatchers(GetRulesRequest{
		Labels: map[string]string{
			"namespace": "ns-a",
			"severity":  "critical",
		},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(matchers) != 1 {
		t.Fatalf("expected 1 matcher (severity), got %d", len(matchers))
	}
	if matchers[0].Name != "severity" {
		t.Fatalf("expected matcher for severity, got %q", matchers[0].Name)
	}
}

func TestRuleMatchesLabelMatchers_PrometheusMissingLabelSemantics(t *testing.T) {
	neg, err := compileRuleLabelMatchers(GetRulesRequest{
		Matchers: []string{`missing!="x"`},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !ruleMatchesLabelMatchers(PrometheusRule{Labels: map[string]string{}}, neg) {
		t.Fatalf("expected negative matcher to match missing label")
	}

	pos, err := compileRuleLabelMatchers(GetRulesRequest{
		Matchers: []string{`missing="x"`},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if ruleMatchesLabelMatchers(PrometheusRule{Labels: map[string]string{}}, pos) {
		t.Fatalf("expected positive matcher not to match missing label")
	}
}

func TestCompileRuleLabelMatchers_AcceptsSelectorBody(t *testing.T) {
	matchers, err := compileRuleLabelMatchers(GetRulesRequest{
		Matchers: []string{`severity=~"warning|critical"`},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(matchers) != 1 {
		t.Fatalf("expected 1 matcher, got %d", len(matchers))
	}
	if matchers[0].Name != "severity" {
		t.Fatalf("expected severity matcher, got %q", matchers[0].Name)
	}
}

