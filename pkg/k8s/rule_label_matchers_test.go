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

func TestParseRuleMatchers_InvalidSyntax(t *testing.T) {
	err := ParseRuleMatchers([]string{`severity=`})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestLabelsWithoutNamespace(t *testing.T) {
	in := map[string]string{
		"namespace": "ns1",
		"severity":  "critical",
	}
	got := LabelsWithoutNamespace(in)
	if _, found := got["namespace"]; found {
		t.Fatal("expected namespace key to be removed")
	}
	if got["severity"] != "critical" {
		t.Errorf("expected severity=critical, got %q", got["severity"])
	}
	if in["namespace"] != "ns1" {
		t.Fatal("expected original map to keep namespace")
	}
}
