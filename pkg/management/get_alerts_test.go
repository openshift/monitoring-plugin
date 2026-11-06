package management_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/relabel"
	"github.com/stretchr/testify/require"

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
	if alerts[0].AlertComponent != "Others" {
		t.Errorf("expected component=Others, got %q", alerts[0].AlertComponent)
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
	if alerts[0].AlertComponent != "Others" {
		t.Errorf("expected component=Others, got %q", alerts[0].AlertComponent)
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

func TestEnrichAlerts_DroppedInstancesAreOptIn(t *testing.T) {
	activeAt := time.Now().Add(-time.Hour)
	stamp := relabel.DefaultRelabelConfig
	stamp.NameValidationScheme = model.UTF8Validation
	stamp.SourceLabels = model.LabelNames{"alertname"}
	stamp.Regex = relabel.MustNewRegexp("Dropped.*")
	stamp.TargetLabel = k8s.AlertRuleLabelId
	stamp.Replacement = "dropped-rule-id"
	classify := relabel.DefaultRelabelConfig
	classify.NameValidationScheme = model.UTF8Validation
	classify.SourceLabels = model.LabelNames{"alertname"}
	classify.Regex = stamp.Regex
	classify.TargetLabel = k8s.AlertRuleClassificationComponentKey
	classify.Replacement = "networking"
	drop := relabel.DefaultRelabelConfig
	drop.Action = relabel.Drop
	drop.SourceLabels = model.LabelNames{k8s.AlertRuleLabelId}
	drop.Regex = relabel.MustNewRegexp("dropped-rule-id")
	configs := []*relabel.Config{&stamp, &classify, &drop}
	for _, includeDropped := range []bool{false, true} {
		t.Run(fmt.Sprintf("includeDropped=%t", includeDropped), func(t *testing.T) {
			mockK8s := &testutils.MockClient{
				PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{FetchAlertsFunc: func(_ context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, []string, error) {
						require.Equal(t, includeDropped, req.IncludeDropped)
						if includeDropped {
							require.Equal(t, configs, req.DroppedAlertRelabelConfigs)
						} else {
							require.Empty(t, req.DroppedAlertRelabelConfigs)
						}
						return []k8s.PrometheusAlert{
							{Labels: map[string]string{"alertname": "DroppedFiring", k8s.AlertSourceLabel: k8s.AlertSourcePlatform}, State: "firing", ActiveAt: activeAt},
							{Labels: map[string]string{"alertname": "DroppedPending", k8s.AlertSourceLabel: k8s.AlertSourcePlatform}, State: "pending", ActiveAt: activeAt},
							{Labels: map[string]string{"alertname": "Visible", k8s.AlertSourceLabel: k8s.AlertSourcePlatform}, State: "firing", ActiveAt: activeAt},
							{Labels: map[string]string{"alertname": "DroppedUser", k8s.AlertSourceLabel: k8s.AlertSourceUser}, State: "firing", ActiveAt: activeAt},
						}, nil, nil
					}}
				},
				RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{ConfigFunc: func() []*relabel.Config { return configs }}
				},
			}
			alerts, _, err := management.New(context.Background(), mockK8s).EnrichAlerts(context.Background(), k8s.GetAlertsRequest{IncludeDropped: includeDropped})
			require.NoError(t, err)
			wantCount := 2
			if includeDropped {
				wantCount = 4
			}
			require.Len(t, alerts, wantCount)
			for _, alert := range alerts {
				require.Equal(t, activeAt, alert.ActiveAt)
				if alert.Labels["alertname"] == "DroppedFiring" || alert.Labels["alertname"] == "DroppedPending" {
					require.True(t, alert.Dropped)
					state := "firing"
					if alert.Labels["alertname"] == "DroppedPending" {
						state = "pending"
					}
					require.Equal(t, state, alert.State)
					require.Equal(t, "dropped-rule-id", alert.Labels[k8s.AlertRuleLabelId])
					require.Equal(t, "networking", alert.AlertComponent)
				} else {
					require.False(t, alert.Dropped)
					require.Equal(t, "firing", alert.State)
				}
			}
		})
	}
}
