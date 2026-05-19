package management_test

import (
	"context"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/relabel"
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
				GetRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
					return f.groups, nil
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
			Rules: []k8s.PrometheusRule{
				{
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

func TestGetRules_AppliesRelabelConfigsToPendingFiringOnly(t *testing.T) {
	f := grFixture{
		groups:        threeAlertGroup(),
		relabelRules:  []monitoringv1.Rule{},
		relabelConfig: dropAlert2ReplaceAlert1Severity(),
	}
	client := f.client(t)

	groups, err := client.GetRules(context.Background(), k8s.GetRulesRequest{})
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
	alerts := rules[0].Alerts
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

func TestGetRules_FiltersByStateAndLabels(t *testing.T) {
	f := grFixture{
		groups:        threeAlertGroup(),
		relabelRules:  []monitoringv1.Rule{},
		relabelConfig: dropAlert2ReplaceAlert1Severity(),
	}
	client := f.client(t)

	groups, err := client.GetRules(context.Background(), k8s.GetRulesRequest{
		State:  "firing",
		Labels: map[string]string{"severity": "critical"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	alerts := groups[0].Rules[0].Alerts
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].Labels["alertname"] != "Alert1" || alerts[0].Labels["severity"] != "critical" {
		t.Errorf("unexpected alert: %v", alerts[0].Labels)
	}
}

func TestGetRules_DropsNonMatchingRulesWhenFiltered(t *testing.T) {
	f := grFixture{
		groups:        threeAlertGroup(),
		relabelRules:  []monitoringv1.Rule{},
		relabelConfig: dropAlert2ReplaceAlert1Severity(),
	}
	client := f.client(t)

	groups, err := client.GetRules(context.Background(), k8s.GetRulesRequest{
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

func TestGetRules_AddsManagedByLabelsFromRelabeledRules(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.PrometheusRule{
								{
									Name:        "AlertWithManagedBy",
									Type:        "alerting",
									Query:       "up == 0",
									Labels:      map[string]string{"severity": "critical"},
									Annotations: map[string]string{"summary": "test alert"},
								},
							},
						},
					}, nil
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

	groups, err := client.GetRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	rule := groups[0].Rules[0]
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

func TestGetRules_EnrichesWithAllLabelTypes(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.PrometheusRule{
								{
									Name:   "ARCUpdatedRule",
									Type:   "alerting",
									Query:  "up == 0",
									Labels: map[string]string{"severity": "warning", k8s.AlertSourceLabel: k8s.AlertSourcePlatform},
								},
							},
						},
					}, nil
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
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	groups, err := client.GetRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	rule := groups[0].Rules[0]
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

func TestGetRules_EnrichesWhenAlertFieldEmpty(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.PrometheusRule{
								{
									Name:   "EmptyAlertFieldRule",
									Type:   "alerting",
									Query:  "up == 0",
									Labels: map[string]string{"severity": "warning", k8s.AlertSourceLabel: k8s.AlertSourcePlatform},
								},
							},
						},
					}, nil
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
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(context.Background(), mockK8s)

	groups, err := client.GetRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	rule := groups[0].Rules[0]
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

func TestGetRules_NoEnrichmentWhenMultipleCandidatesMatch(t *testing.T) {
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetRulesFunc: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
					return []k8s.PrometheusRuleGroup{
						{
							Name: "group-a",
							Rules: []k8s.PrometheusRule{
								{
									Name:   "AmbiguousRule",
									Type:   "alerting",
									Query:  "up == 0",
									Labels: map[string]string{"severity": "warning", k8s.AlertSourceLabel: k8s.AlertSourcePlatform},
								},
							},
						},
					}, nil
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

	groups, err := client.GetRules(context.Background(), k8s.GetRulesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Rules) != 1 {
		t.Fatalf("expected 1 group with 1 rule")
	}
	rule := groups[0].Rules[0]
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
