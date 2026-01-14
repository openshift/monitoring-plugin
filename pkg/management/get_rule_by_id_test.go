package management_test

import (
	"context"
	"errors"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("GetRuleById", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client
	)

	var (
		testRule = monitoringv1.Rule{
			Alert: "TestAlert",
			Expr:  intstr.FromString("up == 0"),
			Labels: map[string]string{
				"severity":                       "warning",
				k8s.PrometheusRuleLabelNamespace: "test-namespace",
				k8s.PrometheusRuleLabelName:      "test-rule",
			},
		}
		testRuleId = alertrule.GetAlertingRuleId(&testRule)
	)

	BeforeEach(func() {
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)
	})

	Context("when rule is found", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == testRuleId {
							return testRule, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}
		})

		It("returns the rule", func() {
			rule, err := client.GetRuleById(ctx, testRuleId)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Alert).To(Equal("TestAlert"))
			Expect(rule.Labels["severity"]).To(Equal("warning"))
		})
	})

	Context("when rule is not found", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
		})

		It("returns NotFoundError", func() {
			_, err := client.GetRuleById(ctx, "nonexistent-id")
			Expect(err).To(HaveOccurred())

			var notFoundErr *management.NotFoundError
			Expect(errors.As(err, &notFoundErr)).To(BeTrue())
			Expect(notFoundErr.Resource).To(Equal("AlertRule"))
			Expect(notFoundErr.Id).To(Equal("nonexistent-id"))
		})
	})

	Context("when multiple rules exist", func() {
		var (
			rule1 = monitoringv1.Rule{
				Alert: "Alert1",
				Expr:  intstr.FromString("up == 0"),
			}
			rule1Id = alertrule.GetAlertingRuleId(&rule1)

			rule2 = monitoringv1.Rule{
				Alert: "Alert2",
				Expr:  intstr.FromString("down == 1"),
			}
			rule2Id = alertrule.GetAlertingRuleId(&rule2)
		)

		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						switch id {
						case rule1Id:
							return rule1, true
						case rule2Id:
							return rule2, true
						default:
							return monitoringv1.Rule{}, false
						}
					},
				}
			}
		})

		It("returns the correct rule based on ID", func() {
			rule, err := client.GetRuleById(ctx, rule1Id)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Alert).To(Equal("Alert1"))

			rule, err = client.GetRuleById(ctx, rule2Id)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Alert).To(Equal("Alert2"))
		})
	})

	Context("with recording rules", func() {
		var (
			recordingRule = monitoringv1.Rule{
				Record: "job:request_latency_seconds:mean5m",
				Expr:   intstr.FromString("avg by (job) (request_latency_seconds)"),
			}
			recordingRuleId = alertrule.GetAlertingRuleId(&recordingRule)
		)

		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == recordingRuleId {
							return recordingRule, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}
		})

		It("returns the recording rule", func() {
			rule, err := client.GetRuleById(ctx, recordingRuleId)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Record).To(Equal("job:request_latency_seconds:mean5m"))
		})
	})
})
