package management_test

import (
	"context"
	"errors"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("DeleteUserDefinedAlertRuleById", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client
	)

	var (
		userRule1 = monitoringv1.Rule{
			Alert: "UserAlert1",
			Labels: map[string]string{
				k8s.PrometheusRuleLabelNamespace: "user-namespace",
				k8s.PrometheusRuleLabelName:      "user-rule",
			},
		}
		userRule1Id = alertrule.GetAlertingRuleId(&userRule1)

		userRule2 = monitoringv1.Rule{
			Alert: "UserAlert2",
			Labels: map[string]string{
				k8s.PrometheusRuleLabelNamespace: "user-namespace",
				k8s.PrometheusRuleLabelName:      "user-rule",
			},
		}

		platformRule = monitoringv1.Rule{
			Alert: "PlatformAlert",
			Labels: map[string]string{
				k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
				k8s.PrometheusRuleLabelName:      "platform-rule",
			},
		}
		platformRuleId = alertrule.GetAlertingRuleId(&platformRule)
	)

	BeforeEach(func() {
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)
	})

	Context("when rule is not found in RelabeledRules", func() {
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
			err := client.DeleteUserDefinedAlertRuleById(ctx, "nonexistent-id")
			Expect(err).To(HaveOccurred())

			var notFoundErr *management.NotFoundError
			Expect(errors.As(err, &notFoundErr)).To(BeTrue())
			Expect(notFoundErr.Resource).To(Equal("AlertRule"))
			Expect(notFoundErr.Id).To(Equal("nonexistent-id"))
		})
	})

	Context("when trying to delete a platform rule", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == platformRuleId {
							return platformRule, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return name == "openshift-monitoring"
					},
				}
			}
		})

		It("returns NotAllowedError", func() {
			err := client.DeleteUserDefinedAlertRuleById(ctx, platformRuleId)
			Expect(err).To(HaveOccurred())

			var notAllowedErr *management.NotAllowedError
			Expect(errors.As(err, &notAllowedErr)).To(BeTrue())
			Expect(notAllowedErr.Message).To(ContainSubstring("cannot delete alert rule from a platform-managed PrometheusRule"))
		})
	})

	Context("when PrometheusRule is not found", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == userRule1Id {
							return userRule1, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return nil, false, nil
					},
				}
			}
		})

		It("returns NotFoundError", func() {
			err := client.DeleteUserDefinedAlertRuleById(ctx, userRule1Id)
			Expect(err).To(HaveOccurred())

			var notFoundErr *management.NotFoundError
			Expect(errors.As(err, &notFoundErr)).To(BeTrue())
			Expect(notFoundErr.Resource).To(Equal("PrometheusRule"))
		})
	})

	Context("when PrometheusRule Get returns an error", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == userRule1Id {
							return userRule1, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return nil, false, errors.New("failed to get PrometheusRule")
					},
				}
			}
		})

		It("returns the error", func() {
			err := client.DeleteUserDefinedAlertRuleById(ctx, userRule1Id)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to get PrometheusRule"))
		})
	})

	Context("when rule is not found in PrometheusRule", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == userRule1Id {
							return userRule1, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return &monitoringv1.PrometheusRule{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: namespace,
								Name:      name,
							},
							Spec: monitoringv1.PrometheusRuleSpec{
								Groups: []monitoringv1.RuleGroup{
									{
										Name:  "test-group",
										Rules: []monitoringv1.Rule{userRule2},
									},
								},
							},
						}, true, nil
					},
				}
			}
		})

		It("returns NotFoundError", func() {
			err := client.DeleteUserDefinedAlertRuleById(ctx, userRule1Id)
			Expect(err).To(HaveOccurred())

			var notFoundErr *management.NotFoundError
			Expect(errors.As(err, &notFoundErr)).To(BeTrue())
			Expect(notFoundErr.Resource).To(Equal("AlertRule"))
			Expect(notFoundErr.Id).To(Equal(userRule1Id))
		})
	})

	Context("when deleting the only rule", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == userRule1Id {
							return userRule1, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return &monitoringv1.PrometheusRule{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: namespace,
								Name:      name,
							},
							Spec: monitoringv1.PrometheusRuleSpec{
								Groups: []monitoringv1.RuleGroup{
									{
										Name:  "test-group",
										Rules: []monitoringv1.Rule{userRule1},
									},
								},
							},
						}, true, nil
					},
					DeleteFunc: func(ctx context.Context, namespace string, name string) error {
						return nil
					},
				}
			}
		})

		It("deletes the entire PrometheusRule", func() {
			var deleteCalled bool

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return &monitoringv1.PrometheusRule{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: namespace,
								Name:      name,
							},
							Spec: monitoringv1.PrometheusRuleSpec{
								Groups: []monitoringv1.RuleGroup{
									{
										Name:  "test-group",
										Rules: []monitoringv1.Rule{userRule1},
									},
								},
							},
						}, true, nil
					},
					DeleteFunc: func(ctx context.Context, namespace string, name string) error {
						deleteCalled = true
						return nil
					},
				}
			}

			err := client.DeleteUserDefinedAlertRuleById(ctx, userRule1Id)
			Expect(err).NotTo(HaveOccurred())
			Expect(deleteCalled).To(BeTrue())
		})
	})

	Context("when deleting one of multiple rules", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == userRule1Id {
							return userRule1, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}
		})

		It("updates the PrometheusRule with remaining rules", func() {
			var updateCalled bool
			var updatedPR *monitoringv1.PrometheusRule

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return &monitoringv1.PrometheusRule{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: namespace,
								Name:      name,
							},
							Spec: monitoringv1.PrometheusRuleSpec{
								Groups: []monitoringv1.RuleGroup{
									{
										Name:  "test-group",
										Rules: []monitoringv1.Rule{userRule1, userRule2},
									},
								},
							},
						}, true, nil
					},
					UpdateFunc: func(ctx context.Context, pr monitoringv1.PrometheusRule) error {
						updateCalled = true
						updatedPR = &pr
						return nil
					},
				}
			}

			err := client.DeleteUserDefinedAlertRuleById(ctx, userRule1Id)
			Expect(err).NotTo(HaveOccurred())
			Expect(updateCalled).To(BeTrue())
			Expect(updatedPR.Spec.Groups).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[0].Rules).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Alert).To(Equal("UserAlert2"))
		})
	})

	Context("when deleting all rules from a group", func() {
		It("removes the empty group", func() {
			anotherRule := monitoringv1.Rule{
				Alert: "AnotherAlert",
				Labels: map[string]string{
					k8s.PrometheusRuleLabelNamespace: "user-namespace",
					k8s.PrometheusRuleLabelName:      "user-rule",
				},
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == userRule1Id {
							return userRule1, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}

			var updatedPR *monitoringv1.PrometheusRule

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return &monitoringv1.PrometheusRule{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: namespace,
								Name:      name,
							},
							Spec: monitoringv1.PrometheusRuleSpec{
								Groups: []monitoringv1.RuleGroup{
									{
										Name:  "group-to-be-empty",
										Rules: []monitoringv1.Rule{userRule1},
									},
									{
										Name:  "group-with-rules",
										Rules: []monitoringv1.Rule{anotherRule},
									},
								},
							},
						}, true, nil
					},
					UpdateFunc: func(ctx context.Context, pr monitoringv1.PrometheusRule) error {
						updatedPR = &pr
						return nil
					},
				}
			}

			err := client.DeleteUserDefinedAlertRuleById(ctx, userRule1Id)
			Expect(err).NotTo(HaveOccurred())
			Expect(updatedPR.Spec.Groups).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[0].Name).To(Equal("group-with-rules"))
		})
	})
})
