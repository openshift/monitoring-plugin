package management_test

import (
	"context"
	"errors"
	"fmt"

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

var _ = Describe("DeleteUserDefinedAlertRuleById", func() {
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

	Context("when deleting a user-defined alert rule", func() {
		It("should delete rule from multi-rule PrometheusRule and update", func() {
			By("setting up PrometheusRule with 3 rules in 2 groups")
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
					Namespace: "test-namespace",
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
				"test-namespace/multi-rule": prometheusRule,
			})

			alertRuleId := "alert2-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "multi-rule",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "Alert2" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("deleting the middle rule")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)
			Expect(err).ToNot(HaveOccurred())

			By("verifying PrometheusRule was updated, not deleted")
			updatedPR, found, err := mockPR.Get(ctx, "test-namespace", "multi-rule")
			Expect(err).ToNot(HaveOccurred())
			Expect(found).To(BeTrue())
			Expect(updatedPR.Spec.Groups).To(HaveLen(2))
			Expect(updatedPR.Spec.Groups[0].Rules).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Alert).To(Equal("Alert1"))
			Expect(updatedPR.Spec.Groups[1].Rules).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[1].Rules[0].Alert).To(Equal("Alert3"))
		})

		It("should delete entire PrometheusRule when deleting the last rule", func() {
			By("setting up PrometheusRule with single rule")
			rule := monitoringv1.Rule{
				Alert: "OnlyAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "single-rule",
					Namespace: "test-namespace",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "group1",
							Rules: []monitoringv1.Rule{rule},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"test-namespace/single-rule": prometheusRule,
			})

			alertRuleId := "only-alert-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "single-rule",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(alertRuleId)
			}

			deleteCalled := false
			mockPR.DeleteFunc = func(ctx context.Context, namespace, name string) error {
				deleteCalled = true
				Expect(namespace).To(Equal("test-namespace"))
				Expect(name).To(Equal("single-rule"))
				return nil
			}

			By("deleting the only rule")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)
			Expect(err).ToNot(HaveOccurred())

			By("verifying PrometheusRule was deleted")
			Expect(deleteCalled).To(BeTrue())
		})

		It("should remove empty group when deleting its only rule", func() {
			By("setting up PrometheusRule with 2 groups, one with single rule")
			rule1 := monitoringv1.Rule{
				Alert: "Alert1",
				Expr:  intstr.FromString("up == 0"),
			}
			rule2 := monitoringv1.Rule{
				Alert: "Alert2",
				Expr:  intstr.FromString("cpu_usage > 80"),
			}
			rule3 := monitoringv1.Rule{
				Alert: "SingleRuleInGroup",
				Expr:  intstr.FromString("memory_usage > 90"),
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "multi-group",
					Namespace: "test-namespace",
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
				"test-namespace/multi-group": prometheusRule,
			})

			alertRuleId := "single-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "multi-group",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "SingleRuleInGroup" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("deleting the single rule from group2")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)
			Expect(err).ToNot(HaveOccurred())

			By("verifying group2 was removed and group1 remains")
			updatedPR, found, err := mockPR.Get(ctx, "test-namespace", "multi-group")
			Expect(found).To(BeTrue())
			Expect(err).ToNot(HaveOccurred())
			Expect(updatedPR.Spec.Groups).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[0].Name).To(Equal("group1"))
			Expect(updatedPR.Spec.Groups[0].Rules).To(HaveLen(2))
		})

		It("should delete only the exact matching rule", func() {
			By("setting up PrometheusRule with similar rules")
			rule1 := monitoringv1.Rule{
				Alert: "TestAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning",
				},
			}
			rule2 := monitoringv1.Rule{
				Alert: "TestAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "critical",
				},
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "similar-rules",
					Namespace: "test-namespace",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "group1",
							Rules: []monitoringv1.Rule{rule1, rule2},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"test-namespace/similar-rules": prometheusRule,
			})

			targetRuleId := "target-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "similar-rules",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				// Only rule1 matches the target ID
				if alertRule.Alert == "TestAlert" && alertRule.Labels["severity"] == "warning" {
					return mapper.PrometheusAlertRuleId(targetRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("deleting the specific rule")
			err := client.DeleteUserDefinedAlertRuleById(ctx, targetRuleId)
			Expect(err).ToNot(HaveOccurred())

			By("verifying only the exact matching rule was deleted")
			updatedPR, found, err := mockPR.Get(ctx, "test-namespace", "similar-rules")
			Expect(found).To(BeTrue())
			Expect(err).ToNot(HaveOccurred())
			Expect(updatedPR.Spec.Groups[0].Rules).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Labels["severity"]).To(Equal("critical"))
		})
	})

	Context("when handling errors", func() {
		It("should return error when rule not found in mapper", func() {
			By("configuring mapper to return error")
			alertRuleId := "nonexistent-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return nil, errors.New("alert rule not found")
			}

			By("attempting to delete the rule")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)

			By("verifying error is returned")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("AlertRule with id nonexistent-rule-id not found"))
		})

		It("should return error when trying to delete from platform-managed PrometheusRule", func() {
			By("configuring mapper to return platform PrometheusRule")
			alertRuleId := "platform-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "openshift-monitoring",
					Name:      "openshift-platform-alerts",
				}, nil
			}

			By("attempting to delete the rule")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)

			By("verifying error is returned")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("cannot delete alert rule from a platform-managed PrometheusRule"))
		})

		It("should return error when PrometheusRule Get fails", func() {
			By("configuring Get to return error")
			alertRuleId := "test-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "test-rule",
				}, nil
			}

			mockPR.GetFunc = func(ctx context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return nil, false, errors.New("failed to get PrometheusRule")
			}

			By("attempting to delete the rule")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)

			By("verifying error is returned")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to get PrometheusRule"))
		})

		It("should return error when PrometheusRule Update fails", func() {
			By("setting up PrometheusRule with 2 rules")
			rule1 := monitoringv1.Rule{
				Alert: "Alert1",
				Expr:  intstr.FromString("up == 0"),
			}
			rule2 := monitoringv1.Rule{
				Alert: "Alert2",
				Expr:  intstr.FromString("cpu_usage > 80"),
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-rule",
					Namespace: "test-namespace",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "group1",
							Rules: []monitoringv1.Rule{rule1, rule2},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"test-namespace/test-rule": prometheusRule,
			})

			alertRuleId := "alert2-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "test-rule",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "Alert2" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			mockPR.UpdateFunc = func(ctx context.Context, pr monitoringv1.PrometheusRule) error {
				return fmt.Errorf("kubernetes update error")
			}

			By("attempting to delete the rule")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)

			By("verifying error is returned")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to update PrometheusRule"))
			Expect(err.Error()).To(ContainSubstring("kubernetes update error"))
		})

		It("should return error when PrometheusRule Delete fails", func() {
			By("setting up PrometheusRule with single rule")
			rule := monitoringv1.Rule{
				Alert: "OnlyAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "single-rule",
					Namespace: "test-namespace",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "group1",
							Rules: []monitoringv1.Rule{rule},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"test-namespace/single-rule": prometheusRule,
			})

			alertRuleId := "only-alert-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "single-rule",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(alertRuleId)
			}

			mockPR.DeleteFunc = func(ctx context.Context, namespace, name string) error {
				return fmt.Errorf("kubernetes delete error")
			}

			By("attempting to delete the rule")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)

			By("verifying error is returned")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to delete PrometheusRule"))
			Expect(err.Error()).To(ContainSubstring("kubernetes delete error"))
		})
	})

	Context("when handling edge cases", func() {
		It("should handle PrometheusRule with multiple groups correctly", func() {
			By("setting up PrometheusRule with 3 groups")
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
					Name:      "multi-group",
					Namespace: "test-namespace",
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
						{
							Name:  "group3",
							Rules: []monitoringv1.Rule{rule3},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"test-namespace/multi-group": prometheusRule,
			})

			alertRuleId := "alert2-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "multi-group",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "Alert2" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("deleting rule from middle group")
			err := client.DeleteUserDefinedAlertRuleById(ctx, alertRuleId)
			Expect(err).ToNot(HaveOccurred())

			By("verifying middle group was removed")
			updatedPR, found, err := mockPR.Get(ctx, "test-namespace", "multi-group")
			Expect(found).To(BeTrue())
			Expect(err).ToNot(HaveOccurred())
			Expect(updatedPR.Spec.Groups).To(HaveLen(2))
			Expect(updatedPR.Spec.Groups[0].Name).To(Equal("group1"))
			Expect(updatedPR.Spec.Groups[1].Name).To(Equal("group3"))
		})
	})
})
