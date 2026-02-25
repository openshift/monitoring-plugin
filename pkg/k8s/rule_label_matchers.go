package k8s

import (
	"fmt"
	"strings"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql/parser"
)

const namespaceLabelKey = "namespace"

func compileRuleLabelMatchers(req GetRulesRequest) ([]*labels.Matcher, error) {
	var out []*labels.Matcher

	for k, v := range req.Labels {
		if strings.TrimSpace(k) == "" {
			continue
		}
		if k == namespaceLabelKey {
			continue
		}
		m, err := labels.NewMatcher(labels.MatchEqual, k, v)
		if err != nil {
			return nil, fmt.Errorf("invalid label matcher %q=%q: %w", k, v, err)
		}
		out = append(out, m)
	}

	for _, raw := range req.Matchers {
		sel := strings.TrimSpace(raw)
		if sel == "" {
			continue
		}
		if !strings.Contains(sel, "{") {
			sel = "{" + sel + "}"
		}
		matchers, err := parser.ParseMetricSelector(sel)
		if err != nil {
			return nil, fmt.Errorf("invalid matcher %q: %w", raw, err)
		}
		out = append(out, matchers...)
	}

	return out, nil
}

func filterRuleGroupsByLabelMatchers(groups []PrometheusRuleGroup, matchers []*labels.Matcher) []PrometheusRuleGroup {
	if len(matchers) == 0 || len(groups) == 0 {
		return groups
	}

	out := make([]PrometheusRuleGroup, 0, len(groups))
	for _, g := range groups {
		kept := make([]PrometheusRule, 0, len(g.Rules))
		for _, r := range g.Rules {
			if ruleMatchesLabelMatchers(r, matchers) {
				kept = append(kept, r)
			}
		}
		if len(kept) == 0 {
			continue
		}
		g.Rules = kept
		out = append(out, g)
	}

	return out
}

func ruleMatchesLabelMatchers(rule PrometheusRule, matchers []*labels.Matcher) bool {
	if len(matchers) == 0 {
		return true
	}

	for _, m := range matchers {
		val, ok := rule.Labels[m.Name]
		if !ok {
			// Prometheus semantics: negative matchers match missing labels.
			if m.Type == labels.MatchNotEqual || m.Type == labels.MatchNotRegexp {
				continue
			}
			return false
		}
		if !m.Matches(val) {
			return false
		}
	}

	return true
}

