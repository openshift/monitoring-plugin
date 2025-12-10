package mapper_test

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/tools/cache"

	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("Mapper", func() {
	var (
		mockK8sClient *testutils.MockClient
		mapperClient  mapper.Client
	)

	BeforeEach(func() {
		mockK8sClient = &testutils.MockClient{}
		mapperClient = mapper.New(mockK8sClient)
	})

	createPrometheusRule := func(namespace, name string, alertRules []monitoringv1.Rule) *monitoringv1.PrometheusRule {
		return &monitoringv1.PrometheusRule{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: namespace,
				Name:      name,
			},
			Spec: monitoringv1.PrometheusRuleSpec{
				Groups: []monitoringv1.RuleGroup{
					{
						Name:  "test-group",
						Rules: alertRules,
					},
				},
			},
		}
	}

	Describe("GetAlertingRuleId", func() {
		Context("when generating IDs for alert rules", func() {
			It("should generate a non-empty ID for a simple alert rule", func() {
				By("creating a simple alert rule")
				alertRule := monitoringv1.Rule{
					Alert: "TestAlert",
					Expr:  intstr.FromString("up == 0"),
				}

				By("generating the rule ID")
				ruleId := mapperClient.GetAlertingRuleId(&alertRule)

				By("verifying the result")
				Expect(ruleId).NotTo(BeEmpty())
				Expect(string(ruleId)).To(HaveLen(len(alertRule.Alert) + 1 + 64)) // alertname + separator + SHA256 hash should be 64 characters
			})

			It("should generate different IDs for different alert rules", func() {
				By("creating two different alert rules")
				alertRule1 := monitoringv1.Rule{
					Alert: "TestAlert1",
					Expr:  intstr.FromString("up == 0"),
				}
				alertRule2 := monitoringv1.Rule{
					Alert: "TestAlert2",
					Expr:  intstr.FromString("cpu > 80"),
				}

				By("generating rule IDs")
				ruleId1 := mapperClient.GetAlertingRuleId(&alertRule1)
				ruleId2 := mapperClient.GetAlertingRuleId(&alertRule2)

				By("verifying the results")
				Expect(ruleId1).NotTo(BeEmpty())
				Expect(ruleId2).NotTo(BeEmpty())
				Expect(ruleId1).NotTo(Equal(ruleId2))
			})

			It("should generate the same ID for identical alert rules", func() {
				By("creating two identical alert rules")
				alertRule1 := monitoringv1.Rule{
					Alert: "TestAlert",
					Expr:  intstr.FromString("up == 0"),
				}
				alertRule2 := monitoringv1.Rule{
					Alert: "TestAlert",
					Expr:  intstr.FromString("up == 0"),
				}

				By("generating rule IDs")
				ruleId1 := mapperClient.GetAlertingRuleId(&alertRule1)
				ruleId2 := mapperClient.GetAlertingRuleId(&alertRule2)

				By("verifying the results")
				Expect(ruleId1).NotTo(BeEmpty())
				Expect(ruleId2).NotTo(BeEmpty())
				Expect(ruleId1).To(Equal(ruleId2))
			})

			It("should return empty string for rules without alert or record name", func() {
				By("creating a rule without alert or record name")
				alertRule := monitoringv1.Rule{
					Expr: intstr.FromString("up == 0"),
				}

				By("generating the rule ID")
				ruleId := mapperClient.GetAlertingRuleId(&alertRule)

				By("verifying the result")
				Expect(ruleId).To(BeEmpty())
			})
		})
	})

	Describe("FindAlertRuleById", func() {
		Context("when the alert rule exists", func() {
			It("should return the correct PrometheusRuleId", func() {
				By("creating test alert rule")
				alertRule := monitoringv1.Rule{
					Alert: "TestAlert",
					Expr:  intstr.FromString("up == 0"),
				}

				By("creating PrometheusRule")
				pr := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{alertRule})

				By("adding the PrometheusRule to the mapper")
				mapperClient.AddPrometheusRule(pr)

				By("getting the generated rule ID")
				ruleId := mapperClient.GetAlertingRuleId(&alertRule)
				Expect(ruleId).NotTo(BeEmpty())

				By("testing FindAlertRuleById")
				foundPrometheusRuleId, err := mapperClient.FindAlertRuleById(ruleId)

				By("verifying results")
				Expect(err).NotTo(HaveOccurred())
				expectedPrometheusRuleId := mapper.PrometheusRuleId(types.NamespacedName{
					Namespace: "test-namespace",
					Name:      "test-rule",
				})
				Expect(*foundPrometheusRuleId).To(Equal(expectedPrometheusRuleId))
			})

			It("should return the correct PrometheusRuleId when alert rule is one of multiple in the same PrometheusRule", func() {
				By("creating multiple test alert rules")
				alertRule1 := monitoringv1.Rule{
					Alert: "TestAlert1",
					Expr:  intstr.FromString("up == 0"),
				}
				alertRule2 := monitoringv1.Rule{
					Alert: "TestAlert2",
					Expr:  intstr.FromString("cpu > 80"),
				}

				By("creating PrometheusRule with multiple rules")
				pr := createPrometheusRule("multi-namespace", "multi-rule", []monitoringv1.Rule{alertRule1, alertRule2})

				By("adding the PrometheusRule to the mapper")
				mapperClient.AddPrometheusRule(pr)

				By("getting the generated rule IDs")
				ruleId1 := mapperClient.GetAlertingRuleId(&alertRule1)
				ruleId2 := mapperClient.GetAlertingRuleId(&alertRule2)
				Expect(ruleId1).NotTo(BeEmpty())
				Expect(ruleId2).NotTo(BeEmpty())
				Expect(ruleId1).NotTo(Equal(ruleId2))

				By("testing FindAlertRuleById for both rules")
				expectedPrometheusRuleId := mapper.PrometheusRuleId(types.NamespacedName{
					Namespace: "multi-namespace",
					Name:      "multi-rule",
				})

				foundPrometheusRuleId1, err1 := mapperClient.FindAlertRuleById(ruleId1)
				Expect(err1).NotTo(HaveOccurred())
				Expect(*foundPrometheusRuleId1).To(Equal(expectedPrometheusRuleId))

				foundPrometheusRuleId2, err2 := mapperClient.FindAlertRuleById(ruleId2)
				Expect(err2).NotTo(HaveOccurred())
				Expect(*foundPrometheusRuleId2).To(Equal(expectedPrometheusRuleId))
			})
		})

		Context("when the alert rule does not exist", func() {
			It("should return an error when no rules are mapped", func() {
				By("setting up test data")
				nonExistentRuleId := mapper.PrometheusAlertRuleId("non-existent-rule-id")

				By("testing the method")
				_, err := mapperClient.FindAlertRuleById(nonExistentRuleId)

				By("verifying results")
				Expect(err).To(HaveOccurred())
				Expect(err.Error()).To(ContainSubstring("alert rule with id non-existent-rule-id not found"))
			})

			It("should return an error when rules are mapped but the target rule is not found", func() {
				By("creating and adding a valid alert rule")
				alertRule := monitoringv1.Rule{
					Alert: "ValidAlert",
					Expr:  intstr.FromString("up == 0"),
				}
				pr := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{alertRule})
				mapperClient.AddPrometheusRule(pr)

				By("trying to find a non-existent rule ID")
				nonExistentRuleId := mapper.PrometheusAlertRuleId("definitely-non-existent-rule-id")

				By("testing the method")
				_, err := mapperClient.FindAlertRuleById(nonExistentRuleId)

				By("verifying results")
				Expect(err).To(HaveOccurred())
				Expect(err.Error()).To(ContainSubstring("alert rule with id definitely-non-existent-rule-id not found"))
			})
		})
	})

	Describe("AddPrometheusRule", func() {
		Context("when adding PrometheusRules", func() {
			It("should successfully add a PrometheusRule with alert rules", func() {
				By("creating a PrometheusRule with alert rules")
				alertRule1 := monitoringv1.Rule{
					Alert: "TestAlert1",
					Expr:  intstr.FromString("up == 0"),
				}
				alertRule2 := monitoringv1.Rule{
					Alert: "TestAlert2",
					Expr:  intstr.FromString("cpu > 80"),
				}

				pr := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{alertRule1, alertRule2})

				By("adding the PrometheusRule")
				mapperClient.AddPrometheusRule(pr)

				By("verifying the rules can be found")
				ruleId1 := mapperClient.GetAlertingRuleId(&alertRule1)
				foundPr1, err1 := mapperClient.FindAlertRuleById(ruleId1)
				Expect(err1).ToNot(HaveOccurred())
				Expect(foundPr1.Namespace).To(Equal("test-namespace"))
				Expect(foundPr1.Name).To(Equal("test-rule"))

				ruleId2 := mapperClient.GetAlertingRuleId(&alertRule2)
				foundPr2, err2 := mapperClient.FindAlertRuleById(ruleId2)
				Expect(err2).ToNot(HaveOccurred())
				Expect(foundPr2.Namespace).To(Equal("test-namespace"))
				Expect(foundPr2.Name).To(Equal("test-rule"))
			})

			It("should update existing PrometheusRule when added again", func() {
				By("creating and adding initial PrometheusRule")
				alertRule1 := monitoringv1.Rule{
					Alert: "TestAlert1",
					Expr:  intstr.FromString("up == 0"),
				}
				pr1 := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{alertRule1})
				mapperClient.AddPrometheusRule(pr1)

				By("creating updated PrometheusRule with different alerts")
				alertRule2 := monitoringv1.Rule{
					Alert: "TestAlert2",
					Expr:  intstr.FromString("cpu > 80"),
				}
				pr2 := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{alertRule2})
				mapperClient.AddPrometheusRule(pr2)

				By("verifying old rule is no longer found")
				ruleId1 := mapperClient.GetAlertingRuleId(&alertRule1)
				_, err1 := mapperClient.FindAlertRuleById(ruleId1)
				Expect(err1).To(HaveOccurred())

				By("verifying new rule is found")
				ruleId2 := mapperClient.GetAlertingRuleId(&alertRule2)
				foundPr, err2 := mapperClient.FindAlertRuleById(ruleId2)
				Expect(err2).ToNot(HaveOccurred())
				Expect(foundPr.Namespace).To(Equal("test-namespace"))
			})

			It("should ignore recording rules (not alert rules)", func() {
				By("creating a PrometheusRule with recording rule")
				recordingRule := monitoringv1.Rule{
					Record: "test:recording:rule",
					Expr:   intstr.FromString("sum(up)"),
				}

				pr := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{recordingRule})

				By("adding the PrometheusRule")
				mapperClient.AddPrometheusRule(pr)

				By("verifying the recording rule is not found")
				ruleId := mapperClient.GetAlertingRuleId(&recordingRule)
				_, err := mapperClient.FindAlertRuleById(ruleId)
				Expect(err).To(HaveOccurred())
			})
		})
	})

	Describe("DeletePrometheusRule", func() {
		Context("when deleting PrometheusRules", func() {
			It("should successfully delete a PrometheusRule", func() {
				By("creating and adding a PrometheusRule")
				alertRule := monitoringv1.Rule{
					Alert: "TestAlert",
					Expr:  intstr.FromString("up == 0"),
				}
				pr := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{alertRule})
				mapperClient.AddPrometheusRule(pr)

				By("verifying the rule exists")
				ruleId := mapperClient.GetAlertingRuleId(&alertRule)
				_, err := mapperClient.FindAlertRuleById(ruleId)
				Expect(err).ToNot(HaveOccurred())

				By("deleting the PrometheusRule")
				mapperClient.DeletePrometheusRule(cache.ObjectName(types.NamespacedName{Namespace: pr.Namespace, Name: pr.Name}))

				By("verifying the rule is no longer found")
				_, err = mapperClient.FindAlertRuleById(ruleId)
				Expect(err).To(HaveOccurred())
				Expect(err.Error()).To(ContainSubstring("not found"))
			})

			It("should handle deleting non-existent PrometheusRule gracefully", func() {
				By("creating a PrometheusRule that was never added")
				alertRule := monitoringv1.Rule{
					Alert: "TestAlert",
					Expr:  intstr.FromString("up == 0"),
				}
				pr := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{alertRule})

				By("deleting the non-existent PrometheusRule")
				Expect(func() {
					mapperClient.DeletePrometheusRule(cache.ObjectName(types.NamespacedName{Namespace: pr.Namespace, Name: pr.Name}))
				}).NotTo(Panic())

				By("verifying mapper still works after delete attempt")
				// Add a different rule to verify the mapper is still functional
				alertRule2 := monitoringv1.Rule{
					Alert: "AnotherAlert",
					Expr:  intstr.FromString("cpu > 80"),
				}
				pr2 := createPrometheusRule("test-namespace", "another-rule", []monitoringv1.Rule{alertRule2})
				mapperClient.AddPrometheusRule(pr2)

				ruleId := mapperClient.GetAlertingRuleId(&alertRule2)
				foundPr, err := mapperClient.FindAlertRuleById(ruleId)
				Expect(err).ToNot(HaveOccurred())
				Expect(foundPr.Name).To(Equal("another-rule"))
			})
		})
	})

	Describe("AddAlertRelabelConfig", func() {
		Context("when adding AlertRelabelConfigs", func() {
			It("should successfully add an AlertRelabelConfig", func() {
				By("creating an AlertRelabelConfig")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname", "severity"},
								Separator:    ";",
								Regex:        "TestAlert;critical",
								TargetLabel:  "severity",
								Replacement:  "warning",
								Action:       "Replace",
							},
						},
					},
				}

				By("adding the AlertRelabelConfig")
				mapperClient.AddAlertRelabelConfig(arc)

				By("verifying it can be retrieved")
				alertRule := &monitoringv1.Rule{
					Alert: "TestAlert",
					Labels: map[string]string{
						"severity": "critical",
					},
				}
				configs := mapperClient.GetAlertRelabelConfigSpec(alertRule)
				Expect(configs).To(HaveLen(1))
				Expect(configs[0].SourceLabels).To(ContainElement(osmv1.LabelName("alertname")))
				Expect(configs[0].Regex).To(Equal("TestAlert;critical"))
			})

			It("should ignore configs without alertname in SourceLabels", func() {
				By("creating an AlertRelabelConfig without alertname")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"severity", "namespace"},
								Separator:    ";",
								Regex:        "critical;default",
								TargetLabel:  "priority",
								Replacement:  "high",
								Action:       "Replace",
							},
						},
					},
				}

				By("adding the AlertRelabelConfig")
				mapperClient.AddAlertRelabelConfig(arc)

				By("verifying it returns empty for an alert")
				alertRule := &monitoringv1.Rule{
					Alert: "TestAlert",
					Labels: map[string]string{
						"severity":  "critical",
						"namespace": "default",
					},
				}
				specs := mapperClient.GetAlertRelabelConfigSpec(alertRule)
				Expect(specs).To(BeEmpty())
			})

			It("should update existing AlertRelabelConfig when added again", func() {
				By("creating and adding initial AlertRelabelConfig")
				arc1 := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "Alert1",
								TargetLabel:  "severity",
								Replacement:  "warning",
								Action:       "Replace",
							},
						},
					},
				}
				mapperClient.AddAlertRelabelConfig(arc1)

				By("creating updated AlertRelabelConfig")
				arc2 := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "Alert2",
								TargetLabel:  "severity",
								Replacement:  "critical",
								Action:       "Replace",
							},
						},
					},
				}
				mapperClient.AddAlertRelabelConfig(arc2)

				By("verifying the updated config is retrieved")
				alertRule := &monitoringv1.Rule{
					Alert: "Alert2",
				}
				configs := mapperClient.GetAlertRelabelConfigSpec(alertRule)
				Expect(configs).To(HaveLen(1))
				Expect(configs[0].Regex).To(Equal("Alert2"))
			})

			It("should handle multiple relabel configs in single AlertRelabelConfig", func() {
				By("creating AlertRelabelConfig with multiple configs")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "Alert1",
								TargetLabel:  "severity",
								Replacement:  "warning",
								Action:       "Replace",
							},
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "Alert2",
								TargetLabel:  "priority",
								Replacement:  "high",
								Action:       "Replace",
							},
						},
					},
				}

				By("adding the AlertRelabelConfig")
				mapperClient.AddAlertRelabelConfig(arc)

				By("verifying Alert1 gets its matching config")
				alertRule1 := &monitoringv1.Rule{
					Alert: "Alert1",
				}
				specs1 := mapperClient.GetAlertRelabelConfigSpec(alertRule1)
				Expect(specs1).To(HaveLen(1))
				Expect(specs1[0].TargetLabel).To(Equal("severity"))

				By("verifying Alert2 gets its matching config")
				alertRule2 := &monitoringv1.Rule{
					Alert: "Alert2",
				}
				specs2 := mapperClient.GetAlertRelabelConfigSpec(alertRule2)
				Expect(specs2).To(HaveLen(1))
				Expect(specs2[0].TargetLabel).To(Equal("priority"))
			})

			It("should handle configs with empty regex", func() {
				By("creating AlertRelabelConfig with empty regex")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "",
								TargetLabel:  "severity",
								Replacement:  "warning",
								Action:       "Replace",
							},
						},
					},
				}

				By("adding the AlertRelabelConfig")
				mapperClient.AddAlertRelabelConfig(arc)

				By("verifying it's ignored (empty regex)")
				alertRule := &monitoringv1.Rule{
					Alert: "TestAlert",
				}
				specs := mapperClient.GetAlertRelabelConfigSpec(alertRule)
				Expect(specs).To(BeEmpty())
			})

			It("should handle configs where regex values don't match source labels count", func() {
				By("creating AlertRelabelConfig with mismatched regex/labels")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname", "severity"},
								Separator:    ";",
								Regex:        "OnlyOneValue",
								TargetLabel:  "severity",
								Replacement:  "warning",
								Action:       "Replace",
							},
						},
					},
				}

				By("adding the AlertRelabelConfig")
				mapperClient.AddAlertRelabelConfig(arc)

				By("verifying it's ignored (mismatch)")
				alertRule := &monitoringv1.Rule{
					Alert: "OnlyOneValue",
					Labels: map[string]string{
						"severity": "critical",
					},
				}
				specs := mapperClient.GetAlertRelabelConfigSpec(alertRule)
				Expect(specs).To(BeEmpty())
			})
		})
	})

	Describe("DeleteAlertRelabelConfig", func() {
		Context("when deleting AlertRelabelConfigs", func() {
			It("should successfully delete an AlertRelabelConfig", func() {
				By("creating and adding an AlertRelabelConfig")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "TestAlert",
								TargetLabel:  "severity",
								Replacement:  "warning",
								Action:       "Replace",
							},
						},
					},
				}
				mapperClient.AddAlertRelabelConfig(arc)

				By("verifying it exists")
				alertRule := &monitoringv1.Rule{
					Alert: "TestAlert",
				}
				specs := mapperClient.GetAlertRelabelConfigSpec(alertRule)
				Expect(specs).To(HaveLen(1))

				By("deleting the AlertRelabelConfig")
				mapperClient.DeleteAlertRelabelConfig(cache.ObjectName(types.NamespacedName{Namespace: arc.Namespace, Name: arc.Name}))

				By("verifying it's no longer found")
				specs = mapperClient.GetAlertRelabelConfigSpec(alertRule)
				Expect(specs).To(BeEmpty())
			})

			It("should handle deleting non-existent AlertRelabelConfig gracefully", func() {
				By("creating an AlertRelabelConfig that was never added")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{},
					},
				}

				By("deleting the non-existent AlertRelabelConfig")
				Expect(func() {
					mapperClient.DeleteAlertRelabelConfig(cache.ObjectName(types.NamespacedName{Namespace: arc.Namespace, Name: arc.Name}))
				}).NotTo(Panic())

				By("verifying mapper still works after delete attempt")
				// Add a different AlertRelabelConfig to verify the mapper is still functional
				arc2 := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "another-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "TestAlert",
								TargetLabel:  "severity",
								Replacement:  "critical",
								Action:       "Replace",
							},
						},
					},
				}
				mapperClient.AddAlertRelabelConfig(arc2)

				alertRule := &monitoringv1.Rule{
					Alert: "TestAlert",
				}
				configs := mapperClient.GetAlertRelabelConfigSpec(alertRule)
				Expect(configs).To(HaveLen(1))
				Expect(configs[0].Regex).To(Equal("TestAlert"))
			})
		})
	})

	Describe("GetAlertRelabelConfigSpec", func() {
		Context("when retrieving AlertRelabelConfig specs", func() {
			It("should return specs for existing AlertRelabelConfig", func() {
				By("creating and adding an AlertRelabelConfig")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname", "severity"},
								Separator:    ";",
								Regex:        "TestAlert;critical",
								TargetLabel:  "priority",
								Replacement:  "high",
								Action:       "Replace",
							},
						},
					},
				}
				mapperClient.AddAlertRelabelConfig(arc)

				By("retrieving the configs")
				alertRule := &monitoringv1.Rule{
					Alert: "TestAlert",
					Labels: map[string]string{
						"severity": "critical",
					},
				}
				configs := mapperClient.GetAlertRelabelConfigSpec(alertRule)

				By("verifying the configs")
				Expect(configs).To(HaveLen(1))
				Expect(configs[0].TargetLabel).To(Equal("priority"))
				Expect(configs[0].Replacement).To(Equal("high"))
				Expect(configs[0].SourceLabels).To(ContainElements(osmv1.LabelName("alertname"), osmv1.LabelName("severity")))
				Expect(configs[0].Regex).To(Equal("TestAlert;critical"))
			})

			It("should return empty for alert that doesn't match any config", func() {
				By("trying to get specs for an alert that doesn't match")
				alertRule := &monitoringv1.Rule{
					Alert: "NonMatchingAlert",
					Labels: map[string]string{
						"severity": "info",
					},
				}
				specs := mapperClient.GetAlertRelabelConfigSpec(alertRule)

				By("verifying empty is returned")
				Expect(specs).To(BeEmpty())
			})

			It("should return copies of specs (not original pointers)", func() {
				By("creating and adding an AlertRelabelConfig")
				arc := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "TestAlert",
								TargetLabel:  "severity",
								Replacement:  "warning",
								Action:       "Replace",
							},
						},
					},
				}
				mapperClient.AddAlertRelabelConfig(arc)

				By("retrieving configs twice")
				alertRule := &monitoringv1.Rule{
					Alert: "TestAlert",
				}
				configs1 := mapperClient.GetAlertRelabelConfigSpec(alertRule)
				configs2 := mapperClient.GetAlertRelabelConfigSpec(alertRule)

				By("verifying they are independent copies")
				Expect(configs1).To(HaveLen(1))
				Expect(configs2).To(HaveLen(1))
				// Modify one and verify the other is unchanged
				configs1[0].Replacement = "modified"
				Expect(configs2[0].Replacement).To(Equal("warning"))
			})
		})
	})

	Describe("GetAlertRelabelConfigSpec with matching alerts", func() {
		Context("when alert rule matches AlertRelabelConfig", func() {
			It("should return matching configs from all AlertRelabelConfigs", func() {
				By("creating and adding a PrometheusRule")
				alertRule := monitoringv1.Rule{
					Alert: "TestAlert",
					Expr:  intstr.FromString("up == 0"),
					Labels: map[string]string{
						"severity": "critical",
					},
				}
				pr := createPrometheusRule("test-namespace", "test-rule", []monitoringv1.Rule{alertRule})
				mapperClient.AddPrometheusRule(pr)

				By("creating and adding first AlertRelabelConfig")
				arc1 := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc-1",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname"},
								Separator:    ";",
								Regex:        "TestAlert",
								TargetLabel:  "priority",
								Replacement:  "high",
								Action:       "Replace",
							},
						},
					},
				}
				mapperClient.AddAlertRelabelConfig(arc1)

				By("creating and adding second AlertRelabelConfig")
				arc2 := &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-arc-2",
						Namespace: "test-namespace",
					},
					Spec: osmv1.AlertRelabelConfigSpec{
						Configs: []osmv1.RelabelConfig{
							{
								SourceLabels: []osmv1.LabelName{"alertname", "severity"},
								Separator:    ";",
								Regex:        "TestAlert;critical",
								TargetLabel:  "team",
								Replacement:  "platform",
								Action:       "Replace",
							},
						},
					},
				}
				mapperClient.AddAlertRelabelConfig(arc2)

				By("getting matching configs for the alert")
				configs := mapperClient.GetAlertRelabelConfigSpec(&alertRule)

				By("verifying both configs are returned")
				Expect(configs).To(HaveLen(2))
				// Verify first config
				targetLabels := []string{configs[0].TargetLabel, configs[1].TargetLabel}
				Expect(targetLabels).To(ContainElements("priority", "team"))
			})
		})
	})
})
