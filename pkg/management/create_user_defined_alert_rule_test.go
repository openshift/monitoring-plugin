package management_test

import (
	"context"
	"errors"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("CreateUserDefinedAlertRule", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client
	)

	var (
		testRule = monitoringv1.Rule{
			Alert: "TestAlert",
			Expr:  intstr.FromString("up == 0"),
			For:   (*monitoringv1.Duration)(stringPtr("5m")),
			Labels: map[string]string{
				"severity": "warning",
			},
			Annotations: map[string]string{
				"summary": "Test alert",
			},
		}
	)

	BeforeEach(func() {
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)
	})

	Context("when target PrometheusRule is GitOps-managed", func() {
		BeforeEach(func() {
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
				}
			}
			// No duplicate
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
			// Existing PrometheusRule with GitOps annotation
			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return &monitoringv1.PrometheusRule{
							ObjectMeta: metav1.ObjectMeta{
								Namespace:   namespace,
								Name:        name,
								Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "abc"},
							},
						}, true, nil
					},
				}
			}
		})

		It("returns NotAllowed with GitOps message", func() {
			prOptions := management.PrometheusRuleOptions{Name: "user-pr", Namespace: "user-ns"}
			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("This PrometheusRule is managed by GitOps; create the alert in Git."))
		})
	})

	Context("when target PrometheusRule is operator-managed", func() {
		BeforeEach(func() {
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
				}
			}
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
			// Existing PrometheusRule with OwnerReferences
			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return &monitoringv1.PrometheusRule{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: namespace,
								Name:      name,
								OwnerReferences: []metav1.OwnerReference{
									{Kind: "Deployment", Name: "some-operator"},
								},
							},
						}, true, nil
					},
				}
			}
		})

		It("returns NotAllowed for operator-managed PrometheusRule", func() {
			prOptions := management.PrometheusRuleOptions{Name: "user-pr", Namespace: "user-ns"}
			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("This PrometheusRule is managed by an operator; you cannot add alerts to it."))
		})
	})
	Context("when PrometheusRule Name is not specified", func() {
		It("returns an error", func() {
			prOptions := management.PrometheusRuleOptions{
				Namespace: "test-namespace",
			}

			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("PrometheusRule Name and Namespace must be specified"))
		})
	})

	Context("when PrometheusRule Namespace is not specified", func() {
		It("returns an error", func() {
			prOptions := management.PrometheusRuleOptions{
				Name: "test-rule",
			}

			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("PrometheusRule Name and Namespace must be specified"))
		})
	})

	Context("when target is in a cluster-monitoring namespace", func() {
		BeforeEach(func() {
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return name == "openshift-monitoring"
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
		})

		It("returns an error directing the caller to use an AlertingRule CR", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "platform-rule",
				Namespace: "openshift-monitoring",
			}

			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("cannot add user-defined alert rule to a platform-managed PrometheusRule"))
		})
	})

	Context("when rule with same ID already exists", func() {
		BeforeEach(func() {
			ruleId := alertrule.GetAlertingRuleId(&testRule)

			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == ruleId {
							return testRule, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}
		})

		It("returns an error", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "user-rule",
				Namespace: "user-namespace",
			}

			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("alert rule with exact config already exists"))
		})
	})

	Context("when AddRule fails", func() {
		BeforeEach(func() {
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					AddRuleFunc: func(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
						return errors.New("failed to add rule")
					},
				}
			}
		})

		It("returns the error", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "user-rule",
				Namespace: "user-namespace",
			}

			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to add rule"))
		})
	})

	Context("when successfully creating a rule", func() {
		BeforeEach(func() {
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					AddRuleFunc: func(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
						return nil
					},
				}
			}
		})

		It("returns the rule ID", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "user-rule",
				Namespace: "user-namespace",
			}

			ruleId, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(ruleId).NotTo(BeEmpty())
			Expect(ruleId).To(Equal(alertrule.GetAlertingRuleId(&testRule)))
		})

		It("uses default group name when not specified", func() {
			var capturedGroupName string

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					AddRuleFunc: func(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
						capturedGroupName = groupName
						return nil
					},
				}
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "user-rule",
				Namespace: "user-namespace",
			}

			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(capturedGroupName).To(Equal("user-defined-rules"))
		})

		It("uses custom group name when specified", func() {
			var capturedGroupName string

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					AddRuleFunc: func(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
						capturedGroupName = groupName
						return nil
					},
				}
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "user-rule",
				Namespace: "user-namespace",
				GroupName: "custom-group",
			}

			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).NotTo(HaveOccurred())
			Expect(capturedGroupName).To(Equal("custom-group"))
		})
	})

	Context("duplicate detection ignoring alert name", func() {
		BeforeEach(func() {
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
				}
			}
			// existing rule with different alert name but same spec (expr/for/labels)
			existing := monitoringv1.Rule{}
			(&testRule).DeepCopyInto(&existing)
			existing.Alert = "OtherName"
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					ListFunc: func(ctx context.Context) []monitoringv1.Rule {
						return []monitoringv1.Rule{existing}
					},
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return monitoringv1.Rule{}, false
					},
				}
			}
		})

		It("denies adding equivalent rule with different alert name", func() {
			prOptions := management.PrometheusRuleOptions{
				Name:      "user-rule",
				Namespace: "user-namespace",
			}
			_, err := client.CreateUserDefinedAlertRule(ctx, testRule, prOptions)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("equivalent spec already exists"))
		})
	})
})

func stringPtr(s string) *string {
	return &s
}
