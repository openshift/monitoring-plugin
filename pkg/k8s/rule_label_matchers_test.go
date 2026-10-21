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
	if !ruleMatchesLabelMatchers(map[string]string{}, neg) {
		t.Fatalf("expected negative matcher to match missing label")
	}

	pos, err := compileRuleLabelMatchers(GetRulesRequest{
		Matchers: []string{`missing="x"`},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if ruleMatchesLabelMatchers(map[string]string{}, pos) {
		t.Fatalf("expected positive matcher not to match missing label")
	}
}

func TestFilterRuleGroupsByLabelMatchers_MixedRuleKinds(t *testing.T) {
	matchers, err := compileRuleLabelMatchers(GetRulesRequest{
		Labels: map[string]string{"severity": "critical"},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	alerting := &AlertingRule{Name: "AlertA", Type: RuleTypeAlerting, Labels: map[string]string{"severity": "critical"}}
	recording := &RecordingRule{Name: "record:foo", Type: RuleTypeRecording, Labels: map[string]string{"severity": "critical"}}
	groups := []PrometheusRuleGroup{
		{
			Name: "mixed",
			Rules: []Rule{
				alerting,
				&AlertingRule{Name: "AlertB", Type: RuleTypeAlerting, Labels: map[string]string{"severity": "warning"}},
				recording,
				&RecordingRule{Name: "record:bar", Type: RuleTypeRecording},
			},
		},
		{Name: "filtered", Rules: []Rule{&RecordingRule{Name: "record:baz", Type: RuleTypeRecording}}},
	}

	got := filterRuleGroupsByLabelMatchers(groups, matchers)
	if len(got) != 1 || got[0].Name != "mixed" || len(got[0].Rules) != 2 {
		t.Fatalf("expected mixed group with 2 rules, got %+v", got)
	}
	if got[0].Rules[0] != alerting || got[0].Rules[1] != recording {
		t.Errorf("expected matching alerting and recording rule pointers, got %+v", got[0].Rules)
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

func TestParseRuleMatcherSelectors_InvalidSyntax(t *testing.T) {
	_, err := ParseRuleMatcherSelectors([]string{`severity=`})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	want := `invalid matcher "severity=": 1:11: parse error: unexpected "}" in label matching, expected string`
	if err.Error() != want {
		t.Fatalf("error = %q, want %q", err.Error(), want)
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
