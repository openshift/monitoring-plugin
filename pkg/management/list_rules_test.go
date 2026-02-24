package management_test

import (
	"context"
	"errors"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("ListRules", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client
	)

	var (
		rule1 = monitoringv1.Rule{
			Alert: "Alert1",
			Expr:  intstr.FromString("up == 0"),
			Labels: map[string]string{
				"severity":                       "warning",
				k8s.PrometheusRuleLabelNamespace: "namespace1",
				k8s.PrometheusRuleLabelName:      "rule1",
			},
		}

		rule2 = monitoringv1.Rule{
			Alert: "Alert2",
			Expr:  intstr.FromString("up == 0"),
			Labels: map[string]string{
				"severity":                       "critical",
				k8s.PrometheusRuleLabelNamespace: "namespace1",
				k8s.PrometheusRuleLabelName:      "rule2",
			},
		}

		rule3 = monitoringv1.Rule{
			Alert: "Alert3",
			Expr:  intstr.FromString("down == 1"),
			Labels: map[string]string{
				"severity":                       "warning",
				k8s.PrometheusRuleLabelNamespace: "namespace2",
				k8s.PrometheusRuleLabelName:      "rule3",
			},
		}

		platformRule = monitoringv1.Rule{
			Alert: "PlatformAlert",
			Expr:  intstr.FromString("node_down == 1"),
			Labels: map[string]string{
				"severity":                       "critical",
				k8s.AlertSourceLabel:             k8s.AlertSourcePlatform,
				k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
				k8s.PrometheusRuleLabelName:      "platform-rule",
			},
		}

		customLabelRule = monitoringv1.Rule{
			Alert: "CustomLabelAlert",
			Expr:  intstr.FromString("custom == 1"),
			Labels: map[string]string{
				"severity":                       "info",
				"team":                           "backend",
				"env":                            "production",
				k8s.PrometheusRuleLabelNamespace: "namespace1",
				k8s.PrometheusRuleLabelName:      "rule1",
			},
		}
	)

	BeforeEach(func() {
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)

		mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(ctx context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{rule1, rule2, rule3, platformRule, customLabelRule}
				},
			}
		}
	})

	Context("when PrometheusRule Name is provided without Namespace", func() {
		It("returns a ValidationError", func() {
			prOptions := management.PrometheusRuleOptions{
				Name: "rule1",
			}
			arOptions := management.AlertRuleOptions{}

			_, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).To(HaveOccurred())

			var ve *management.ValidationError
			Expect(errors.As(err, &ve)).To(BeTrue(), "expected error to be a ValidationError")
			Expect(err.Error()).To(ContainSubstring("namespace is required when prometheusRuleName is specified"))
		})
	})

	Context("when no filters are provided", func() {
		It("returns all rules", func() {
			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(5))
		})
	})

	Context("when filtering by PrometheusRule Name and Namespace", func() {
		It("returns only rules from the specified PrometheusRule", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "rule1",
				Namespace: "namespace1",
			}
			arOptions := management.AlertRuleOptions{}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(2))
			Expect(rules[0].Alert).To(BeElementOf("Alert1", "CustomLabelAlert"))
			Expect(rules[1].Alert).To(BeElementOf("Alert1", "CustomLabelAlert"))
		})

		It("returns empty list when no rules match", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "nonexistent",
				Namespace: "namespace1",
			}
			arOptions := management.AlertRuleOptions{}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(0))
		})
	})

	Context("when filtering by alert name", func() {
		It("returns only rules with matching alert name", func() {
			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{
				Name: "Alert1",
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(1))
			Expect(rules[0].Alert).To(Equal("Alert1"))
		})

		It("returns empty list when alert name doesn't match", func() {
			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{
				Name: "NonexistentAlert",
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(0))
		})
	})

	Context("when filtering by source=platform", func() {
		It("returns only platform rules", func() {
			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{
				Source: k8s.AlertSourcePlatform,
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(1))
			Expect(rules[0].Alert).To(Equal("PlatformAlert"))
			Expect(rules[0].Labels[k8s.AlertSourceLabel]).To(Equal(k8s.AlertSourcePlatform))
		})
	})

	Context("when filtering by labels", func() {
		It("returns rules matching a single label", func() {
			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{
				Labels: map[string]string{
					"severity": "warning",
				},
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(2))
		})

		It("returns rules matching multiple labels", func() {
			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{
				Labels: map[string]string{
					"team": "backend",
					"env":  "production",
				},
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(1))
			Expect(rules[0].Alert).To(Equal("CustomLabelAlert"))
		})

		It("returns empty list when labels don't match", func() {
			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{
				Labels: map[string]string{
					"nonexistent": "value",
				},
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(0))
		})
	})

	Context("when combining multiple filters", func() {
		It("returns rules matching all filters", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "rule1",
				Namespace: "namespace1",
			}
			arOptions := management.AlertRuleOptions{
				Labels: map[string]string{
					"severity": "warning",
				},
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(1))
			Expect(rules[0].Alert).To(Equal("Alert1"))
		})

		It("returns empty list when some filters don't match", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "rule1",
				Namespace: "namespace1",
			}
			arOptions := management.AlertRuleOptions{
				Labels: map[string]string{
					"severity": "critical",
				},
			}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(0))
		})
	})

	Context("when RelabeledRules returns empty list", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					ListFunc: func(ctx context.Context) []monitoringv1.Rule {
						return []monitoringv1.Rule{}
					},
				}
			}
		})

		It("returns empty list", func() {
			prOptions := management.PrometheusRuleOptions{}
			arOptions := management.AlertRuleOptions{}

			rules, err := client.ListRules(ctx, prOptions, arOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(rules).To(HaveLen(0))
		})
	})
})
