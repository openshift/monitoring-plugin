package management_test

import (
	"context"
	"maps"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/relabel"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// grFixture builds a management client with a PrometheusAlerts mock returning
// the given groups and a RelabeledRules mock returning the given configs/rules.
type grFixture struct {
	groups        []k8s.PrometheusRuleGroup
	relabelRules  []monitoringv1.Rule
	relabelConfig []*relabel.Config
}

func (f grFixture) client(t *testing.T) management.Client {
	t.Helper()
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
					return f.groups, nil, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc:   func(_ context.Context) []monitoringv1.Rule { return f.relabelRules },
				ConfigFunc: func() []*relabel.Config { return f.relabelConfig },
			}
		},
	}
	return management.New(context.Background(), mockK8s)
}

// threeAlertGroup returns a rule group containing one alerting rule with
// firing Alert1, pending Alert2, and inactive Alert3.
func threeAlertGroup() []k8s.PrometheusRuleGroup {
	return []k8s.PrometheusRuleGroup{
		{
			Name: "group-a",
			Rules: []k8s.Rule{
				&k8s.AlertingRule{
					Name: "rule-a",
					Type: k8s.RuleTypeAlerting,
					Alerts: []k8s.PrometheusRuleAlert{
						{State: "firing", Labels: map[string]string{"alertname": "Alert1", "severity": "warning"}},
						{State: "pending", Labels: map[string]string{"alertname": "Alert2", "severity": "critical"}},
						{State: "inactive", Labels: map[string]string{"alertname": "Alert3", "severity": "warning"}},
					},
				},
			},
		},
	}
}

func dropAlert2ReplaceAlert1Severity() []*relabel.Config {
	return []*relabel.Config{
		{
			SourceLabels:         model.LabelNames{"alertname"},
			Regex:                relabel.MustNewRegexp("Alert2"),
			Action:               relabel.Drop,
			NameValidationScheme: model.UTF8Validation,
		},
		{
			SourceLabels:         model.LabelNames{"alertname"},
			Regex:                relabel.MustNewRegexp("Alert1"),
			TargetLabel:          "severity",
			Replacement:          "critical",
			Action:               relabel.Replace,
			NameValidationScheme: model.UTF8Validation,
		},
	}
}

func TestEnrichRules_AlertingRuleEnabled(t *testing.T) {
	stamp := relabel.DefaultRelabelConfig
	stamp.NameValidationScheme = model.UTF8Validation
	stamp.SourceLabels = model.LabelNames{"alertname", "severity"}
	stamp.Regex = relabel.MustNewRegexp("TestAlert;warning")
	stamp.TargetLabel = k8s.AlertRuleLabelId
	stamp.Replacement = "test-rule-id"
	drop := relabel.DefaultRelabelConfig
	drop.Action = relabel.Drop
	drop.SourceLabels = model.LabelNames{k8s.AlertRuleLabelId}
	drop.Regex = relabel.MustNewRegexp("test-rule-id")
	replace := relabel.DefaultRelabelConfig
	replace.NameValidationScheme = model.UTF8Validation
	replace.TargetLabel = "severity"
	replace.Replacement = "critical"
	keep := relabel.DefaultRelabelConfig
	keep.Action = relabel.Keep
	keep.SourceLabels = model.LabelNames{"alertname"}
	keep.Regex = relabel.MustNewRegexp("OtherAlert")
	appendSeverity := replace
	appendSeverity.SourceLabels = model.LabelNames{"severity"}
	appendSeverity.Replacement = "${1}-changed"
	dropTwiceRelabeled := drop
	dropTwiceRelabeled.SourceLabels = model.LabelNames{"severity"}
	dropTwiceRelabeled.Regex = relabel.MustNewRegexp("warning-changed-changed")
	dropBySource := drop
	dropBySource.SourceLabels = model.LabelNames{k8s.AlertSourceLabel}
	dropBySource.Regex = relabel.MustNewRegexp(k8s.AlertSourcePlatform)

	for _, tc := range []struct {
		name         string
		source       string
		state        string
		configs      []*relabel.Config
		cachedLabels map[string]string
		enabled      bool
	}{
		{name: "no configs", enabled: true},
		{name: "inactive dropped rule", state: "inactive", configs: []*relabel.Config{&stamp, &drop}},
		{name: "pending dropped rule", state: "pending", configs: []*relabel.Config{&stamp, &drop}},
		{name: "firing dropped rule", state: "firing", configs: []*relabel.Config{&stamp, &drop}},
		{name: "platform dropped rule", source: k8s.AlertSourcePlatform, configs: []*relabel.Config{&stamp, &drop}},
		{name: "user workload ignores platform drop", source: k8s.AlertSourceUser, configs: []*relabel.Config{&stamp, &drop}, enabled: true},
		{name: "restored rule", configs: []*relabel.Config{&stamp}, enabled: true},
		{name: "nonmatching drop", configs: []*relabel.Config{&drop}, enabled: true},
		{name: "labels evaluated in config order", configs: []*relabel.Config{&replace, &stamp, &drop}, enabled: true},
		{name: "keep rejects rule", configs: []*relabel.Config{&keep}},
		{name: "user workload ignores platform keep", source: k8s.AlertSourceUser, configs: []*relabel.Config{&keep}, enabled: true},
		{name: "plugin source is not a relabel input", source: k8s.AlertSourcePlatform, configs: []*relabel.Config{&dropBySource}, enabled: true},
		{
			name:         "status evaluated before cache enrichment",
			configs:      []*relabel.Config{&appendSeverity, &dropTwiceRelabeled},
			cachedLabels: map[string]string{"severity": "warning-changed"},
			enabled:      true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			original := &k8s.AlertingRule{
				Name:  "TestAlert",
				Type:  k8s.RuleTypeAlerting,
				State: tc.state,
				Query: "up == 0",
				Labels: map[string]string{
					"severity":           "warning",
					k8s.AlertSourceLabel: tc.source,
				},
			}
			originalLabels := maps.Clone(original.Labels)
			if tc.state == "pending" || tc.state == "firing" {
				alertLabels := maps.Clone(original.Labels)
				alertLabels["alertname"] = original.Name
				original.Alerts = []k8s.PrometheusRuleAlert{{
					State: tc.state, Labels: alertLabels,
				}}
			}
			fixture := grFixture{
				groups: []k8s.PrometheusRuleGroup{{
					Name:  "group-a",
					Rules: []k8s.Rule{original},
				}},
				relabelConfig: tc.configs,
			}
			expectedLabels := originalLabels
			if tc.cachedLabels != nil {
				fixture.relabelRules = []monitoringv1.Rule{{
					Alert: original.Name, Expr: intstr.FromString("up == 0"), Labels: tc.cachedLabels,
				}}
				expectedLabels = tc.cachedLabels
			}
			groups, _, err := fixture.client(t).EnrichRules(context.Background(), k8s.GetRulesRequest{})
			require.NoError(t, err)
			require.Len(t, groups, 1)
			require.Len(t, groups[0].Rules, 1)
			rule := groups[0].Rules[0].(*k8s.AlertingRule)
			require.Equal(t, tc.enabled, rule.AlertingRuleEnabled)
			require.NotNil(t, rule.Alerts)
			require.Empty(t, rule.Alerts)
			require.Equal(t, expectedLabels, rule.Labels)
			require.Equal(t, originalLabels, original.Labels, "input labels must not be mutated")
			require.False(t, original.AlertingRuleEnabled, "input rule must not be mutated")
		})
	}
}

// TestEnrichRules_UncachedRuleDoesNotBorrowSameNameIdentity covers cache
// identity matching in findRelabeledMatch. A rule that shares the alertname
// of a cached rule but is missing from the cache itself (dropped, or not
// synced yet) must not take the cached rule's labels or ID, and the dedup
// must not hide either rule.
func TestEnrichRules_UncachedRuleDoesNotBorrowSameNameIdentity(t *testing.T) {
	const alertName = "Foo"
	forDuration := monitoringv1.Duration("5m")
	cachedExpr := `up{namespace="openshift-a"} == 0`
	uncachedExpr := `up{namespace="openshift-b"} == 0`

	// The cache as collectAlerts builds it today: only the enabled rule.
	cached := monitoringv1.Rule{
		Alert: alertName,
		Expr:  intstr.FromString(cachedExpr),
		For:   &forDuration,
		Labels: map[string]string{
			managementlabels.AlertNameLabel:  alertName,
			"severity":                       "warning",
			k8s.AlertRuleLabelId:             "id-cached",
			k8s.PrometheusRuleLabelNamespace: "openshift-a",
			k8s.PrometheusRuleLabelName:      "rules",
		},
	}

	promRule := func(expr string) *k8s.AlertingRule {
		return &k8s.AlertingRule{
			Name:     alertName,
			Type:     k8s.RuleTypeAlerting,
			Query:    expr,
			Duration: 300,
			State:    "inactive",
			Labels: map[string]string{
				"severity":           "warning",
				k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
			},
		}
	}

	for _, tc := range []struct {
		name  string
		order []string
	}{
		{name: "uncached rule served first", order: []string{uncachedExpr, cachedExpr}},
		{name: "uncached rule served second", order: []string{cachedExpr, uncachedExpr}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rules := make([]k8s.Rule, 0, len(tc.order))
			for _, expr := range tc.order {
				rules = append(rules, promRule(expr))
			}
			fixture := grFixture{
				groups:       []k8s.PrometheusRuleGroup{{Name: "group-a", Rules: rules}},
				relabelRules: []monitoringv1.Rule{cached},
			}

			groups, _, err := fixture.client(t).EnrichRules(context.Background(), k8s.GetRulesRequest{})
			require.NoError(t, err)
			require.Len(t, groups, 1)
			require.Len(t, groups[0].Rules, 2, "both same-name rules must be listed")

			byQuery := make(map[string]*k8s.AlertingRule, 2)
			for _, entry := range groups[0].Rules {
				rule := entry.(*k8s.AlertingRule)
				byQuery[rule.Query] = rule
			}

			// The cached rule is still enriched with its own identity.
			require.Contains(t, byQuery, cachedExpr)
			require.Equal(t, "id-cached", byQuery[cachedExpr].Labels[k8s.AlertRuleLabelId])
			require.Equal(t, "openshift-a", byQuery[cachedExpr].Labels[k8s.PrometheusRuleLabelNamespace])

			// The uncached rule must not borrow it.
			require.Contains(t, byQuery, uncachedExpr)
			require.NotEqual(t, "id-cached", byQuery[uncachedExpr].Labels[k8s.AlertRuleLabelId])
			require.NotEqual(t, "openshift-a", byQuery[uncachedExpr].Labels[k8s.PrometheusRuleLabelNamespace])
		})
	}
}

// TestEnrichRules_UncachedRuleDoesNotBorrowSameExprIdentity covers rules that
// share alertname, expression, and duration but differ in labels. Relabeling
// drops one and retains the other, so the cache holds only the retained rule.
// The dropped rule must not borrow the retained rule's cached identity, and
// the dedup must not hide either rule.
func TestEnrichRules_UncachedRuleDoesNotBorrowSameExprIdentity(t *testing.T) {
	const alertName = "Foo"
	forDuration := monitoringv1.Duration("5m")

	dropCritical := []*relabel.Config{{
		SourceLabels:         model.LabelNames{"severity"},
		Regex:                relabel.MustNewRegexp("critical"),
		Action:               relabel.Drop,
		NameValidationScheme: model.UTF8Validation,
	}}

	// The cache as collectAlerts builds it: only the retained warning rule.
	cached := monitoringv1.Rule{
		Alert: alertName,
		Expr:  intstr.FromString("up == 0"),
		For:   &forDuration,
		Labels: map[string]string{
			managementlabels.AlertNameLabel:  alertName,
			"severity":                       "warning",
			k8s.AlertRuleLabelId:             "id-warning",
			k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
			k8s.PrometheusRuleLabelName:      "rules",
		},
	}

	promRule := func(severity string) *k8s.AlertingRule {
		return &k8s.AlertingRule{
			Name:     alertName,
			Type:     k8s.RuleTypeAlerting,
			Query:    "up == 0",
			Duration: 300,
			State:    "inactive",
			Labels: map[string]string{
				"severity":           severity,
				k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
			},
		}
	}

	for _, tc := range []struct {
		name  string
		order []string
	}{
		{name: "dropped rule served first", order: []string{"critical", "warning"}},
		{name: "dropped rule served second", order: []string{"warning", "critical"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rules := make([]k8s.Rule, 0, len(tc.order))
			for _, severity := range tc.order {
				rules = append(rules, promRule(severity))
			}
			fixture := grFixture{
				groups:        []k8s.PrometheusRuleGroup{{Name: "group-a", Rules: rules}},
				relabelRules:  []monitoringv1.Rule{cached},
				relabelConfig: dropCritical,
			}

			groups, _, err := fixture.client(t).EnrichRules(context.Background(), k8s.GetRulesRequest{})
			require.NoError(t, err)
			require.Len(t, groups, 1)
			require.Len(t, groups[0].Rules, 2, "both same-name rules must be listed")

			bySeverity := make(map[string]*k8s.AlertingRule, 2)
			for _, entry := range groups[0].Rules {
				rule := entry.(*k8s.AlertingRule)
				bySeverity[rule.Labels["severity"]] = rule
			}

			// The retained rule is enriched with its own identity.
			require.Contains(t, bySeverity, "warning")
			require.Equal(t, "id-warning", bySeverity["warning"].Labels[k8s.AlertRuleLabelId])
			require.True(t, bySeverity["warning"].AlertingRuleEnabled)

			// The dropped rule must not borrow it.
			require.Contains(t, bySeverity, "critical")
			require.NotEqual(t, "id-warning", bySeverity["critical"].Labels[k8s.AlertRuleLabelId])
			require.NotEqual(t, "openshift-monitoring", bySeverity["critical"].Labels[k8s.PrometheusRuleLabelNamespace])
			require.False(t, bySeverity["critical"].AlertingRuleEnabled)
		})
	}
}

// TestEnrichRules_RuleLevelStatusWithInstanceLevelKeep locks the rule-level
// semantics of alertingRuleEnabled: the status is computed from the rule's own
// labels, while each alert is filtered by its own labels. A keep configuration
// on a label that only alert instances carry (e.g. pod) therefore reports the
// rule as not enabled while the matching alert is still returned.
func TestEnrichRules_RuleLevelStatusWithInstanceLevelKeep(t *testing.T) {
	keepPod := []*relabel.Config{{
		SourceLabels:         model.LabelNames{"pod"},
		Regex:                relabel.MustNewRegexp("keep-me"),
		Action:               relabel.Keep,
		NameValidationScheme: model.UTF8Validation,
	}}

	rule := &k8s.AlertingRule{
		Name:  "Foo",
		Type:  k8s.RuleTypeAlerting,
		Query: "up == 0",
		Labels: map[string]string{
			"severity":           "warning",
			k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
		},
		Alerts: []k8s.PrometheusRuleAlert{{
			State: "firing",
			Labels: map[string]string{
				"alertname":          "Foo",
				"severity":           "warning",
				"pod":                "keep-me",
				k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
			},
		}},
	}
	fixture := grFixture{
		groups:        []k8s.PrometheusRuleGroup{{Name: "group-a", Rules: []k8s.Rule{rule}}},
		relabelConfig: keepPod,
	}

	groups, _, err := fixture.client(t).EnrichRules(context.Background(), k8s.GetRulesRequest{})
	require.NoError(t, err)
	require.Len(t, groups, 1)
	require.Len(t, groups[0].Rules, 1)
	enriched := groups[0].Rules[0].(*k8s.AlertingRule)

	// The rule's own labels lack pod, so the rule-level status is false, while
	// the alert instance carrying pod=keep-me is retained.
	require.False(t, enriched.AlertingRuleEnabled, "rule-level labels do not satisfy the keep config")
	require.Len(t, enriched.Alerts, 1, "the alert instance satisfies the keep config and must be retained")
	require.Equal(t, "keep-me", enriched.Alerts[0].Labels["pod"])
}

func TestEnrichRules_AppliesRelabelConfigsToPendingFiringOnly(t *testing.T) {
	f := grFixture{
		groups:        threeAlertGroup(),
		relabelRules:  []monitoringv1.Rule{},
		relabelConfig: dropAlert2ReplaceAlert1Severity(),
	}
	client := f.client(t)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	rules := groups[0].Rules
	if len(rules) != 1 {
		t.Fatalf("expected 1 rule, got %d", len(rules))
	}
	alerts := rules[0].(*k8s.AlertingRule).Alerts
	require.True(t, rules[0].(*k8s.AlertingRule).AlertingRuleEnabled, "dropping an instance must not disable its rule")
	if len(alerts) != 2 {
		t.Fatalf("expected 2 alerts after drop, got %d", len(alerts))
	}
	if alerts[0].Labels["alertname"] != "Alert1" || alerts[0].Labels["severity"] != "critical" {
		t.Errorf("alert[0]: got alertname=%s severity=%s", alerts[0].Labels["alertname"], alerts[0].Labels["severity"])
	}
	if alerts[1].Labels["alertname"] != "Alert3" || alerts[1].Labels["severity"] != "warning" {
		t.Errorf("alert[1]: got alertname=%s severity=%s", alerts[1].Labels["alertname"], alerts[1].Labels["severity"])
	}
}

func TestEnrichRules_KeepsRuleWhenAllAlertsDropped(t *testing.T) {
	f := grFixture{
		groups: []k8s.PrometheusRuleGroup{{
			Name: "group-a",
			Rules: []k8s.Rule{&k8s.AlertingRule{
				Name: "rule-a",
				Type: k8s.RuleTypeAlerting,
				Alerts: []k8s.PrometheusRuleAlert{
					{State: "firing", Labels: map[string]string{"alertname": "Alert1"}},
					{State: "pending", Labels: map[string]string{"alertname": "Alert2"}},
				},
			}},
		}},
		relabelConfig: []*relabel.Config{{
			SourceLabels:         model.LabelNames{"alertname"},
			Regex:                relabel.MustNewRegexp(".*"),
			Action:               relabel.Drop,
			NameValidationScheme: model.UTF8Validation,
		}},
	}
	client := f.client(t)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || groups[0].Name != "group-a" || len(groups[0].Rules) != 1 {
		t.Fatalf("expected group-a with 1 rule, got %+v", groups)
	}
	rule := groups[0].Rules[0].(*k8s.AlertingRule)
	require.False(t, rule.AlertingRuleEnabled)
	if rule.Name != "rule-a" {
		t.Errorf("expected rule-a, got %q", rule.Name)
	}
	if rule.Alerts == nil || len(rule.Alerts) != 0 {
		t.Errorf("expected initialized empty alerts, got %#v", rule.Alerts)
	}
}

func TestEnrichRules_FiltersByStateAndLabels(t *testing.T) {
	f := grFixture{
		groups:        threeAlertGroup(),
		relabelRules:  []monitoringv1.Rule{},
		relabelConfig: dropAlert2ReplaceAlert1Severity(),
	}
	client := f.client(t)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{
		State:  "firing",
		Labels: map[string]string{"severity": "critical"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	alerts := groups[0].Rules[0].(*k8s.AlertingRule).Alerts
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].Labels["alertname"] != "Alert1" || alerts[0].Labels["severity"] != "critical" {
		t.Errorf("unexpected alert: %v", alerts[0].Labels)
	}
}

func TestEnrichRules_DropsNonMatchingRulesWhenFiltered(t *testing.T) {
	f := grFixture{
		groups:        threeAlertGroup(),
		relabelRules:  []monitoringv1.Rule{},
		relabelConfig: dropAlert2ReplaceAlert1Severity(),
	}
	client := f.client(t)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{
		State:  "firing",
		Labels: map[string]string{"severity": "does-not-exist"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 0 {
		t.Errorf("expected 0 groups, got %d", len(groups))
	}
}

func TestEnrichRules_AddsManagedByLabelsFromRelabeledRules(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.Rule{
								&k8s.AlertingRule{
									Name:        "AlertWithManagedBy",
									Type:        "alerting",
									Query:       "up == 0",
									Labels:      map[string]string{"severity": "critical"},
									Annotations: map[string]string{"summary": "test alert"},
								},
							},
						},
					}, nil, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{
						{
							Alert: "AlertWithManagedBy",
							Expr:  intstr.FromString("up ==\n  0"),
							Labels: map[string]string{
								"severity":                                   "critical",
								k8s.AlertRuleLabelId:                         "alert-id-1",
								k8s.PrometheusRuleLabelNamespace:             "openshift-monitoring",
								k8s.PrometheusRuleLabelName:                  "platform-rule",
								managementlabels.RuleManagedByLabel:          "operator",
								managementlabels.RelabelConfigManagedByLabel: "gitops",
							},
							Annotations: map[string]string{"summary": "test alert"},
						},
					}
				},
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	rule := groups[0].Rules[0].(*k8s.AlertingRule)
	checks := map[string]string{
		k8s.AlertRuleLabelId:                         "alert-id-1",
		k8s.PrometheusRuleLabelNamespace:             "openshift-monitoring",
		k8s.PrometheusRuleLabelName:                  "platform-rule",
		managementlabels.RuleManagedByLabel:          "operator",
		managementlabels.RelabelConfigManagedByLabel: "gitops",
	}
	for k, want := range checks {
		if got := rule.Labels[k]; got != want {
			t.Errorf("label[%s]: want %q, got %q", k, want, got)
		}
	}
}

func TestEnrichRules_EnrichesWithAllLabelTypes(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.Rule{
								&k8s.AlertingRule{
									Name:   "ARCUpdatedRule",
									Type:   "alerting",
									Query:  "up == 0",
									Labels: map[string]string{"severity": "warning", k8s.AlertSourceLabel: k8s.AlertSourcePlatform},
								},
							},
						},
					}, nil, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{
						{
							Alert: "ARCUpdatedRule",
							Expr:  intstr.FromString("up ==\n  0"),
							Labels: map[string]string{
								"severity":                                   "critical",
								"team":                                       "sre",
								k8s.AlertRuleLabelId:                         "rid-arc-1",
								k8s.PrometheusRuleLabelNamespace:             "openshift-monitoring",
								k8s.PrometheusRuleLabelName:                  "platform-rule",
								k8s.AlertRuleClassificationComponentKey:      "compute",
								k8s.AlertRuleClassificationLayerKey:          "cluster",
								managementlabels.RuleManagedByLabel:          "operator",
								managementlabels.RelabelConfigManagedByLabel: "gitops",
							},
						},
					}
				},
				// The configs that produced the cached labels; the cache and
				// its configs are kept consistent in production.
				ConfigFunc: func() []*relabel.Config {
					return []*relabel.Config{
						{
							SourceLabels:         model.LabelNames{"severity"},
							Regex:                relabel.MustNewRegexp("warning"),
							TargetLabel:          "severity",
							Replacement:          "critical",
							Action:               relabel.Replace,
							NameValidationScheme: model.UTF8Validation,
						},
						{
							SourceLabels:         model.LabelNames{managementlabels.AlertNameLabel},
							Regex:                relabel.MustNewRegexp("ARCUpdatedRule"),
							TargetLabel:          "team",
							Replacement:          "sre",
							Action:               relabel.Replace,
							NameValidationScheme: model.UTF8Validation,
						},
					}
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	rule := groups[0].Rules[0].(*k8s.AlertingRule)
	checks := map[string]string{
		k8s.AlertSourceLabel:                         k8s.AlertSourcePlatform,
		k8s.AlertRuleLabelId:                         "rid-arc-1",
		k8s.PrometheusRuleLabelNamespace:             "openshift-monitoring",
		k8s.PrometheusRuleLabelName:                  "platform-rule",
		k8s.AlertRuleClassificationComponentKey:      "compute",
		k8s.AlertRuleClassificationLayerKey:          "cluster",
		"severity":                                   "critical",
		"team":                                       "sre",
		managementlabels.RuleManagedByLabel:          "operator",
		managementlabels.RelabelConfigManagedByLabel: "gitops",
	}
	for k, want := range checks {
		if got := rule.Labels[k]; got != want {
			t.Errorf("label[%s]: want %q, got %q", k, want, got)
		}
	}
}

func TestEnrichRules_EnrichesWhenAlertFieldEmpty(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.Rule{
								&k8s.AlertingRule{
									Name:   "EmptyAlertFieldRule",
									Type:   "alerting",
									Query:  "up == 0",
									Labels: map[string]string{"severity": "warning", k8s.AlertSourceLabel: k8s.AlertSourcePlatform},
								},
							},
						},
					}, nil, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{
						{
							Alert: "",
							Expr:  intstr.FromString("up ==\n  0"),
							Labels: map[string]string{
								managementlabels.AlertNameLabel:  "EmptyAlertFieldRule",
								"severity":                       "critical",
								k8s.AlertRuleLabelId:             "rid-empty-alert-1",
								k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
								k8s.PrometheusRuleLabelName:      "platform-rule",
							},
						},
					}
				},
				// The config that produced the cached labels; the cache and
				// its configs are kept consistent in production.
				ConfigFunc: func() []*relabel.Config {
					return []*relabel.Config{
						{
							SourceLabels:         model.LabelNames{"severity"},
							Regex:                relabel.MustNewRegexp("warning"),
							TargetLabel:          "severity",
							Replacement:          "critical",
							Action:               relabel.Replace,
							NameValidationScheme: model.UTF8Validation,
						},
					}
				},
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	rule := groups[0].Rules[0].(*k8s.AlertingRule)
	checks := map[string]string{
		k8s.AlertSourceLabel:             k8s.AlertSourcePlatform,
		k8s.AlertRuleLabelId:             "rid-empty-alert-1",
		k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
		k8s.PrometheusRuleLabelName:      "platform-rule",
		"severity":                       "critical",
	}
	for k, want := range checks {
		if got := rule.Labels[k]; got != want {
			t.Errorf("label[%s]: want %q, got %q", k, want, got)
		}
	}
}

func TestEnrichRules_NoEnrichmentWhenMultipleCandidatesMatch(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.Rule{
								&k8s.AlertingRule{
									Name:   "AmbiguousRule",
									Type:   "alerting",
									Query:  "up == 0",
									Labels: map[string]string{"severity": "warning", k8s.AlertSourceLabel: k8s.AlertSourcePlatform},
								},
							},
						},
					}, nil, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{
						{
							Alert: "",
							Expr:  intstr.FromString("up ==\n  0"),
							Labels: map[string]string{
								managementlabels.AlertNameLabel: "AmbiguousRule",
								"severity":                      "critical",
								k8s.AlertRuleLabelId:            "rid-amb-1",
							},
						},
						{
							Alert: "",
							Expr:  intstr.FromString("up==0"),
							Labels: map[string]string{
								managementlabels.AlertNameLabel: "AmbiguousRule",
								"severity":                      "critical",
								k8s.AlertRuleLabelId:            "rid-amb-2",
							},
						},
					}
				},
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	rule := groups[0].Rules[0].(*k8s.AlertingRule)
	if rule.Labels[k8s.AlertSourceLabel] != k8s.AlertSourcePlatform {
		t.Errorf("expected source=%s, got %s", k8s.AlertSourcePlatform, rule.Labels[k8s.AlertSourceLabel])
	}
	if _, hasId := rule.Labels[k8s.AlertRuleLabelId]; hasId {
		t.Errorf("expected no AlertRuleLabelId on ambiguous rule, but found: %s", rule.Labels[k8s.AlertRuleLabelId])
	}
	if rule.Labels["severity"] != "warning" {
		t.Errorf("expected severity=warning (from original), got %s", rule.Labels["severity"])
	}
}

func TestEnrichRules_PropagatesFetchWarnings(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
					return threeAlertGroup(), []string{"failed to get user workload rules: connection refused"}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc:   func(_ context.Context) []monitoringv1.Rule { return nil },
				ConfigFunc: func() []*relabel.Config { return nil },
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	groups, warnings, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d: %v", len(warnings), warnings)
	}
	if warnings[0] != "failed to get user workload rules: connection refused" {
		t.Errorf("unexpected warning %q", warnings[0])
	}
}

func TestEnrichRules_NamespaceOnlyKeepsInactiveRules(t *testing.T) {
	f := grFixture{
		groups: []k8s.PrometheusRuleGroup{
			{
				Name: "group-a",
				Rules: []k8s.Rule{
					&k8s.AlertingRule{Name: "InactiveRule", Type: k8s.RuleTypeAlerting},
					&k8s.AlertingRule{
						Name: "FiringWithoutNamespaceLabel",
						Type: k8s.RuleTypeAlerting,
						Alerts: []k8s.PrometheusRuleAlert{
							{State: "firing", Labels: map[string]string{"alertname": "FiringWithoutNamespaceLabel", "severity": "warning"}},
						},
					},
					&k8s.RecordingRule{Name: "record:foo", Type: k8s.RuleTypeRecording, Query: "vector(1)"},
				},
			},
		},
	}
	client := f.client(t)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{
		Labels: map[string]string{"namespace": "ns1"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if len(groups[0].Rules) != 3 {
		t.Fatalf("expected 3 rules, got %d", len(groups[0].Rules))
	}
}

func TestEnrichRules_NamespaceAndSeverityStillFilters(t *testing.T) {
	f := grFixture{
		groups:        threeAlertGroup(),
		relabelConfig: dropAlert2ReplaceAlert1Severity(),
	}
	client := f.client(t)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{
		State: "firing",
		Labels: map[string]string{
			"namespace": "ns1",
			"severity":  "critical",
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	alerts := groups[0].Rules[0].(*k8s.AlertingRule).Alerts
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].Labels["alertname"] != "Alert1" {
		t.Errorf("expected Alert1, got %v", alerts[0].Labels)
	}
}

func promDuration(s string) *monitoringv1.Duration {
	d := monitoringv1.Duration(s)
	return &d
}

func TestEnrichRules_MatchesPrometheusDayDuration(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.Rule{
								&k8s.AlertingRule{
									Name:     "DayForRule",
									Type:     k8s.RuleTypeAlerting,
									Query:    "up == 0",
									Duration: (24 * time.Hour).Seconds(),
									Labels:   map[string]string{"severity": "warning", k8s.AlertSourceLabel: k8s.AlertSourcePlatform},
								},
							},
						},
					}, nil, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{
						{
							Alert: "DayForRule",
							Expr:  intstr.FromString("up == 0"),
							For:   promDuration("1d"),
							Labels: map[string]string{
								"severity":           "warning",
								k8s.AlertRuleLabelId: "rid-day",
							},
						},
						{
							Alert: "DayForRule",
							Expr:  intstr.FromString("up == 0"),
							For:   promDuration("5m"),
							Labels: map[string]string{
								"severity":           "warning",
								k8s.AlertRuleLabelId: "rid-five-min",
							},
						},
					}
				},
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	groups, _, err := client.EnrichRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	got := groups[0].Rules[0].(*k8s.AlertingRule).Labels[k8s.AlertRuleLabelId]
	if got != "rid-day" {
		t.Errorf("expected AlertRuleLabelId=rid-day, got %q", got)
	}
}
