package management_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

var _ = Describe("UpdateUserDefinedAlertRule", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client
	)

	var (
		// Original user rule as stored in PrometheusRule (without k8s labels)
		originalUserRule = monitoringv1.Rule{
			Alert: "UserAlert",
			Expr:  intstr.FromString("up == 0"),
			Labels: map[string]string{
				"severity": "warning",
			},
		}
		originalUserRuleId = alertrule.GetAlertingRuleId(&originalUserRule)

		// User rule as seen by RelabeledRules (with k8s labels added)
		userRule = monitoringv1.Rule{
			Alert: "UserAlert",
			Expr:  intstr.FromString("up == 0"),
			Labels: map[string]string{
				"severity":                       "warning",
				k8s.PrometheusRuleLabelNamespace: "user-namespace",
				k8s.PrometheusRuleLabelName:      "user-rule",
			},
		}
		userRuleId = originalUserRuleId

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
			updatedRule := userRule
			_, err := client.UpdateUserDefinedAlertRule(ctx, "nonexistent-id", updatedRule)
			Expect(err).To(HaveOccurred())

			var notFoundErr *management.NotFoundError
			Expect(errors.As(err, &notFoundErr)).To(BeTrue())
			Expect(notFoundErr.Resource).To(Equal("AlertRule"))
		})
	})

	Context("when trying to update a platform rule", func() {
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
		})

		It("returns an error", func() {
			updatedRule := platformRule
			_, err := client.UpdateUserDefinedAlertRule(ctx, platformRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("cannot update alert rule in a platform-managed PrometheusRule"))
		})
	})

	Context("when PrometheusRule is not found", func() {
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

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						return nil, false, nil
					},
				}
			}
		})

		It("returns NotFoundError", func() {
			updatedRule := userRule
			_, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
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
						if id == userRuleId {
							return userRule, true
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
			updatedRule := userRule
			_, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to get PrometheusRule"))
		})
	})

	Context("when rule is not found in PrometheusRule", func() {
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

			mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
				return &testutils.MockPrometheusRuleInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
						// Return PrometheusRule but without the rule we're looking for
						return &monitoringv1.PrometheusRule{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: namespace,
								Name:      name,
							},
							Spec: monitoringv1.PrometheusRuleSpec{
								Groups: []monitoringv1.RuleGroup{
									{
										Name:  "test-group",
										Rules: []monitoringv1.Rule{},
									},
								},
							},
						}, true, nil
					},
				}
			}
		})

		It("returns an error", func() {
			updatedRule := userRule
			_, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("AlertRule with id %s not found", userRuleId)))
		})
	})

	Context("when PrometheusRule Update fails", func() {
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
										Rules: []monitoringv1.Rule{originalUserRule},
									},
								},
							},
						}, true, nil
					},
					UpdateFunc: func(ctx context.Context, pr monitoringv1.PrometheusRule) error {
						return errors.New("failed to update PrometheusRule")
					},
				}
			}
		})

		It("returns the error", func() {
			updatedRule := originalUserRule
			_, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("failed to update PrometheusRule"))
		})
	})

	Context("when successfully updating a rule", func() {
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

		It("updates the rule in the PrometheusRule", func() {
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
										Rules: []monitoringv1.Rule{originalUserRule},
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

			updatedRule := originalUserRule
			// Create a deep copy of the Labels map to avoid modifying the original
			updatedRule.Labels = make(map[string]string)
			for k, v := range originalUserRule.Labels {
				updatedRule.Labels[k] = v
			}
			updatedRule.Labels["severity"] = "critical"
			updatedRule.Expr = intstr.FromString("up == 1")

			expectedNewRuleId := alertrule.GetAlertingRuleId(&updatedRule)
			newRuleId, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).NotTo(HaveOccurred())
			Expect(newRuleId).To(Equal(expectedNewRuleId))
			Expect(updatedPR).NotTo(BeNil())
			Expect(updatedPR.Spec.Groups[0].Rules[0].Labels["severity"]).To(Equal("critical"))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Expr.String()).To(Equal("up == 1"))
		})

		It("migrates classification override when rule id changes", func() {
			Expect(os.Setenv("MONITORING_PLUGIN_NAMESPACE", "plugin-ns")).To(Succeed())
			DeferCleanup(func() {
				_ = os.Unsetenv("MONITORING_PLUGIN_NAMESPACE")
			})
			client = management.New(ctx, mockK8s)

			updatedRule := originalUserRule
			updatedRule.Labels = make(map[string]string)
			for k, v := range originalUserRule.Labels {
				updatedRule.Labels[k] = v
			}
			updatedRule.Labels["severity"] = "critical"
			updatedRule.Expr = intstr.FromString("up == 1")

			expectedNewRuleId := alertrule.GetAlertingRuleId(&updatedRule)

			cmName := management.OverrideConfigMapName("user-namespace")
			oldKey := base64.RawURLEncoding.EncodeToString([]byte(userRuleId))
			overrideJSON, err := json.Marshal(map[string]any{
				"classification": map[string]any{
					"openshift_io_alert_rule_component": "api",
					"openshift_io_alert_rule_layer":     "cluster",
				},
			})
			Expect(err).NotTo(HaveOccurred())

			mockCM := &testutils.MockConfigMapInterface{
				ConfigMaps: map[string]*corev1.ConfigMap{
					"plugin-ns/" + cmName: {
						ObjectMeta: metav1.ObjectMeta{
							Namespace: "plugin-ns",
							Name:      cmName,
							Labels: map[string]string{
								managementlabels.AlertClassificationOverridesTypeLabelKey:      managementlabels.AlertClassificationOverridesTypeLabelValue,
								managementlabels.AlertClassificationOverridesManagedByLabelKey: managementlabels.AlertClassificationOverridesManagedByLabelValue,
								k8s.PrometheusRuleLabelNamespace:                               "user-namespace",
							},
						},
						Data: map[string]string{
							oldKey: string(overrideJSON),
						},
					},
				},
			}
			mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface { return mockCM }

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
										Rules: []monitoringv1.Rule{originalUserRule},
									},
								},
							},
						}, true, nil
					},
					UpdateFunc: func(ctx context.Context, pr monitoringv1.PrometheusRule) error {
						return nil
					},
				}
			}

			newRuleId, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).NotTo(HaveOccurred())
			Expect(newRuleId).To(Equal(expectedNewRuleId))

			newKey := base64.RawURLEncoding.EncodeToString([]byte(expectedNewRuleId))
			cm := mockCM.ConfigMaps["plugin-ns/"+cmName]
			Expect(cm).NotTo(BeNil())
			Expect(cm.Data).NotTo(HaveKey(oldKey))
			Expect(cm.Data).To(HaveKey(newKey))
		})

		It("updates only the matching rule when multiple rules exist", func() {
			anotherRule := monitoringv1.Rule{
				Alert: "AnotherAlert",
				Expr:  intstr.FromString("down == 1"),
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
										Name:  "test-group",
										Rules: []monitoringv1.Rule{originalUserRule, anotherRule},
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

			updatedRule := originalUserRule
			// Create a deep copy of the Labels map to avoid modifying the original
			updatedRule.Labels = make(map[string]string)
			for k, v := range originalUserRule.Labels {
				updatedRule.Labels[k] = v
			}
			updatedRule.Labels["severity"] = "info"

			expectedNewRuleId := alertrule.GetAlertingRuleId(&updatedRule)
			newRuleId, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).NotTo(HaveOccurred())
			Expect(newRuleId).To(Equal(expectedNewRuleId))
			Expect(updatedPR).NotTo(BeNil())
			Expect(updatedPR.Spec.Groups[0].Rules).To(HaveLen(2))
			Expect(updatedPR.Spec.Groups[0].Rules[0].Labels["severity"]).To(Equal("info"))
			Expect(updatedPR.Spec.Groups[0].Rules[1].Alert).To(Equal("AnotherAlert"))
		})

		It("updates rule in the correct group when multiple groups exist", func() {
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
										Name:  "group1",
										Rules: []monitoringv1.Rule{},
									},
									{
										Name:  "group2",
										Rules: []monitoringv1.Rule{originalUserRule},
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

			updatedRule := originalUserRule
			// Create a deep copy of the Labels map to avoid modifying the original
			updatedRule.Labels = make(map[string]string)
			for k, v := range originalUserRule.Labels {
				updatedRule.Labels[k] = v
			}
			updatedRule.Labels["new_label"] = "new_value"

			expectedNewRuleId := alertrule.GetAlertingRuleId(&updatedRule)
			newRuleId, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).NotTo(HaveOccurred())
			Expect(newRuleId).To(Equal(expectedNewRuleId))
			Expect(updatedPR).NotTo(BeNil())
			Expect(updatedPR.Spec.Groups).To(HaveLen(2))
			Expect(updatedPR.Spec.Groups[0].Rules).To(HaveLen(0))
			Expect(updatedPR.Spec.Groups[1].Rules).To(HaveLen(1))
			Expect(updatedPR.Spec.Groups[1].Rules[0].Labels["new_label"]).To(Equal("new_value"))
		})
	})

	Context("severity validation", func() {
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
										Rules: []monitoringv1.Rule{originalUserRule},
									},
								},
							},
						}, true, nil
					},
					UpdateFunc: func(ctx context.Context, pr monitoringv1.PrometheusRule) error {
						return nil
					},
				}
			}
		})

		It("rejects invalid severity", func() {
			updatedRule := originalUserRule
			updatedRule.Labels = map[string]string{
				"severity": "urgent",
			}
			_, err := client.UpdateUserDefinedAlertRule(ctx, userRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("invalid severity"))
		})
	})
})
