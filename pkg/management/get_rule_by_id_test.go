package management_test

import (
	"context"
	"errors"

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

var ErrAlertRuleNotFound = errors.New("alert rule not found")

var _ = Describe("GetRuleById", func() {
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
		mockK8s = &testutils.MockClient{
			PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
				return mockPR
			},
		}
		mockMapper = &testutils.MockMapperClient{}

		client = management.NewWithCustomMapper(ctx, mockK8s, mockMapper)
	})

	Context("when retrieving an alert rule by ID", func() {
		It("should successfully return the rule when it exists", func() {
			By("setting up a PrometheusRule with multiple rules")
			rule1 := monitoringv1.Rule{
				Alert: "TestAlert1",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "critical",
				},
			}
			rule2 := monitoringv1.Rule{
				Alert: "TestAlert2",
				Expr:  intstr.FromString("cpu > 80"),
				Annotations: map[string]string{
					"summary": "High CPU usage",
				},
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-rules",
					Namespace: "monitoring",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "group1",
							Rules: []monitoringv1.Rule{rule1},
						},
						{
							Name:  "group2",
							Rules: []monitoringv1.Rule{rule2},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"monitoring/test-rules": prometheusRule,
			})

			alertRuleId := "test-rule-id-2"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "monitoring",
					Name:      "test-rules",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "TestAlert2" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("retrieving the rule by ID")
			rule, err := client.GetRuleById(ctx, alertRuleId)
			Expect(err).ToNot(HaveOccurred())
			Expect(rule).ToNot(BeNil())

			By("verifying the returned rule is correct")
			Expect(rule.Alert).To(Equal("TestAlert2"))
			Expect(rule.Expr.String()).To(Equal("cpu > 80"))
			Expect(rule.Annotations).To(HaveKeyWithValue("summary", "High CPU usage"))
		})

		It("should return an error when the mapper cannot find the rule", func() {
			alertRuleId := "nonexistent-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return nil, ErrAlertRuleNotFound
			}

			By("attempting to retrieve a nonexistent rule")
			_, err := client.GetRuleById(ctx, alertRuleId)

			By("verifying an error is returned")
			Expect(err).To(HaveOccurred())
			Expect(err).To(Equal(ErrAlertRuleNotFound))
		})

		It("should return an error when the PrometheusRule does not exist", func() {
			alertRuleId := "test-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "monitoring",
					Name:      "nonexistent-rule",
				}, nil
			}

			By("attempting to retrieve a rule from a nonexistent PrometheusRule")
			_, err := client.GetRuleById(ctx, alertRuleId)

			By("verifying an error is returned")
			Expect(err).To(HaveOccurred())
		})

		It("should return an error when the rule ID is not found in the PrometheusRule", func() {
			By("setting up a PrometheusRule without the target rule")
			rule1 := monitoringv1.Rule{
				Alert: "DifferentAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-rules",
					Namespace: "monitoring",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "group1",
							Rules: []monitoringv1.Rule{rule1},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"monitoring/test-rules": prometheusRule,
			})

			alertRuleId := "nonexistent-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "monitoring",
					Name:      "test-rules",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId("different-id")
			}

			By("attempting to retrieve the rule")
			_, err := client.GetRuleById(ctx, alertRuleId)

			By("verifying an error is returned")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("alert rule with id"))
			Expect(err.Error()).To(ContainSubstring("not found"))
		})
	})
})
