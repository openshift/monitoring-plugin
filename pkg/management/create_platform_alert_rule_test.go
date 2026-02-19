package management_test

import (
	"context"
	"errors"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("CreatePlatformAlertRule", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client

		baseRule monitoringv1.Rule
	)

	BeforeEach(func() {
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)

		baseRule = monitoringv1.Rule{
			Alert: "PlatformAlert",
			Expr:  intstr.FromString("up == 0"),
			For:   (*monitoringv1.Duration)(stringPtr("5m")),
			Labels: map[string]string{
				"severity": "warning",
			},
			Annotations: map[string]string{
				"summary": "platform alert",
			},
		}
	})

	Context("validation", func() {
		It("returns error when alert name is empty", func() {
			rule := baseRule
			rule.Alert = " "

			_, err := client.CreatePlatformAlertRule(ctx, rule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("alert name is required"))
		})

		It("returns error when expr is empty", func() {
			rule := baseRule
			rule.Expr = intstr.FromString(" ")

			_, err := client.CreatePlatformAlertRule(ctx, rule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("expr is required"))
		})

		It("returns error when severity is invalid", func() {
			rule := baseRule
			rule.Labels = map[string]string{"severity": "fatal"}

			_, err := client.CreatePlatformAlertRule(ctx, rule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("invalid severity"))
		})
	})

	Context("duplicate detection", func() {
		It("returns conflict when same rule id already exists in relabeled rules", func() {
			ruleID := alertrule.GetAlertingRuleId(&baseRule)

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == ruleID {
							return baseRule, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			_, err := client.CreatePlatformAlertRule(ctx, baseRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("exact config already exists"))
		})
	})

	Context("when target AlertingRule exists", func() {
		It("adds rule to default group and updates AlertingRule", func() {
			var updated osmv1.AlertingRule

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
			mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
				return &testutils.MockAlertingRuleInterface{
					GetFunc: func(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error) {
						return &osmv1.AlertingRule{
							ObjectMeta: metav1.ObjectMeta{
								Name:      name,
								Namespace: k8s.ClusterMonitoringNamespace,
							},
							Spec: osmv1.AlertingRuleSpec{
								Groups: []osmv1.RuleGroup{
									{
										Name: "platform-alert-rules",
										Rules: []osmv1.Rule{
											{
												Alert: "ExistingAlert",
												Expr:  intstr.FromString("vector(1)"),
											},
										},
									},
								},
							},
						}, true, nil
					},
					UpdateFunc: func(ctx context.Context, ar osmv1.AlertingRule) error {
						updated = ar
						return nil
					},
				}
			}

			ruleID, err := client.CreatePlatformAlertRule(ctx, baseRule)
			Expect(err).NotTo(HaveOccurred())
			Expect(ruleID).To(Equal(alertrule.GetAlertingRuleId(&baseRule)))
			Expect(updated.Name).To(Equal("platform-alert-rules"))
			Expect(updated.Spec.Groups).To(HaveLen(1))
			Expect(updated.Spec.Groups[0].Name).To(Equal("platform-alert-rules"))
			Expect(updated.Spec.Groups[0].Rules).To(HaveLen(2))
			Expect(updated.Spec.Groups[0].Rules[1].Labels).To(HaveKey(k8s.AlertRuleLabelId))
		})

		It("returns conflict when same alert name exists in target group", func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
			mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
				return &testutils.MockAlertingRuleInterface{
					GetFunc: func(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error) {
						return &osmv1.AlertingRule{
							ObjectMeta: metav1.ObjectMeta{
								Name:      name,
								Namespace: k8s.ClusterMonitoringNamespace,
							},
							Spec: osmv1.AlertingRuleSpec{
								Groups: []osmv1.RuleGroup{
									{
										Name: "platform-alert-rules",
										Rules: []osmv1.Rule{
											{
												Alert: "PlatformAlert",
												Expr:  intstr.FromString("vector(1)"),
											},
										},
									},
								},
							},
						}, true, nil
					},
				}
			}

			_, err := client.CreatePlatformAlertRule(ctx, baseRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("already exists in group"))
		})
	})

	Context("when target AlertingRule does not exist", func() {
		It("creates AlertingRule in cluster monitoring namespace", func() {
			var created osmv1.AlertingRule

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
			mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
				return &testutils.MockAlertingRuleInterface{
					GetFunc: func(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error) {
						return nil, false, nil
					},
					CreateFunc: func(ctx context.Context, ar osmv1.AlertingRule) (*osmv1.AlertingRule, error) {
						created = ar
						return &ar, nil
					},
				}
			}

			_, err := client.CreatePlatformAlertRule(ctx, baseRule)
			Expect(err).NotTo(HaveOccurred())
			Expect(created.Name).To(Equal("platform-alert-rules"))
			Expect(created.Namespace).To(Equal(k8s.ClusterMonitoringNamespace))
			Expect(created.Spec.Groups).To(HaveLen(1))
			Expect(created.Spec.Groups[0].Name).To(Equal("platform-alert-rules"))
			Expect(created.Spec.Groups[0].Rules).To(HaveLen(1))
			Expect(created.Spec.Groups[0].Rules[0].Labels).To(HaveKey(k8s.AlertRuleLabelId))
		})

		It("returns wrapped error when AlertingRules Get fails", func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
			mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
				return &testutils.MockAlertingRuleInterface{
					GetFunc: func(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error) {
						return nil, false, errors.New("get failed")
					},
				}
			}

			_, err := client.CreatePlatformAlertRule(ctx, baseRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to get AlertingRule"))
			Expect(err.Error()).To(ContainSubstring("get failed"))
		})
	})
})
