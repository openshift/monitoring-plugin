package management

import (
	"context"
	"fmt"
	"maps"
	"math"
	"sort"
	"strings"
	"time"
	"unicode"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"
	"github.com/prometheus/prometheus/promql/parser"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// EnrichRules retrieves Prometheus rule groups and applies relabeling.
// Non-fatal endpoint failures are returned as warnings.
func (c *client) EnrichRules(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
	groups, warnings, err := c.k8sClient.PrometheusAlerts().FetchRules(ctx, req)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get prometheus rules: %w", err)
	}

	configs := c.k8sClient.RelabeledRules().Config()
	relabeledByAlert := indexRelabeledRules(c.k8sClient.RelabeledRules().List(ctx))
	labelFilters := k8s.LabelsWithoutNamespace(req.Labels)
	applyFilters := req.State != "" || len(labelFilters) > 0

	// Deduplicate rules that carry the same openshift_io_alert_rule_id across
	// groups. This occurs when the same PrometheusRule group name is defined in
	// multiple CRDs — Prometheus returns separate groups with identical rules
	// that hash to the same ID after enrichment.
	seenIDs := make(map[string]struct{})

	filteredGroups := make([]k8s.PrometheusRuleGroup, 0, len(groups))
	for _, group := range groups {
		filteredRules := make([]k8s.Rule, 0, len(group.Rules))

		for _, entry := range group.Rules {
			var rule *k8s.AlertingRule
			var ruleLabels map[string]string
			switch typed := entry.(type) {
			case *k8s.AlertingRule:
				// make a shallow copy to avoid modifying response in place
				copy := *typed
				rule = &copy
				rule.AlertingRuleEnabled = alertingRuleEnabled(rule, configs)
				applyRelabeledRuleLabels(rule, relabeledByAlert, configs)
				ruleLabels = rule.Labels
			case *k8s.RecordingRule:
				if applyFilters {
					continue
				}
				ruleLabels = typed.Labels
			default:
				return nil, nil, fmt.Errorf("unsupported rule type %T", entry)
			}

			if ruleID := ruleLabels[k8s.AlertRuleLabelId]; ruleID != "" {
				if _, seen := seenIDs[ruleID]; seen {
					continue
				}
				seenIDs[ruleID] = struct{}{}
			}
			if rule == nil {
				filteredRules = append(filteredRules, entry)
				continue
			}

			if len(rule.Alerts) == 0 {
				if applyFilters {
					continue
				}
				rule.Alerts = []k8s.PrometheusRuleAlert{}
				filteredRules = append(filteredRules, rule)
				continue
			}

			relabeledAlerts := make([]k8s.PrometheusRuleAlert, 0, len(rule.Alerts))
			for _, alert := range rule.Alerts {
				if alert.State == "pending" || alert.State == "firing" {
					if alert.Labels[k8s.AlertSourceLabel] != k8s.AlertSourceUser {
						// Apply relabeling to the "real" alert labels only; preserve plugin meta labels.
						src := alert.Labels[k8s.AlertSourceLabel]
						in := make(map[string]string, len(alert.Labels))
						for k, v := range alert.Labels {
							in[k] = v
						}
						delete(in, k8s.AlertSourceLabel)

						lb := labels.NewBuilder(labels.FromMap(in))
						keep := relabel.ProcessBuilder(lb, configs...)
						if !keep {
							continue
						}
						alert.Labels = lb.Labels().Map()
						if src != "" {
							alert.Labels[k8s.AlertSourceLabel] = src
						}
					}
				}

				if req.State != "" && alert.State != req.State {
					continue
				}
				if !ruleAlertLabelsMatch(labelFilters, &alert) {
					continue
				}
				relabeledAlerts = append(relabeledAlerts, alert)
			}
			rule.Alerts = relabeledAlerts

			if applyFilters && len(rule.Alerts) == 0 {
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

	return filteredGroups, warnings, nil
}

// alertingRuleEnabled reports whether platform relabeling retains the rule.
// A false result means alert suppression, not disabled Prometheus evaluation.
// User-workload rules are unaffected by platform relabeling.
func alertingRuleEnabled(rule *k8s.AlertingRule, configs []*relabel.Config) bool {
	if rule.Labels[k8s.AlertSourceLabel] == k8s.AlertSourceUser {
		return true
	}
	_, keep := relabeledRuleLabels(rule, configs)
	return keep
}

// relabeledRuleLabels applies the relabel configs to the served rule's labels,
// seeded the same way the relabeled-rules cache builds its entries: plugin meta
// labels are removed and the alertname is set from the rule name. It returns
// the processed labels and whether relabeling retains the rule.
func relabeledRuleLabels(rule *k8s.AlertingRule, configs []*relabel.Config) (map[string]string, bool) {
	lb := labels.NewBuilder(labels.FromMap(rule.Labels))
	lb.Del(k8s.AlertSourceLabel)
	lb.Set(managementlabels.AlertNameLabel, rule.Name)
	keep := relabel.ProcessBuilder(lb, configs...)
	return lb.Labels().Map(), keep
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

func applyRelabeledRuleLabels(rule *k8s.AlertingRule, relabeledByAlert map[string][]monitoringv1.Rule, configs []*relabel.Config) {
	if rule == nil || rule.Name == "" {
		return
	}

	// Preserve plugin meta labels added during API fetch.
	source := ""
	if rule.Labels != nil {
		source = rule.Labels[k8s.AlertSourceLabel]
	}

	match := findRelabeledMatch(rule, relabeledByAlert[rule.Name], configs)
	if match == nil || match.Labels == nil {
		return
	}

	// Replace rule labels with the relabeled cache version so that actions which
	// remove/rename labels (e.g. LabelDrop/LabelKeep/LabelMap) are faithfully reflected.
	labelsOut := make(map[string]string, len(match.Labels)+1)
	for k, v := range match.Labels {
		labelsOut[k] = v
	}
	if source != "" {
		labelsOut[k8s.AlertSourceLabel] = source
	}
	rule.Labels = labelsOut
}

// findRelabeledMatch returns the cached rule that corresponds to the served
// rule, or nil when there is no match or the match is ambiguous. A candidate
// matches when its alertname, expression, and duration match the served rule
// and the relabel configs transform the served rule's labels into the
// candidate's cached labels, mirroring how the cache is built. A rule that is
// missing from the cache (dropped, or not synced yet) therefore borrows
// nothing, and when relabeling erases the labels that distinguish same-name
// rules, no identity is guessed.
func findRelabeledMatch(rule *k8s.AlertingRule, candidates []monitoringv1.Rule, configs []*relabel.Config) *monitoringv1.Rule {
	var match *monitoringv1.Rule
	for i := range candidates {
		candidate := &candidates[i]
		if !promRuleMatchesSpec(rule, candidate) || !relabelOutcomeMatches(rule, candidate, configs) {
			continue
		}
		if match != nil {
			// Ambiguous: relabeling erased the distinguishing labels.
			return nil
		}
		match = candidate
	}
	return match
}

// relabelOutcomeMatches reports whether the relabel configs transform the
// served rule into the cached candidate. The cache applies the same configs to
// each rule's original labels, so a candidate with a different outcome belongs
// to another rule: a dropped rule is absent from the cache, and rules that
// differ in labels produce different outcomes. User workload rules are cached
// without relabeling, so their labels must match the candidate directly.
func relabelOutcomeMatches(rule *k8s.AlertingRule, candidate *monitoringv1.Rule, configs []*relabel.Config) bool {
	if rule.Labels[k8s.AlertSourceLabel] == k8s.AlertSourceUser {
		return maps.Equal(filterBusinessLabels(rule.Labels), filterBusinessLabels(candidate.Labels))
	}
	relabeled, keep := relabeledRuleLabels(rule, configs)
	return keep && maps.Equal(filterBusinessLabels(relabeled), filterBusinessLabels(candidate.Labels))
}

// promRuleMatchesSpec compares (alertname, expression, duration). Relabeling
// may modify rule labels (e.g. severity), so label identity is verified
// separately by relabelOutcomeMatches.
func promRuleMatchesSpec(rule *k8s.AlertingRule, candidate *monitoringv1.Rule) bool {
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
	return durationMatches(rule.Duration, candidate.For)
}

func canonicalizePromQL(in string) string {
	s := strings.TrimSpace(in)
	if s == "" {
		return ""
	}
	expr, err := parser.NewParser(parser.Options{}).ParseExpr(s)
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
	parsed, err := model.ParseDuration(string(*duration))
	if err != nil {
		return false
	}
	return math.Abs(time.Duration(parsed).Seconds()-seconds) < 0.001
}

func ruleAlertLabelsMatch(labels map[string]string, alert *k8s.PrometheusRuleAlert) bool {
	for key, value := range labels {
		if alertValue, exists := alert.Labels[key]; !exists || alertValue != value {
			return false
		}
	}

	return true
}
