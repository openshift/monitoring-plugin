package management_test

import (
	"context"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("ListRules", func() {
	var (
		ctx        context.Context
		mockK8s    *testutils.MockClient
		mockPR     *testutils.MockPrometheusRuleInterface
		mockMapper *testutils.MockMapperClient
		client     management.Client
	)

	BeforeEach(func() {
		ctx = context.Background()

		mockPR = &testutils.MockPrometheusRuleInterface{}
		mockNSInformer := &testutils.MockNamespaceInformerInterface{}
		mockNSInformer.SetMonitoringNamespaces(map[string]bool{
			"platform-namespace-1": true,
			"platform-namespace-2": true,
		})
		mockK8s = &testutils.MockClient{
			PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
				return mockPR
			},
			NamespaceInformerFunc: func() k8s.NamespaceInformerInterface {
				return mockNSInformer
			},
		}
		mockMapper = &testutils.MockMapperClient{
			GetAlertingRuleIdFunc: func(rule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(rule.Alert)
			},
			FindAlertRuleByIdFunc: func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				// Mock successful lookup for all alert rules
				return &mapper.PrometheusRuleId{}, nil
			},
		}

		client = management.NewWithCustomMapper(ctx, mockK8s, mockMapper)
	})

	It("should list rules from a specific PrometheusRule", func() {
		testRule := monitoringv1.Rule{
			Alert: "TestAlert",
			Expr:  intstr.FromString("up == 0"),
		}

		prometheusRule := &monitoringv1.PrometheusRule{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-rule",
				Namespace: "test-namespace",
			},
			Spec: monitoringv1.PrometheusRuleSpec{
				Groups: []monitoringv1.RuleGroup{
					{
						Name:  "test-group",
						Rules: []monitoringv1.Rule{testRule},
					},
				},
			},
		}

		mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
			"test-namespace/test-rule": prometheusRule,
		})

		options := management.PrometheusRuleOptions{
			Name:      "test-rule",
			Namespace: "test-namespace",
			GroupName: "test-group",
		}

		rules, err := client.ListRules(ctx, options, management.AlertRuleOptions{})

		Expect(err).ToNot(HaveOccurred())
		Expect(rules).To(HaveLen(1))
		Expect(rules[0].Alert).To(Equal("TestAlert"))
		Expect(rules[0].Expr.String()).To(Equal("up == 0"))
	})

	It("should list rules from all namespaces", func() {
		testRule1 := monitoringv1.Rule{
			Alert: "TestAlert1",
			Expr:  intstr.FromString("up == 0"),
		}

		testRule2 := monitoringv1.Rule{
			Alert: "TestAlert2",
			Expr:  intstr.FromString("cpu_usage > 80"),
		}

		prometheusRule1 := &monitoringv1.PrometheusRule{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "rule1",
				Namespace: "namespace1",
			},
			Spec: monitoringv1.PrometheusRuleSpec{
				Groups: []monitoringv1.RuleGroup{
					{
						Name:  "group1",
						Rules: []monitoringv1.Rule{testRule1},
					},
				},
			},
		}

		prometheusRule2 := &monitoringv1.PrometheusRule{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "rule2",
				Namespace: "namespace2",
			},
			Spec: monitoringv1.PrometheusRuleSpec{
				Groups: []monitoringv1.RuleGroup{
					{
						Name:  "group2",
						Rules: []monitoringv1.Rule{testRule2},
					},
				},
			},
		}

		mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
			"namespace1/rule1": prometheusRule1,
			"namespace2/rule2": prometheusRule2,
		})

		options := management.PrometheusRuleOptions{}

		rules, err := client.ListRules(ctx, options, management.AlertRuleOptions{})

		Expect(err).ToNot(HaveOccurred())
		Expect(rules).To(HaveLen(2))

		alertNames := []string{rules[0].Alert, rules[1].Alert}
		Expect(alertNames).To(ContainElement("TestAlert1"))
		Expect(alertNames).To(ContainElement("TestAlert2"))
	})

	It("should list all rules from a specific namespace", func() {
		// Setup test data in the same namespace but different PrometheusRules
		testRule1 := monitoringv1.Rule{
			Alert: "NamespaceAlert1",
			Expr:  intstr.FromString("memory_usage > 90"),
		}

		testRule2 := monitoringv1.Rule{
			Alert: "NamespaceAlert2",
			Expr:  intstr.FromString("disk_usage > 85"),
		}

		testRule3 := monitoringv1.Rule{
			Alert: "OtherNamespaceAlert",
			Expr:  intstr.FromString("network_error_rate > 0.1"),
		}

		// PrometheusRule in target namespace
		prometheusRule1 := &monitoringv1.PrometheusRule{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "rule1",
				Namespace: "target-namespace",
			},
			Spec: monitoringv1.PrometheusRuleSpec{
				Groups: []monitoringv1.RuleGroup{
					{
						Name:  "group1",
						Rules: []monitoringv1.Rule{testRule1},
					},
				},
			},
		}

		// Another PrometheusRule in the same target namespace
		prometheusRule2 := &monitoringv1.PrometheusRule{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "rule2",
				Namespace: "target-namespace",
			},
			Spec: monitoringv1.PrometheusRuleSpec{
				Groups: []monitoringv1.RuleGroup{
					{
						Name:  "group2",
						Rules: []monitoringv1.Rule{testRule2},
					},
				},
			},
		}

		// PrometheusRule in a different namespace (should not be included)
		prometheusRule3 := &monitoringv1.PrometheusRule{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "rule3",
				Namespace: "other-namespace",
			},
			Spec: monitoringv1.PrometheusRuleSpec{
				Groups: []monitoringv1.RuleGroup{
					{
						Name:  "group3",
						Rules: []monitoringv1.Rule{testRule3},
					},
				},
			},
		}

		mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
			"target-namespace/rule1": prometheusRule1,
			"target-namespace/rule2": prometheusRule2,
			"other-namespace/rule3":  prometheusRule3,
		})

		options := management.PrometheusRuleOptions{
			Namespace: "target-namespace",
		}

		rules, err := client.ListRules(ctx, options, management.AlertRuleOptions{})

		Expect(err).ToNot(HaveOccurred())
		Expect(rules).To(HaveLen(2))

		alertNames := []string{rules[0].Alert, rules[1].Alert}
		Expect(alertNames).To(ContainElement("NamespaceAlert1"))
		Expect(alertNames).To(ContainElement("NamespaceAlert2"))
		Expect(alertNames).ToNot(ContainElement("OtherNamespaceAlert"))
	})

	Context("AlertRuleOptions filtering", func() {
		var prometheusRule *monitoringv1.PrometheusRule

		BeforeEach(func() {
			prometheusRule = &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-alerts",
					Namespace: "monitoring",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name: "critical-alerts",
							Rules: []monitoringv1.Rule{
								{
									Alert: "HighCPUUsage",
									Expr:  intstr.FromString("cpu_usage > 90"),
									Labels: map[string]string{
										"severity":  "critical",
										"component": "node",
									},
								},
								{
									Alert: "HighCPUUsage",
									Expr:  intstr.FromString("cpu_usage > 80"),
									Labels: map[string]string{
										"severity":  "warning",
										"component": "node",
									},
								},
								{
									Alert: "DiskSpaceLow",
									Expr:  intstr.FromString("disk_usage > 95"),
									Labels: map[string]string{
										"severity":  "critical",
										"component": "storage",
									},
								},
							},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"monitoring/test-alerts": prometheusRule,
			})
		})

		It("should filter by alert name", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "test-alerts",
				Namespace: "monitoring",
			}
			arOptions := management.AlertRuleOptions{
				Name: "HighCPUUsage",
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)

			Expect(err).ToNot(HaveOccurred())
			Expect(rules).To(HaveLen(2))
			Expect(rules[0].Alert).To(Equal("HighCPUUsage"))
			Expect(rules[1].Alert).To(Equal("HighCPUUsage"))
		})

		It("should filter by label severity", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "test-alerts",
				Namespace: "monitoring",
			}
			arOptions := management.AlertRuleOptions{
				Labels: map[string]string{
					"severity": "critical",
				},
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)

			Expect(err).ToNot(HaveOccurred())
			Expect(rules).To(HaveLen(2))

			alertNames := []string{rules[0].Alert, rules[1].Alert}
			Expect(alertNames).To(ContainElement("HighCPUUsage"))
			Expect(alertNames).To(ContainElement("DiskSpaceLow"))

			for _, rule := range rules {
				Expect(rule.Labels["severity"]).To(Equal("critical"))
			}
		})

		It("should filter by multiple labels", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "test-alerts",
				Namespace: "monitoring",
			}
			arOptions := management.AlertRuleOptions{
				Labels: map[string]string{
					"severity":  "critical",
					"component": "storage",
				},
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)

			Expect(err).ToNot(HaveOccurred())
			Expect(rules).To(HaveLen(1))
			Expect(rules[0].Alert).To(Equal("DiskSpaceLow"))
			Expect(rules[0].Labels["severity"]).To(Equal("critical"))
			Expect(rules[0].Labels["component"]).To(Equal("storage"))
		})

		It("should filter by source platform", func() {
			platformRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "openshift-platform-alerts",
					Namespace: "platform-namespace-1",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name: "platform-group",
							Rules: []monitoringv1.Rule{
								{
									Alert: "PlatformAlert",
									Expr:  intstr.FromString("platform_metric > 0"),
								},
							},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"monitoring/test-alerts":                         prometheusRule,
				"platform-namespace-1/openshift-platform-alerts": platformRule,
			})

			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{
				Source: "platform",
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)

			Expect(err).ToNot(HaveOccurred())
			Expect(rules).To(HaveLen(1))
			Expect(rules[0].Alert).To(Equal("PlatformAlert"))
			Expect(rules[0].Labels).To(HaveKeyWithValue("source", "platform"))
		})

		It("should filter by source user-defined", func() {
			platformRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "openshift-platform-alerts",
					Namespace: "platform-namespace-1",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name: "platform-group",
							Rules: []monitoringv1.Rule{
								{
									Alert: "PlatformAlert",
									Expr:  intstr.FromString("platform_metric > 0"),
								},
							},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"monitoring/test-alerts":                         prometheusRule,
				"platform-namespace-1/openshift-platform-alerts": platformRule,
			})

			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{
				Source: "user-defined",
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)

			Expect(err).ToNot(HaveOccurred())
			Expect(rules).To(HaveLen(3))

			alertNames := []string{rules[0].Alert, rules[1].Alert, rules[2].Alert}
			Expect(alertNames).To(ContainElement("HighCPUUsage"))
			Expect(alertNames).To(ContainElement("DiskSpaceLow"))
			Expect(alertNames).ToNot(ContainElement("PlatformAlert"))
		})

		It("should combine multiple filters", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "test-alerts",
				Namespace: "monitoring",
			}
			arOptions := management.AlertRuleOptions{
				Name: "HighCPUUsage",
				Labels: map[string]string{
					"severity": "critical",
				},
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)

			Expect(err).ToNot(HaveOccurred())
			Expect(rules).To(HaveLen(1))
			Expect(rules[0].Alert).To(Equal("HighCPUUsage"))
			Expect(rules[0].Labels["severity"]).To(Equal("critical"))
		})

		It("should return empty list when no rules match filters", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "test-alerts",
				Namespace: "monitoring",
			}
			arOptions := management.AlertRuleOptions{
				Name: "NonExistentAlert",
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)

			Expect(err).ToNot(HaveOccurred())
			Expect(rules).To(BeEmpty())
		})
	})
})
