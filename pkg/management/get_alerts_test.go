package management_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/prometheus/model/relabel"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func TestGetAlerts_ErrorPropagated(t *testing.T) {
	ctx := context.Background()
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return nil, errors.New("failed to get alerts")
				},
			}
		},
	}
	client := management.New(ctx, mockK8s)

	_, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "failed to get prometheus alerts") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestGetAlerts_ReturnsAllWithoutRelabelConfigs(t *testing.T) {
	ctx := context.Background()
	alert1 := k8s.PrometheusAlert{
		Labels: map[string]string{managementlabels.AlertNameLabel: "Alert1", "severity": "warning", "namespace": "default"},
		State:  "firing",
	}
	alert2 := k8s.PrometheusAlert{
		Labels: map[string]string{managementlabels.AlertNameLabel: "Alert2", "severity": "critical", "namespace": "kube-system"},
		State:  "pending",
	}
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return []k8s.PrometheusAlert{alert1, alert2}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 2 {
		t.Fatalf("expected 2 alerts, got %d", len(alerts))
	}
	if alerts[0].Labels[managementlabels.AlertNameLabel] != "Alert1" {
		t.Errorf("alert[0] name mismatch")
	}
	if alerts[1].Labels[managementlabels.AlertNameLabel] != "Alert2" {
		t.Errorf("alert[1] name mismatch")
	}
}

func TestGetAlerts_AppliesStaticClassificationFromRelabeledRule(t *testing.T) {
	ctx := context.Background()
	alert1 := k8s.PrometheusAlert{
		Labels: map[string]string{managementlabels.AlertNameLabel: "Alert1", "severity": "warning", "namespace": "default"},
		State:  "firing",
	}

	rule := monitoringv1.Rule{
		Alert: "Alert1",
		Labels: map[string]string{
			"severity":                              "warning",
			"namespace":                             "default",
			k8s.PrometheusRuleLabelNamespace:        "openshift-monitoring",
			k8s.PrometheusRuleLabelName:             "test-rule",
			k8s.AlertRuleClassificationComponentKey: "networking",
			k8s.AlertRuleClassificationLayerKey:     "cluster",
		},
	}
	rule.Labels[k8s.AlertRuleLabelId] = alertrule.GetAlertingRuleId(&rule)

	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return []k8s.PrometheusAlert{alert1}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule { return []monitoringv1.Rule{rule} },
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					if id == rule.Labels[k8s.AlertRuleLabelId] {
						return rule, true
					}
					return monitoringv1.Rule{}, false
				},
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
		NamespaceFunc: func() k8s.NamespaceInterface {
			ns := &testutils.MockNamespaceInterface{}
			ns.SetMonitoringNamespaces(map[string]bool{"openshift-monitoring": true})
			return ns
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "networking" {
		t.Errorf("expected component=networking, got %q", alerts[0].AlertComponent)
	}
	if alerts[0].AlertLayer != "cluster" {
		t.Errorf("expected layer=cluster, got %q", alerts[0].AlertLayer)
	}
}

func TestGetAlerts_DerivesComponentFromAlertLabel(t *testing.T) {
	ctx := context.Background()
	alertWithName := k8s.PrometheusAlert{
		Labels: map[string]string{
			managementlabels.AlertNameLabel: "Alert1",
			"severity":                      "warning",
			"namespace":                     "default",
			"name":                          "kube_apiserver",
		},
		State: "firing",
	}

	rule := monitoringv1.Rule{
		Alert: "Alert1",
		Labels: map[string]string{
			"severity":                                  "warning",
			"namespace":                                 "default",
			k8s.PrometheusRuleLabelNamespace:            "openshift-monitoring",
			k8s.PrometheusRuleLabelName:                 "test-rule",
			k8s.AlertRuleClassificationComponentFromKey: "name",
			k8s.AlertRuleClassificationLayerKey:         "namespace",
		},
	}
	rule.Labels[k8s.AlertRuleLabelId] = alertrule.GetAlertingRuleId(&rule)

	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return []k8s.PrometheusAlert{alertWithName}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule { return []monitoringv1.Rule{rule} },
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					if id == rule.Labels[k8s.AlertRuleLabelId] {
						return rule, true
					}
					return monitoringv1.Rule{}, false
				},
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
		NamespaceFunc: func() k8s.NamespaceInterface {
			ns := &testutils.MockNamespaceInterface{}
			ns.SetMonitoringNamespaces(map[string]bool{"openshift-monitoring": true})
			return ns
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "kube_apiserver" {
		t.Errorf("expected component=kube_apiserver, got %q", alerts[0].AlertComponent)
	}
	if alerts[0].AlertLayer != "namespace" {
		t.Errorf("expected layer=namespace, got %q", alerts[0].AlertLayer)
	}
}

func TestGetAlerts_DerivesLayerFromAlertLabel(t *testing.T) {
	ctx := context.Background()
	alertWithLayer := k8s.PrometheusAlert{
		Labels: map[string]string{
			managementlabels.AlertNameLabel: "Alert1",
			"severity":                      "warning",
			"namespace":                     "default",
			"tier":                          "Cluster",
		},
		State: "firing",
	}

	rule := monitoringv1.Rule{
		Alert: "Alert1",
		Labels: map[string]string{
			"severity":                              "warning",
			"namespace":                             "default",
			k8s.PrometheusRuleLabelNamespace:        "openshift-monitoring",
			k8s.PrometheusRuleLabelName:             "test-rule",
			k8s.AlertRuleClassificationComponentKey: "networking",
			k8s.AlertRuleClassificationLayerFromKey: "tier",
		},
	}
	rule.Labels[k8s.AlertRuleLabelId] = alertrule.GetAlertingRuleId(&rule)

	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return []k8s.PrometheusAlert{alertWithLayer}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule { return []monitoringv1.Rule{rule} },
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					if id == rule.Labels[k8s.AlertRuleLabelId] {
						return rule, true
					}
					return monitoringv1.Rule{}, false
				},
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
		NamespaceFunc: func() k8s.NamespaceInterface {
			ns := &testutils.MockNamespaceInterface{}
			ns.SetMonitoringNamespaces(map[string]bool{"openshift-monitoring": true})
			return ns
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "networking" {
		t.Errorf("expected component=networking, got %q", alerts[0].AlertComponent)
	}
	// "Cluster" from alert label lowercased to "cluster"
	if alerts[0].AlertLayer != "cluster" {
		t.Errorf("expected layer=cluster, got %q", alerts[0].AlertLayer)
	}
}

func TestGetAlerts_UsesRuleLabelsAsDefaults(t *testing.T) {
	ctx := context.Background()
	alert := k8s.PrometheusAlert{
		Labels: map[string]string{
			"alertname":                             "AlertRuleDefaults",
			"severity":                              "warning",
			"namespace":                             "default",
			k8s.AlertRuleClassificationComponentKey: "team_a",
			k8s.AlertRuleClassificationLayerKey:     "namespace",
		},
		State: "firing",
	}

	rule := monitoringv1.Rule{
		Alert: "AlertRuleDefaults",
		Labels: map[string]string{
			"severity":                              "warning",
			"namespace":                             "default",
			k8s.AlertRuleClassificationComponentKey: "team_a",
			k8s.AlertRuleClassificationLayerKey:     "namespace",
			k8s.PrometheusRuleLabelNamespace:        "openshift-monitoring",
			k8s.PrometheusRuleLabelName:             "defaults-rule",
		},
	}
	rule.Labels[k8s.AlertRuleLabelId] = alertrule.GetAlertingRuleId(&rule)

	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return []k8s.PrometheusAlert{alert}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule { return []monitoringv1.Rule{rule} },
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					if id == rule.Labels[k8s.AlertRuleLabelId] {
						return rule, true
					}
					return monitoringv1.Rule{}, false
				},
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "team_a" {
		t.Errorf("expected component=team_a, got %q", alerts[0].AlertComponent)
	}
	if alerts[0].AlertLayer != "namespace" {
		t.Errorf("expected layer=namespace, got %q", alerts[0].AlertLayer)
	}
}

func TestGetAlerts_FallsBackToDefaultWhenNoMatchingRule(t *testing.T) {
	ctx := context.Background()
	alert1 := k8s.PrometheusAlert{
		Labels: map[string]string{managementlabels.AlertNameLabel: "Alert1", "severity": "warning", "namespace": "default"},
		State:  "firing",
	}
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return []k8s.PrometheusAlert{alert1}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc:   func(_ context.Context) []monitoringv1.Rule { return []monitoringv1.Rule{} },
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "other" {
		t.Errorf("expected component=other, got %q", alerts[0].AlertComponent)
	}
	if alerts[0].AlertLayer != "namespace" {
		t.Errorf("expected layer=namespace, got %q", alerts[0].AlertLayer)
	}
}

func TestGetAlerts_FallsBackToDefaultWithMatchingRuleNoLabels(t *testing.T) {
	ctx := context.Background()
	alert1 := k8s.PrometheusAlert{
		Labels: map[string]string{managementlabels.AlertNameLabel: "Alert1", "severity": "warning", "namespace": "default"},
		State:  "firing",
	}

	rule := monitoringv1.Rule{
		Alert: "Alert1",
		Labels: map[string]string{
			"severity":                       "warning",
			"namespace":                      "default",
			k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
			k8s.PrometheusRuleLabelName:      "default-rule",
		},
	}
	rule.Labels[k8s.AlertRuleLabelId] = alertrule.GetAlertingRuleId(&rule)

	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return []k8s.PrometheusAlert{alert1}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule { return []monitoringv1.Rule{rule} },
				GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
					if id == rule.Labels[k8s.AlertRuleLabelId] {
						return rule, true
					}
					return monitoringv1.Rule{}, false
				},
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "other" {
		t.Errorf("expected component=other, got %q", alerts[0].AlertComponent)
	}
	if alerts[0].AlertLayer != "cluster" {
		t.Errorf("expected layer=cluster, got %q", alerts[0].AlertLayer)
	}
}

func TestGetAlerts_ReturnsEmptyList(t *testing.T) {
	ctx := context.Background()
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				GetAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
					return []k8s.PrometheusAlert{}, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("expected empty list, got %d", len(alerts))
	}
}
