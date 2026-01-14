package management_test

import (
	"context"
	"errors"
	"strings"

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

var _ = Describe("UpdatePlatformAlertRule", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client
	)

	var (
		// Original platform rule as stored in PrometheusRule (without k8s labels)
		originalPlatformRule = monitoringv1.Rule{
			Alert: "PlatformAlert",
			Expr:  intstr.FromString("node_down == 1"),
			Labels: map[string]string{
				"severity": "critical",
			},
		}
		originalPlatformRuleId = alertrule.GetAlertingRuleId(&originalPlatformRule)

		// Platform rule as seen by RelabeledRules (with k8s labels added)
		platformRule = monitoringv1.Rule{
			Alert: "PlatformAlert",
			Expr:  intstr.FromString("node_down == 1"),
			Labels: map[string]string{
				"severity":                       "critical",
				k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
				k8s.PrometheusRuleLabelName:      "platform-rule",
				k8s.AlertRuleLabelId:             originalPlatformRuleId,
			},
		}
		platformRuleId = alertrule.GetAlertingRuleId(&platformRule)

		userRule = monitoringv1.Rule{
			Alert: "UserAlert",
			Labels: map[string]string{
				k8s.PrometheusRuleLabelNamespace: "user-namespace",
				k8s.PrometheusRuleLabelName:      "user-rule",
			},
		}
		userRuleId = alertrule.GetAlertingRuleId(&userRule)
	)

	BeforeEach(func() {
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)

		mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool {
					return name == "openshift-monitoring"
				},
			}
		}
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
			updatedRule := platformRule
			err := client.UpdatePlatformAlertRule(ctx, "nonexistent-id", updatedRule)
			Expect(err).To(HaveOccurred())

			var notFoundErr *management.NotFoundError
			Expect(errors.As(err, &notFoundErr)).To(BeTrue())
			Expect(notFoundErr.Resource).To(Equal("AlertRule"))
		})
	})

	Context("when trying to update a non-platform rule", func() {
		BeforeEach(func() {
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == userRuleId {
							return userRule, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}
		})

		It("returns an error", func() {
			updatedRule := userRule
			err := client.UpdatePlatformAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("cannot update non-platform alert rule"))
		})
	})

	Context("when PrometheusRule is not found", func() {
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

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return nil, false, nil
					},
				}
			}
		})

		It("returns NotFoundError", func() {
			updatedRule := platformRule
			err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
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
						if id == platformRuleId {
							return platformRule, true
						}
						return monitoringv1.Rule{}, false
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
			updatedRule := platformRule
			err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to get PrometheusRule"))
		})
	})

	Context("when no label changes are detected", func() {
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
										Rules: []monitoringv1.Rule{originalPlatformRule},
									},
								},
							},
						}, true, nil
					},
				}
			}
		})

		It("returns an error", func() {
			updatedRule := originalPlatformRule
			err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("no label changes detected"))
		})
	})

	Context("when updating platform rule labels", func() {
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
										Rules: []monitoringv1.Rule{originalPlatformRule},
									},
								},
							},
						}, true, nil
					},
				}
			}
		})

		Context("when creating new AlertRelabelConfig", func() {
			BeforeEach(func() {
				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
							return nil, false, nil
						},
						CreateFunc: func(ctx context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
							return &arc, nil
						},
					}
				}
			})

			It("creates AlertRelabelConfig for label changes", func() {
				var createdARC *osmv1.AlertRelabelConfig

				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
							return nil, false, nil
						},
						CreateFunc: func(ctx context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
							createdARC = &arc
							return &arc, nil
						},
					}
				}

				updatedRule := originalPlatformRule
				updatedRule.Labels = map[string]string{
					"severity":  "warning",
					"new_label": "new_value",
				}

				err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
				Expect(err).NotTo(HaveOccurred())
				Expect(createdARC).NotTo(BeNil())
				Expect(createdARC.Namespace).To(Equal("openshift-monitoring"))
				Expect(strings.HasPrefix(createdARC.Name, "alertmanagement-")).To(BeTrue())
				Expect(createdARC.Spec.Configs).NotTo(BeEmpty())
			})
		})

		Context("when updating existing AlertRelabelConfig", func() {
			BeforeEach(func() {
				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					existingARC := &osmv1.AlertRelabelConfig{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "alertmanagement-existing",
							Namespace: "openshift-monitoring",
						},
					}
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
							return existingARC, true, nil
						},
						UpdateFunc: func(ctx context.Context, arc osmv1.AlertRelabelConfig) error {
							return nil
						},
					}
				}
			})

			It("updates existing AlertRelabelConfig", func() {
				var updatedARC *osmv1.AlertRelabelConfig

				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					existingARC := &osmv1.AlertRelabelConfig{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "alertmanagement-existing",
							Namespace: "openshift-monitoring",
						},
					}
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
							return existingARC, true, nil
						},
						UpdateFunc: func(ctx context.Context, arc osmv1.AlertRelabelConfig) error {
							updatedARC = &arc
							return nil
						},
					}
				}

				updatedRule := originalPlatformRule
				updatedRule.Labels = map[string]string{
					"severity": "info",
				}

				err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
				Expect(err).NotTo(HaveOccurred())
				Expect(updatedARC).NotTo(BeNil())
				Expect(updatedARC.Spec.Configs).NotTo(BeEmpty())
			})
		})

		Context("when dropping labels", func() {
			It("creates relabel config to drop labels", func() {
				var createdARC *osmv1.AlertRelabelConfig

				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
							return nil, false, nil
						},
						CreateFunc: func(ctx context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
							createdARC = &arc
							return &arc, nil
						},
					}
				}

				updatedRule := originalPlatformRule
				// Remove severity label (keep alertname as it's special)
				updatedRule.Labels = map[string]string{}

				err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
				Expect(err).NotTo(HaveOccurred())
				Expect(createdARC).NotTo(BeNil())
				Expect(createdARC.Spec.Configs).NotTo(BeEmpty())
			})
		})
	})
})
