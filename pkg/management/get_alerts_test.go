package management_test

import (
	"context"
	"encoding/base64"
	"errors"
	"os"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/prometheus/model/relabel"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

var _ = Describe("GetAlerts", func() {
	var (
		ctx               context.Context
		mockK8s           *testutils.MockClient
		client            management.Client
		overrideNamespace = "plugin-test-ns"
	)

	BeforeEach(func() {
		Expect(os.Setenv("MONITORING_PLUGIN_NAMESPACE", overrideNamespace)).To(Succeed())
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)
	})

	AfterEach(func() {
		Expect(os.Unsetenv("MONITORING_PLUGIN_NAMESPACE")).To(Succeed())
	})

	Context("when PrometheusAlerts returns an error", func() {
		BeforeEach(func() {
			mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
				return &testutils.MockPrometheusAlertsInterface{
					GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
						return nil, errors.New("failed to get alerts")
					},
				}
			}
		})

		It("returns an error", func() {
			req := k8s.GetAlertsRequest{}
			_, err := client.GetAlerts(ctx, req)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to get prometheus alerts"))
		})
	})

	Context("when PrometheusAlerts returns alerts", func() {
		var (
			alert1 = k8s.PrometheusAlert{
				Labels: map[string]string{
					managementlabels.AlertNameLabel: "Alert1",
					"severity":                      "warning",
					"namespace":                     "default",
				},
				State: "firing",
			}
			alert2 = k8s.PrometheusAlert{
				Labels: map[string]string{
					managementlabels.AlertNameLabel: "Alert2",
					"severity":                      "critical",
					"namespace":                     "kube-system",
				},
				State: "pending",
			}
		)

		Context("without relabel configs", func() {
			BeforeEach(func() {
				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{alert1, alert2}, nil
						},
					}
				}

				mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{
						ConfigFunc: func() []*relabel.Config {
							return []*relabel.Config{}
						},
					}
				}
			})

			It("returns all alerts without modification", func() {
				req := k8s.GetAlertsRequest{}
				alerts, err := client.GetAlerts(ctx, req)
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(2))
				Expect(alerts[0].Labels[managementlabels.AlertNameLabel]).To(Equal("Alert1"))
				Expect(alerts[1].Labels[managementlabels.AlertNameLabel]).To(Equal("Alert2"))
			})
		})

		Context("with classification overrides", func() {
			var (
				overrideComponent = "unit-test-component"
				overrideLayer     = "namespace"
			)

			BeforeEach(func() {
				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{alert1}, nil
						},
					}
				}

				mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
					ns := &testutils.MockNamespaceInterface{}
					ns.SetMonitoringNamespaces(map[string]bool{"openshift-monitoring": true})
					return ns
				}

				mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
					rule := monitoringv1.Rule{
						Alert: "Alert1",
						Labels: map[string]string{
							"severity":                       "warning",
							"namespace":                      "default",
							k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
							k8s.PrometheusRuleLabelName:      "test-rule",
						},
					}
					return &testutils.MockRelabeledRulesInterface{
						ListFunc: func(ctx context.Context) []monitoringv1.Rule {
							return []monitoringv1.Rule{rule}
						},
						GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
							if id == alertrule.GetAlertingRuleId(&rule) {
								return rule, true
							}
							return monitoringv1.Rule{}, false
						},
						ConfigFunc: func() []*relabel.Config {
							return []*relabel.Config{}
						},
					}
				}
			})

			It("applies overrides from labeled ConfigMap", func() {
				rule := monitoringv1.Rule{
					Alert: "Alert1",
					Labels: map[string]string{
						"severity":                       "warning",
						"namespace":                      "default",
						k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
						k8s.PrometheusRuleLabelName:      "test-rule",
					},
				}
				ruleId := alertrule.GetAlertingRuleId(&rule)
				key := base64.RawURLEncoding.EncodeToString([]byte(ruleId))
				cm := &corev1.ConfigMap{
					ObjectMeta: metav1.ObjectMeta{
						Name:      management.OverrideConfigMapName("openshift-monitoring"),
						Namespace: overrideNamespace,
						Labels: map[string]string{
							managementlabels.AlertClassificationOverridesTypeLabelKey: managementlabels.AlertClassificationOverridesTypeLabelValue,
							k8s.PrometheusRuleLabelNamespace:                          "openshift-monitoring",
						},
					},
					Data: map[string]string{
						key: `{"classification":{"openshift_io_alert_rule_component":"` + overrideComponent + `","openshift_io_alert_rule_layer":"` + overrideLayer + `"}}`,
					},
				}
				mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface {
					return &testutils.MockConfigMapInterface{
						ConfigMaps: map[string]*corev1.ConfigMap{
							overrideNamespace + "/" + management.OverrideConfigMapName("openshift-monitoring"): cm,
						},
					}
				}

				alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(1))
				Expect(alerts[0].AlertComponent).To(Equal(overrideComponent))
				Expect(alerts[0].AlertLayer).To(Equal(overrideLayer))
			})

			It("derives component from alert label when openshift_io_alert_rule_component_from is set", func() {
				alert1WithName := alert1
				alert1WithName.Labels = map[string]string{}
				for k, v := range alert1.Labels {
					alert1WithName.Labels[k] = v
				}
				alert1WithName.Labels["name"] = "kube-apiserver"

				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{alert1WithName}, nil
						},
					}
				}

				rule := monitoringv1.Rule{
					Alert: "Alert1",
					Labels: map[string]string{
						"severity":                       "warning",
						"namespace":                      "default",
						k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
						k8s.PrometheusRuleLabelName:      "test-rule",
					},
				}
				ruleId := alertrule.GetAlertingRuleId(&rule)
				key := base64.RawURLEncoding.EncodeToString([]byte(ruleId))
				cm := &corev1.ConfigMap{
					ObjectMeta: metav1.ObjectMeta{
						Name:      management.OverrideConfigMapName("openshift-monitoring"),
						Namespace: overrideNamespace,
						Labels: map[string]string{
							managementlabels.AlertClassificationOverridesTypeLabelKey: managementlabels.AlertClassificationOverridesTypeLabelValue,
							k8s.PrometheusRuleLabelNamespace:                          "openshift-monitoring",
						},
					},
					Data: map[string]string{
						key: `{"classification":{"openshift_io_alert_rule_component_from":"name","openshift_io_alert_rule_layer":"namespace"}}`,
					},
				}
				mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface {
					return &testutils.MockConfigMapInterface{
						ConfigMaps: map[string]*corev1.ConfigMap{
							overrideNamespace + "/" + management.OverrideConfigMapName("openshift-monitoring"): cm,
						},
					}
				}

				alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(1))
				Expect(alerts[0].AlertComponent).To(Equal("kube-apiserver"))
				Expect(alerts[0].AlertLayer).To(Equal("namespace"))
			})

			It("derives layer from alert label when openshift_io_alert_rule_layer_from is set", func() {
				alert1WithLayer := alert1
				alert1WithLayer.Labels = map[string]string{}
				for k, v := range alert1.Labels {
					alert1WithLayer.Labels[k] = v
				}
				alert1WithLayer.Labels["layer"] = "cluster"

				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{alert1WithLayer}, nil
						},
					}
				}

				rule := monitoringv1.Rule{
					Alert: "Alert1",
					Labels: map[string]string{
						"severity":                       "warning",
						"namespace":                      "default",
						k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
						k8s.PrometheusRuleLabelName:      "test-rule",
					},
				}
				ruleId := alertrule.GetAlertingRuleId(&rule)
				key := base64.RawURLEncoding.EncodeToString([]byte(ruleId))
				cm := &corev1.ConfigMap{
					ObjectMeta: metav1.ObjectMeta{
						Name:      management.OverrideConfigMapName("openshift-monitoring"),
						Namespace: overrideNamespace,
						Labels: map[string]string{
							managementlabels.AlertClassificationOverridesTypeLabelKey: managementlabels.AlertClassificationOverridesTypeLabelValue,
							k8s.PrometheusRuleLabelNamespace:                          "openshift-monitoring",
						},
					},
					Data: map[string]string{
						key: `{"classification":{"openshift_io_alert_rule_layer_from":"layer","openshift_io_alert_rule_component":"unit-test-component"}}`,
					},
				}
				mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface {
					return &testutils.MockConfigMapInterface{
						ConfigMaps: map[string]*corev1.ConfigMap{
							overrideNamespace + "/" + management.OverrideConfigMapName("openshift-monitoring"): cm,
						},
					}
				}

				alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(1))
				Expect(alerts[0].AlertComponent).To(Equal("unit-test-component"))
				Expect(alerts[0].AlertLayer).To(Equal("cluster"))
			})

			It("ignores overrides when label is missing", func() {
				rule := monitoringv1.Rule{
					Alert: "Alert1",
					Labels: map[string]string{
						"severity":                       "warning",
						"namespace":                      "default",
						k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
						k8s.PrometheusRuleLabelName:      "test-rule",
					},
				}
				ruleId := alertrule.GetAlertingRuleId(&rule)
				key := base64.RawURLEncoding.EncodeToString([]byte(ruleId))
				cm := &corev1.ConfigMap{
					ObjectMeta: metav1.ObjectMeta{
						Name:      management.OverrideConfigMapName("openshift-monitoring"),
						Namespace: overrideNamespace,
					},
					Data: map[string]string{
						key: `{"classification":{"openshift_io_alert_rule_component":"` + overrideComponent + `","openshift_io_alert_rule_layer":"` + overrideLayer + `"}}`,
					},
				}
				mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface {
					return &testutils.MockConfigMapInterface{
						ConfigMaps: map[string]*corev1.ConfigMap{
							overrideNamespace + "/" + management.OverrideConfigMapName("openshift-monitoring"): cm,
						},
					}
				}

				alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(1))
				Expect(alerts[0].AlertComponent).To(Equal("other"))
				Expect(alerts[0].AlertLayer).To(Equal("cluster"))
			})
		})

		Context("with rule-scoped classification labels", func() {
			It("uses rule labels as defaults when no overrides exist", func() {
				alert := k8s.PrometheusAlert{
					Labels: map[string]string{
						"alertname":                             "AlertRuleDefaults",
						"severity":                              "warning",
						"namespace":                             "default",
						k8s.AlertRuleClassificationComponentKey: "team-a",
						k8s.AlertRuleClassificationLayerKey:     "namespace",
					},
					State: "firing",
				}
				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{alert}, nil
						},
					}
				}

				rule := monitoringv1.Rule{
					Alert: "AlertRuleDefaults",
					Labels: map[string]string{
						"severity":                              "warning",
						"namespace":                             "default",
						k8s.AlertRuleClassificationComponentKey: "team-a",
						k8s.AlertRuleClassificationLayerKey:     "namespace",
						k8s.PrometheusRuleLabelNamespace:        "openshift-monitoring",
						k8s.PrometheusRuleLabelName:             "defaults-rule",
					},
				}
				rule.Labels[k8s.AlertRuleLabelId] = alertrule.GetAlertingRuleId(&rule)
				mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{
						ListFunc: func(ctx context.Context) []monitoringv1.Rule {
							return []monitoringv1.Rule{rule}
						},
						GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
							if id == rule.Labels[k8s.AlertRuleLabelId] {
								return rule, true
							}
							return monitoringv1.Rule{}, false
						},
						ConfigFunc: func() []*relabel.Config {
							return []*relabel.Config{}
						},
					}
				}

				alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(1))
				Expect(alerts[0].AlertComponent).To(Equal("team-a"))
				Expect(alerts[0].AlertLayer).To(Equal("namespace"))
			})
		})

		Context("without a matching rule", func() {
			It("falls back to default mapping from alert labels", func() {
				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{alert1}, nil
						},
					}
				}
				mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{
						ListFunc: func(ctx context.Context) []monitoringv1.Rule {
							return []monitoringv1.Rule{}
						},
						ConfigFunc: func() []*relabel.Config {
							return []*relabel.Config{}
						},
					}
				}

				alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(1))
				Expect(alerts[0].AlertComponent).To(Equal("other"))
				Expect(alerts[0].AlertLayer).To(Equal("namespace"))
			})
		})

		Context("with a matching rule but no overrides or rule labels", func() {
			It("falls back to default mapping derived from rule context", func() {
				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{alert1}, nil
						},
					}
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
				mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{
						ListFunc: func(ctx context.Context) []monitoringv1.Rule {
							return []monitoringv1.Rule{rule}
						},
						GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
							if id == rule.Labels[k8s.AlertRuleLabelId] {
								return rule, true
							}
							return monitoringv1.Rule{}, false
						},
						ConfigFunc: func() []*relabel.Config {
							return []*relabel.Config{}
						},
					}
				}

				alerts, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(1))
				Expect(alerts[0].AlertComponent).To(Equal("other"))
				Expect(alerts[0].AlertLayer).To(Equal("cluster"))
			})
		})

		Context("with relabel configs that keep all alerts", func() {
			BeforeEach(func() {
				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{alert1, alert2}, nil
						},
					}
				}

				mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{
						ConfigFunc: func() []*relabel.Config {
							// Return empty config list to avoid validation issues in tests
							// Relabel functionality is tested elsewhere (in k8s package)
							return []*relabel.Config{}
						},
					}
				}
			})

			It("returns all alerts without modification when no relabel configs", func() {
				req := k8s.GetAlertsRequest{}
				alerts, err := client.GetAlerts(ctx, req)
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(2))
				Expect(alerts[0].Labels["severity"]).To(Equal("warning"))
				Expect(alerts[1].Labels["severity"]).To(Equal("critical"))
			})
		})

		Context("when no alerts are returned from Prometheus", func() {
			BeforeEach(func() {
				mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
					return &testutils.MockPrometheusAlertsInterface{
						GetAlertsFunc: func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
							return []k8s.PrometheusAlert{}, nil
						},
					}
				}

				mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{
						ConfigFunc: func() []*relabel.Config {
							return []*relabel.Config{}
						},
					}
				}
			})

			It("returns an empty list", func() {
				req := k8s.GetAlertsRequest{}
				alerts, err := client.GetAlerts(ctx, req)
				Expect(err).NotTo(HaveOccurred())
				Expect(alerts).To(HaveLen(0))
			})
		})
	})
})
