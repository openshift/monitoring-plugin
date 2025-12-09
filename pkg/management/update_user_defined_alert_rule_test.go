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

var _ = Describe("UpdateUserDefinedAlertRule", func() {
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
		mockMapper = &testutils.MockMapperClient{}

		client = management.NewWithCustomMapper(ctx, mockK8s, mockMapper)
	})

	Context("when updating a user-defined alert rule", func() {
		It("should successfully update an existing alert rule", func() {
			By("setting up the existing rule")
			existingRule := monitoringv1.Rule{
				Alert: "OldAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "user-rule",
					Namespace: "user-namespace",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "test-group",
							Rules: []monitoringv1.Rule{existingRule},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"user-namespace/user-rule": prometheusRule,
			})

			alertRuleId := "test-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "user-namespace",
					Name:      "user-rule",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "OldAlert" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("updating with new values")
			updatedRule := monitoringv1.Rule{
				Alert: "UpdatedAlert",
				Expr:  intstr.FromString("up == 1"),
				Annotations: map[string]string{
					"summary": "Updated summary",
				},
			}

			err := client.UpdateUserDefinedAlertRule(ctx, alertRuleId, updatedRule)
			Expect(err).ToNot(HaveOccurred())

			By("verifying the update succeeded")
			updatedPR, found, err := mockPR.Get(ctx, "user-namespace", "user-rule")
			Expect(found).To(BeTrue())
			Expect(err).ToNot(HaveOccurred())
			Expect(updatedPR.Spec.Groups).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[0].Rules).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Alert).To(Equal("UpdatedAlert"))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Expr.String()).To(Equal("up == 1"))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Annotations["summary"]).To(Equal("Updated summary"))
		})

		It("should update the correct rule when multiple rules exist", func() {
			By("setting up multiple rules across different groups")
			rule1 := monitoringv1.Rule{
				Alert: "Alert1",
				Expr:  intstr.FromString("up == 0"),
			}

			rule2 := monitoringv1.Rule{
				Alert: "Alert2",
				Expr:  intstr.FromString("cpu_usage > 80"),
			}

			rule3 := monitoringv1.Rule{
				Alert: "Alert3",
				Expr:  intstr.FromString("memory_usage > 90"),
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "multi-rule",
					Namespace: "user-namespace",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "group1",
							Rules: []monitoringv1.Rule{rule1, rule2},
						},
						{
							Name:  "group2",
							Rules: []monitoringv1.Rule{rule3},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"user-namespace/multi-rule": prometheusRule,
			})

			alertRuleId := "alert2-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "user-namespace",
					Name:      "multi-rule",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "Alert2" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("updating only the second rule")
			updatedRule := monitoringv1.Rule{
				Alert: "Alert2Updated",
				Expr:  intstr.FromString("cpu_usage > 90"),
			}

			err := client.UpdateUserDefinedAlertRule(ctx, alertRuleId, updatedRule)
			Expect(err).ToNot(HaveOccurred())

			By("verifying only the targeted rule was updated")
			updatedPR, found, err := mockPR.Get(ctx, "user-namespace", "multi-rule")
			Expect(found).To(BeTrue())
			Expect(err).ToNot(HaveOccurred())
			Expect(updatedPR.Spec.Groups).To(HaveLen(2))

			Expect(updatedPR.Spec.Groups[0].Rules).To(HaveLen(2))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Alert).To(Equal("Alert1"))
			Expect(updatedPR.Spec.Groups[0].Rules[1].Alert).To(Equal("Alert2Updated"))
			Expect(updatedPR.Spec.Groups[0].Rules[1].Expr.String()).To(Equal("cpu_usage > 90"))

			Expect(updatedPR.Spec.Groups[1].Rules).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[1].Rules[0].Alert).To(Equal("Alert3"))
		})

		It("should return error when alert rule ID is not found", func() {
			existingRule := monitoringv1.Rule{
				Alert: "ExistingAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "user-rule",
					Namespace: "user-namespace",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "test-group",
							Rules: []monitoringv1.Rule{existingRule},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"user-namespace/user-rule": prometheusRule,
			})

			alertRuleId := "non-existent-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "user-namespace",
					Name:      "user-rule",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId("different-id")
			}

			updatedRule := monitoringv1.Rule{
				Alert: "UpdatedAlert",
				Expr:  intstr.FromString("up == 1"),
			}

			err := client.UpdateUserDefinedAlertRule(ctx, alertRuleId, updatedRule)

			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("not found"))
		})

		It("should return error when trying to update a platform-managed alert rule", func() {
			alertRuleId := "platform-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "platform-namespace-1",
					Name:      "openshift-platform-rules",
				}, nil
			}

			updatedRule := monitoringv1.Rule{
				Alert: "UpdatedAlert",
				Expr:  intstr.FromString("up == 1"),
			}

			err := client.UpdateUserDefinedAlertRule(ctx, alertRuleId, updatedRule)

			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("platform-managed"))
		})
	})
})
