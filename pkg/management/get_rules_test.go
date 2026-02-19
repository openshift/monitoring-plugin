package management_test

import (
	"context"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/relabel"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

var _ = Describe("GetRules", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client
	)

	BeforeEach(func() {
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)
	})

	Context("when PrometheusAlerts returns rule groups", func() {
		BeforeEach(func() {
			mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
				return &testutils.MockPrometheusAlertsInterface{
					GetRulesFunc: func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
						return []k8s.PrometheusRuleGroup{
							{
								Name: "group-a",
								Rules: []k8s.PrometheusRule{
									{
										Name: "rule-a",
										Type: k8s.RuleTypeAlerting,
										Alerts: []k8s.PrometheusRuleAlert{
											{
												State: "firing",
												Labels: map[string]string{
													"alertname": "Alert1",
													"severity":  "warning",
												},
											},
											{
												State: "pending",
												Labels: map[string]string{
													"alertname": "Alert2",
													"severity":  "critical",
												},
											},
											{
												State: "inactive",
												Labels: map[string]string{
													"alertname": "Alert3",
													"severity":  "warning",
												},
											},
										},
									},
								},
							},
						}, nil
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					ListFunc: func(ctx context.Context) []monitoringv1.Rule {
						return []monitoringv1.Rule{}
					},
					ConfigFunc: func() []*relabel.Config {
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
					},
				}
			}
		})

		It("applies relabel configs to pending/firing alerts only", func() {
			groups, err := client.GetRules(ctx, k8s.GetRulesRequest{})
			Expect(err).NotTo(HaveOccurred())
			Expect(groups).To(HaveLen(1))

			rules := groups[0].Rules
			Expect(rules).To(HaveLen(1))

			alerts := rules[0].Alerts
			Expect(alerts).To(HaveLen(2))
			Expect(alerts[0].Labels["alertname"]).To(Equal("Alert1"))
			Expect(alerts[0].Labels["severity"]).To(Equal("critical"))
			Expect(alerts[1].Labels["alertname"]).To(Equal("Alert3"))
			Expect(alerts[1].Labels["severity"]).To(Equal("warning"))
		})

		It("filters alerts by state and labels", func() {
			req := k8s.GetRulesRequest{
				State:  "firing",
				Labels: map[string]string{"severity": "critical"},
			}
			groups, err := client.GetRules(ctx, req)
			Expect(err).NotTo(HaveOccurred())
			Expect(groups).To(HaveLen(1))

			alerts := groups[0].Rules[0].Alerts
			Expect(alerts).To(HaveLen(1))
			Expect(alerts[0].Labels["alertname"]).To(Equal("Alert1"))
			Expect(alerts[0].Labels["severity"]).To(Equal("critical"))
		})

		It("drops non-matching alerting rules when filters are provided", func() {
			req := k8s.GetRulesRequest{
				State:  "firing",
				Labels: map[string]string{"severity": "does-not-exist"},
			}
			groups, err := client.GetRules(ctx, req)
			Expect(err).NotTo(HaveOccurred())
			Expect(groups).To(BeEmpty())
		})

		It("adds managed-by labels from relabeled rules", func() {
			mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
				return &testutils.MockPrometheusAlertsInterface{
					GetRulesFunc: func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
						return []k8s.PrometheusRuleGroup{
							{
								Name: "group-a",
								Rules: []k8s.PrometheusRule{
									{
										Name:     "AlertWithManagedBy",
										Type:     "alerting",
										Query:    "up == 0",
										Duration: 0,
										Labels:   map[string]string{"severity": "critical"},
										Annotations: map[string]string{
											"summary": "test alert",
										},
									},
								},
							},
						}, nil
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					ListFunc: func(ctx context.Context) []monitoringv1.Rule {
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
								Annotations: map[string]string{
									"summary": "test alert",
								},
							},
						}
					},
					ConfigFunc: func() []*relabel.Config {
						return []*relabel.Config{}
					},
				}
			}

			groups, err := client.GetRules(ctx, k8s.GetRulesRequest{})
			Expect(err).NotTo(HaveOccurred())
			Expect(groups).To(HaveLen(1))

			rule := groups[0].Rules[0]
			Expect(rule.Labels[k8s.AlertRuleLabelId]).To(Equal("alert-id-1"))
			Expect(rule.Labels[k8s.PrometheusRuleLabelNamespace]).To(Equal("openshift-monitoring"))
			Expect(rule.Labels[k8s.PrometheusRuleLabelName]).To(Equal("platform-rule"))
			Expect(rule.Labels[managementlabels.RuleManagedByLabel]).To(Equal("operator"))
			Expect(rule.Labels[managementlabels.RelabelConfigManagedByLabel]).To(Equal("gitops"))
		})

		It("enriches rule labels with id, source, classification, PrometheusRule metadata, and ARC-updated labels", func() {
			mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
				return &testutils.MockPrometheusAlertsInterface{
					GetRulesFunc: func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
						return []k8s.PrometheusRuleGroup{
							{
								Name: "group-a",
								Rules: []k8s.PrometheusRule{
									{
										Name:     "ARCUpdatedRule",
										Type:     "alerting",
										Query:    "up == 0",
										Duration: 0,
										Labels: map[string]string{
											"severity":           "warning",
											k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
										},
									},
								},
							},
						}, nil
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					ListFunc: func(ctx context.Context) []monitoringv1.Rule {
						return []monitoringv1.Rule{
							{
								Alert: "ARCUpdatedRule",
								Expr:  intstr.FromString("up ==\n  0"),
								Labels: map[string]string{
									// ARC-updated / relabeled labels
									"severity": "critical",
									"team":     "sre",

									// Required enrichment
									k8s.AlertRuleLabelId:             "rid-arc-1",
									k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
									k8s.PrometheusRuleLabelName:      "platform-rule",

									// Classification labels
									k8s.AlertRuleClassificationComponentKey: "compute",
									k8s.AlertRuleClassificationLayerKey:     "cluster",

									// Managed-by labels (GitOps/Operator signals)
									managementlabels.RuleManagedByLabel:          "operator",
									managementlabels.RelabelConfigManagedByLabel: "gitops",
								},
							},
						}
					},
					ConfigFunc: func() []*relabel.Config {
						return []*relabel.Config{}
					},
				}
			}

			groups, err := client.GetRules(ctx, k8s.GetRulesRequest{})
			Expect(err).NotTo(HaveOccurred())
			Expect(groups).To(HaveLen(1))
			Expect(groups[0].Rules).To(HaveLen(1))

			rule := groups[0].Rules[0]

			// Source should be preserved from rules API response
			Expect(rule.Labels[k8s.AlertSourceLabel]).To(Equal(k8s.AlertSourcePlatform))

			// Enrichment labels should be present
			Expect(rule.Labels[k8s.AlertRuleLabelId]).To(Equal("rid-arc-1"))
			Expect(rule.Labels[k8s.PrometheusRuleLabelNamespace]).To(Equal("openshift-monitoring"))
			Expect(rule.Labels[k8s.PrometheusRuleLabelName]).To(Equal("platform-rule"))

			// Classification labels should be present
			Expect(rule.Labels[k8s.AlertRuleClassificationComponentKey]).To(Equal("compute"))
			Expect(rule.Labels[k8s.AlertRuleClassificationLayerKey]).To(Equal("cluster"))

			// ARC-updated labels should reflect the relabeled rules view
			Expect(rule.Labels["severity"]).To(Equal("critical"))
			Expect(rule.Labels["team"]).To(Equal("sre"))

			// Managed-by labels should be present
			Expect(rule.Labels[managementlabels.RuleManagedByLabel]).To(Equal("operator"))
			Expect(rule.Labels[managementlabels.RelabelConfigManagedByLabel]).To(Equal("gitops"))
		})

		It("enriches rule labels when relabeled rule has alertname label but empty Alert field", func() {
			mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
				return &testutils.MockPrometheusAlertsInterface{
					GetRulesFunc: func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
						return []k8s.PrometheusRuleGroup{
							{
								Name: "group-a",
								Rules: []k8s.PrometheusRule{
									{
										Name:     "EmptyAlertFieldRule",
										Type:     "alerting",
										Query:    "up == 0",
										Duration: 0,
										Labels: map[string]string{
											"severity":           "warning",
											k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
										},
									},
								},
							},
						}, nil
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					ListFunc: func(ctx context.Context) []monitoringv1.Rule {
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
					ConfigFunc: func() []*relabel.Config {
						return []*relabel.Config{}
					},
				}
			}

			groups, err := client.GetRules(ctx, k8s.GetRulesRequest{})
			Expect(err).NotTo(HaveOccurred())
			Expect(groups).To(HaveLen(1))
			Expect(groups[0].Rules).To(HaveLen(1))

			rule := groups[0].Rules[0]
			Expect(rule.Labels[k8s.AlertSourceLabel]).To(Equal(k8s.AlertSourcePlatform))
			Expect(rule.Labels[k8s.AlertRuleLabelId]).To(Equal("rid-empty-alert-1"))
			Expect(rule.Labels[k8s.PrometheusRuleLabelNamespace]).To(Equal("openshift-monitoring"))
			Expect(rule.Labels[k8s.PrometheusRuleLabelName]).To(Equal("platform-rule"))
			Expect(rule.Labels["severity"]).To(Equal("critical"))
		})

		It("does not guess when multiple relabeled candidates match relaxed criteria", func() {
			mockK8s.PrometheusAlertsFunc = func() k8s.PrometheusAlertsInterface {
				return &testutils.MockPrometheusAlertsInterface{
					GetRulesFunc: func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
						return []k8s.PrometheusRuleGroup{
							{
								Name: "group-a",
								Rules: []k8s.PrometheusRule{
									{
										Name:     "AmbiguousRule",
										Type:     "alerting",
										Query:    "up == 0",
										Duration: 0,
										Labels: map[string]string{
											"severity":           "warning",
											k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
										},
									},
								},
							},
						}, nil
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					ListFunc: func(ctx context.Context) []monitoringv1.Rule {
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
					ConfigFunc: func() []*relabel.Config {
						return []*relabel.Config{}
					},
				}
			}

			groups, err := client.GetRules(ctx, k8s.GetRulesRequest{})
			Expect(err).NotTo(HaveOccurred())
			Expect(groups).To(HaveLen(1))
			Expect(groups[0].Rules).To(HaveLen(1))

			rule := groups[0].Rules[0]
			Expect(rule.Labels[k8s.AlertSourceLabel]).To(Equal(k8s.AlertSourcePlatform))
			Expect(rule.Labels).NotTo(HaveKey(k8s.AlertRuleLabelId))
			Expect(rule.Labels["severity"]).To(Equal("warning"))
		})
	})
})
