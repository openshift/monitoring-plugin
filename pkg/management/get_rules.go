package management

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
	"unicode"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"
	"github.com/prometheus/prometheus/promql/parser"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func (c *client) GetRules(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
	groups, err := c.k8sClient.PrometheusAlerts().GetRules(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get prometheus rules: %w", err)
	}

	configs := c.k8sClient.RelabeledRules().Config()
	relabeledByAlert := indexRelabeledRules(c.k8sClient.RelabeledRules().List(ctx))
	applyFilters := req.State != "" || len(req.Labels) > 0

	// Deduplicate rules that carry the same openshift_io_alert_rule_id across
	// groups. This occurs when the same PrometheusRule group name is defined in
	// multiple CRDs — Prometheus returns separate groups with identical rules
	// that hash to the same ID after enrichment.
	seenIDs := make(map[string]struct{})

	filteredGroups := make([]k8s.PrometheusRuleGroup, 0, len(groups))
	for groupIdx := range groups {
		group := groups[groupIdx]
		filteredRules := make([]k8s.PrometheusRule, 0, len(group.Rules))

		for ruleIdx := range group.Rules {
			rule := group.Rules[ruleIdx]
			if applyFilters && rule.Type != k8s.RuleTypeAlerting {
				continue
			}
			applyRelabeledRuleLabels(&rule, relabeledByAlert)

			if ruleID := rule.Labels[k8s.AlertRuleLabelId]; ruleID != "" {
				if _, seen := seenIDs[ruleID]; seen {
					continue
				}
				seenIDs[ruleID] = struct{}{}
			}

			if len(rule.Alerts) == 0 {
				if applyFilters && rule.Type == k8s.RuleTypeAlerting {
					continue
				}
				filteredRules = append(filteredRules, rule)
				continue
			}

			relabeledAlerts := make([]k8s.PrometheusRuleAlert, 0, len(rule.Alerts))
			for _, alert := range rule.Alerts {
				if alert.State == "pending" || alert.State == "firing" {
					if alert.Labels[k8s.AlertSourceLabel] != k8s.AlertSourceUser {
						relabeledLabels, keep := relabel.Process(labels.FromMap(alert.Labels), configs...)
						if !keep {
							continue
						}
						alert.Labels = relabeledLabels.Map()
					}
				}

				if req.State != "" && alert.State != req.State {
					continue
				}
				if !ruleAlertLabelsMatch(&req, &alert) {
					continue
				}
				relabeledAlerts = append(relabeledAlerts, alert)
			}
			rule.Alerts = relabeledAlerts

			if applyFilters && rule.Type == k8s.RuleTypeAlerting && len(rule.Alerts) == 0 {
				continue
			}

			filteredRules = append(filteredRules, rule)
		}

		group.Rules = filteredRules
		if applyFilters && len(group.Rules) == 0 {
			continue
		}
		filteredGroups = append(filteredGroups, group)
	}

	return filteredGroups, nil
}

func indexRelabeledRules(rules []monitoringv1.Rule) map[string][]monitoringv1.Rule {
	byAlert := make(map[string][]monitoringv1.Rule, len(rules))
	for _, rule := range rules {
		alertName := rule.Alert
		if alertName == "" && rule.Labels != nil {
			alertName = rule.Labels[managementlabels.AlertNameLabel]
		}
		if alertName == "" {
			continue
		}
		byAlert[alertName] = append(byAlert[alertName], rule)
	}
	return byAlert
}

func relabeledAlertName(rule *monitoringv1.Rule) string {
	if rule == nil {
		return ""
	}
	if rule.Alert != "" {
		return rule.Alert
	}
	if rule.Labels != nil {
		return rule.Labels[managementlabels.AlertNameLabel]
	}
	return ""
}

func applyRelabeledRuleLabels(rule *k8s.PrometheusRule, relabeledByAlert map[string][]monitoringv1.Rule) {
	if rule == nil || rule.Name == "" || rule.Type == k8s.RuleTypeRecording {
		return
	}

	match := findRelabeledMatch(rule, relabeledByAlert[rule.Name])
	if match == nil || match.Labels == nil {
		return
	}

	if rule.Labels == nil {
		rule.Labels = make(map[string]string)
	}

	// Overlay non-empty labels from the relabeled cache. This reflects ARC-applied
	// changes (e.g. severity updates) while never clearing an existing label with
	// an empty value from the cache.
	for k, v := range match.Labels {
		if v != "" {
			rule.Labels[k] = v
		}
	}
}

func findRelabeledMatch(rule *k8s.PrometheusRule, candidates []monitoringv1.Rule) *monitoringv1.Rule {
	// Strict match first (preserves correctness when multiple rules share alertname).
	for i := range candidates {
		candidate := &candidates[i]
		if promRuleMatchesRelabeled(rule, candidate) {
			return candidate
		}
	}

	// If relabeling modified rule labels (e.g. severity), strict label matching may fail.
	// Retry on a best-effort basis using (alertname, expr, for) only. If this is ambiguous,
	// do not guess.
	var relaxed *monitoringv1.Rule
	for i := range candidates {
		candidate := &candidates[i]
		if rule == nil || candidate == nil {
			continue
		}
		candidateName := relabeledAlertName(candidate)
		if rule.Name == "" || candidateName == "" || rule.Name != candidateName {
			continue
		}
		if canonicalizePromQL(rule.Query) != canonicalizePromQL(candidate.Expr.String()) {
			continue
		}
		if !durationMatches(rule.Duration, candidate.For) {
			continue
		}
		if relaxed != nil {
			// ambiguous
			relaxed = nil
			break
		}
		relaxed = candidate
	}
	if relaxed != nil {
		return relaxed
	}

	// Fallback: if alertname is globally unique, avoid brittle PromQL/metadata matching.
	// This helps when Prometheus stringifies PromQL differently than PrometheusRule YAML
	// (e.g. label matcher ordering).
	if len(candidates) == 1 {
		return &candidates[0]
	}
	return nil
}

func promRuleMatchesRelabeled(rule *k8s.PrometheusRule, candidate *monitoringv1.Rule) bool {
	if rule == nil || candidate == nil {
		return false
	}
	candidateName := relabeledAlertName(candidate)
	if rule.Name == "" || candidateName == "" || rule.Name != candidateName {
		return false
	}
	if canonicalizePromQL(rule.Query) != canonicalizePromQL(candidate.Expr.String()) {
		return false
	}
	if !durationMatches(rule.Duration, candidate.For) {
		return false
	}
	if !stringMapEqual(filterBusinessLabels(rule.Labels), filterBusinessLabels(candidate.Labels)) {
		return false
	}
	return true
}

func canonicalizePromQL(in string) string {
	s := strings.TrimSpace(in)
	if s == "" {
		return ""
	}
	expr, err := parser.ParseExpr(s)
	if err == nil && expr != nil {
		parser.Inspect(expr, func(node parser.Node, _ []parser.Node) error {
			switch n := node.(type) {
			case *parser.VectorSelector:
				sort.Slice(n.LabelMatchers, func(i, j int) bool {
					mi, mj := n.LabelMatchers[i], n.LabelMatchers[j]
					if mi == nil || mj == nil {
						return mi != nil
					}
					if mi.Name != mj.Name {
						return mi.Name < mj.Name
					}
					if mi.Type != mj.Type {
						return mi.Type < mj.Type
					}
					return mi.Value < mj.Value
				})
			case *parser.AggregateExpr:
				sort.Strings(n.Grouping)
			case *parser.BinaryExpr:
				if n.VectorMatching != nil {
					sort.Strings(n.VectorMatching.MatchingLabels)
					sort.Strings(n.VectorMatching.Include)
				}
			}
			return nil
		})

		return expr.String()
	}
	return normalizeSpaceOutsideQuotes(s)
}

func normalizeSpaceOutsideQuotes(in string) string {
	if in == "" {
		return ""
	}
	in = strings.TrimSpace(in)

	var b strings.Builder
	b.Grow(len(in))

	inQuote := false
	escaped := false
	pendingSpace := false
	lastNoSpaceToken := false

	isNoSpaceToken := func(r rune) bool {
		switch r {
		case '(', ')', '{', '}', ',', '+', '-', '*', '/', '%', '^', '=', '!', '<', '>':
			return true
		default:
			return false
		}
	}

	for _, r := range in {
		if escaped {
			if pendingSpace {
				if !lastNoSpaceToken {
					b.WriteByte(' ')
				}
				pendingSpace = false
			}
			b.WriteRune(r)
			escaped = false
			lastNoSpaceToken = false
			continue
		}

		if inQuote && r == '\\' {
			if pendingSpace {
				if !lastNoSpaceToken {
					b.WriteByte(' ')
				}
				pendingSpace = false
			}
			b.WriteRune(r)
			escaped = true
			lastNoSpaceToken = false
			continue
		}

		if r == '"' {
			if pendingSpace {
				if !lastNoSpaceToken {
					b.WriteByte(' ')
				}
				pendingSpace = false
			}
			inQuote = !inQuote
			b.WriteRune(r)
			lastNoSpaceToken = false
			continue
		}

		if !inQuote && unicode.IsSpace(r) {
			pendingSpace = true
			continue
		}

		if pendingSpace && !lastNoSpaceToken && !isNoSpaceToken(r) {
			b.WriteByte(' ')
		}
		pendingSpace = false

		b.WriteRune(r)
		lastNoSpaceToken = !inQuote && isNoSpaceToken(r)
	}

	return strings.TrimSpace(b.String())
}

func durationMatches(seconds float64, duration *monitoringv1.Duration) bool {
	if duration == nil {
		return seconds == 0
	}
	parsed, err := time.ParseDuration(string(*duration))
	if err != nil {
		return false
	}
	return math.Abs(parsed.Seconds()-seconds) < 0.001
}

func stringMapEqual(a, b map[string]string) bool {
	if len(a) == 0 && len(b) == 0 {
		return true
	}
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}

func ruleAlertLabelsMatch(req *k8s.GetRulesRequest, alert *k8s.PrometheusRuleAlert) bool {
	for key, value := range req.Labels {
		if alertValue, exists := alert.Labels[key]; !exists || alertValue != value {
			return false
		}
	}

	return true
}
