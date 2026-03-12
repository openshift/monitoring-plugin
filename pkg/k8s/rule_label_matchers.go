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
		if !strings.HasPrefix(sel, "{") || !strings.HasSuffix(sel, "}") {
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
			// Prometheus treats absent labels as "". Evaluate the matcher
			// against "" so that negative matchers like missing!="" or
			// missing!~".*" are correctly rejected.
			if !m.Matches("") {
				return false
			}
			continue
		}
		if !m.Matches(val) {
			return false
		}
	}

	return true
}

// matchesAlertState returns whether an alert state matches the requested filter.
// An empty requestedState matches all states. "firing" matches both "firing" and
// "silenced" alerts (Alertmanager silences are a sub-state of firing).
func matchesAlertState(requestedState string, alertState string) bool {
	if requestedState == "" {
		return true
	}
	if requestedState == "firing" {
		return alertState == "firing" || alertState == "silenced"
	}
	return alertState == requestedState
}

// labelsMatch returns true when every label in the request is present on the alert
// with the same value.
func labelsMatch(req *GetAlertsRequest, alert *PrometheusAlert) bool {
	for key, value := range req.Labels {
		if alertValue, exists := alert.Labels[key]; !exists || alertValue != value {
			return false
		}
	}
	return true
}
