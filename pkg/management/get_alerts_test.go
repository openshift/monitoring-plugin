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
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return nil, nil, errors.New("failed to get alerts")
				},
			}
		},
	}
	client := management.New(ctx, mockK8s)

	_, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
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
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{alert1, alert2}, nil, nil
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

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
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
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{alert1}, nil, nil
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

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
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
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{alertWithName}, nil, nil
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

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
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
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{alertWithLayer}, nil, nil
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

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
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
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{alert}, nil, nil
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

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
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
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{alert1}, nil, nil
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

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "others" {
		t.Errorf("expected component=others, got %q", alerts[0].AlertComponent)
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
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{alert1}, nil, nil
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

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "others" {
		t.Errorf("expected component=others, got %q", alerts[0].AlertComponent)
	}
	// The alert is about an entity in the default namespace, which is not a
	// platform namespace, so it belongs to the namespace layer.
	if alerts[0].AlertLayer != "namespace" {
		t.Errorf("expected layer=namespace, got %q", alerts[0].AlertLayer)
	}
}

func TestGetAlerts_ReturnsEmptyList(t *testing.T) {
	ctx := context.Background()
	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{}, nil, nil
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

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("expected empty list, got %d", len(alerts))
	}
}

// A platform-managed rule in a cluster-monitoring namespace other than
// openshift-monitoring must classify as cluster via the resolved alert
// source, matching the alert-label classification path.
func TestGetAlerts_PlatformRuleOutsideOpenshiftMonitoringGetsClusterLayer(t *testing.T) {
	ctx := context.Background()
	alert := k8s.PrometheusAlert{
		Labels: map[string]string{managementlabels.AlertNameLabel: "CustomPlatformAlert", "severity": "warning"},
		State:  "firing",
	}

	rule := monitoringv1.Rule{
		Alert: "CustomPlatformAlert",
		Labels: map[string]string{
			"severity":                       "warning",
			k8s.PrometheusRuleLabelNamespace: "custom-platform-rules",
			k8s.PrometheusRuleLabelName:      "my-platform-rule",
		},
	}
	rule.Labels[k8s.AlertRuleLabelId] = alertrule.GetAlertingRuleId(&rule)

	mockK8s := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{alert}, nil, nil
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
			ns.SetMonitoringNamespaces(map[string]bool{
				"openshift-monitoring":  true,
				"custom-platform-rules": true,
			})
			return ns
		},
	}
	client := management.New(ctx, mockK8s)

	alerts, _, err := client.EnrichAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if got := alerts[0].Labels[k8s.AlertSourceLabel]; got != k8s.AlertSourcePlatform {
		t.Errorf("expected alert source %q, got %q", k8s.AlertSourcePlatform, got)
	}
	if alerts[0].AlertLayer != "cluster" {
		t.Errorf("expected layer=cluster, got %q", alerts[0].AlertLayer)
	}
	if alerts[0].AlertComponent != "others" {
		t.Errorf("expected component=others, got %q", alerts[0].AlertComponent)
	}
}

// When an alert is correlated with its rule, classification runs on the
// rule's labels: a rule without a static namespace label is classified by
// the namespace the alert fired in (the affected entity's namespace), and
// only falls back to the PrometheusRule's own namespace when the alert
// carries no namespace either.
func TestGetAlerts_LinkedRuleClassificationUsesAlertNamespace(t *testing.T) {
	ctx := context.Background()
	newAlert := func() k8s.PrometheusAlert {
		return k8s.PrometheusAlert{
			Labels: map[string]string{
				managementlabels.AlertNameLabel: "KubePodCrashLooping",
				"severity":                      "warning",
				"namespace":                     "openshift-cnv",
			},
			State: "firing",
		}
	}

	rule := monitoringv1.Rule{
		Alert: "KubePodCrashLooping",
		Labels: map[string]string{
			"severity":                       "warning",
			k8s.PrometheusRuleLabelNamespace: k8s.ClusterMonitoringNamespace,
			k8s.PrometheusRuleLabelName:      "kubernetes.rules",
		},
	}
	rule.Labels[k8s.AlertRuleLabelId] = alertrule.GetAlertingRuleId(&rule)

	// Linked to its rule: the alert's firing namespace (openshift-cnv)
	// classifies it, not the rule's namespace (openshift-monitoring).
	linked := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{newAlert()}, nil, nil
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
			ns.SetMonitoringNamespaces(map[string]bool{k8s.ClusterMonitoringNamespace: true})
			return ns
		},
	}

	alerts, _, err := management.New(ctx, linked).EnrichAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "openshift-virtualization-operator" || alerts[0].AlertLayer != "cluster" {
		t.Errorf("linked classification = (%q, %q), want (openshift-virtualization-operator, cluster)", alerts[0].AlertComponent, alerts[0].AlertLayer)
	}

	// Not linked: the alert's firing namespace classifies it.
	unlinked := &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return &testutils.MockPrometheusAlertsInterface{
				FetchAlertsFunc: func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
					return []k8s.PrometheusAlert{newAlert()}, nil, nil
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc:   func(_ context.Context) []monitoringv1.Rule { return nil },
				GetFunc:    func(_ context.Context, _ string) (monitoringv1.Rule, bool) { return monitoringv1.Rule{}, false },
				ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
			}
		},
	}

	alerts, _, err = management.New(ctx, unlinked).EnrichAlerts(ctx, k8s.GetAlertsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].AlertComponent != "openshift-virtualization-operator" || alerts[0].AlertLayer != "cluster" {
		t.Errorf("unlinked classification = (%q, %q), want (openshift-virtualization-operator, cluster)", alerts[0].AlertComponent, alerts[0].AlertLayer)
	}
}
