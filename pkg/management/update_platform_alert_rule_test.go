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

		It("deletes existing ARC when reverting to original", func() {
			// Simulate an existing ARC present
			deleted := false
			mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
				return &testutils.MockAlertRelabelConfigInterface{
					GetFunc: func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
						return &osmv1.AlertRelabelConfig{
							ObjectMeta: metav1.ObjectMeta{
								Name:      name,
								Namespace: namespace,
							},
							Spec: osmv1.AlertRelabelConfigSpec{Configs: []osmv1.RelabelConfig{}},
						}, true, nil
					},
					DeleteFunc: func(ctx context.Context, namespace string, name string) error {
						deleted = true
						return nil
					},
				}
			}

			updatedRule := originalPlatformRule // revert to original
			err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
			Expect(err).NotTo(HaveOccurred())
			Expect(deleted).To(BeTrue())
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
				Expect(strings.HasPrefix(createdARC.Name, "arc-")).To(BeTrue())
				Expect(createdARC.Spec.Configs).NotTo(BeEmpty())
			})

			It("scopes id stamp by alertname + all original static labels (excluding namespace)", func() {
				var createdARC *osmv1.AlertRelabelConfig

				// Override PR getter to return a rule with extra stable labels
				mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
					return &testutils.MockPrometheusRuleInterface{
						GetFunc: func(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
							orig := originalPlatformRule
							orig.Labels = map[string]string{
								"severity":  "critical",
								"component": "kube",
								"team":      "sre",
							}
							return &monitoringv1.PrometheusRule{
								ObjectMeta: metav1.ObjectMeta{
									Namespace: namespace,
									Name:      name,
								},
								Spec: monitoringv1.PrometheusRuleSpec{
									Groups: []monitoringv1.RuleGroup{
										{
											Name:  "test-group",
											Rules: []monitoringv1.Rule{orig},
										},
									},
								},
							}, true, nil
						},
					}
				}

				// Compute the id for the PR's original rule (with extra stable labels)
				origWithExtras := originalPlatformRule
				origWithExtras.Labels = map[string]string{
					"severity":  "critical",
					"component": "kube",
					"team":      "sre",
				}
				idForExtras := alertrule.GetAlertingRuleId(&origWithExtras)

				// RelabeledRules should resolve using the same id
				mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
					return &testutils.MockRelabeledRulesInterface{
						GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
							if id == idForExtras {
								return monitoringv1.Rule{
									Alert: "PlatformAlert",
									Expr:  intstr.FromString("node_down == 1"),
									Labels: map[string]string{
										k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
										k8s.PrometheusRuleLabelName:      "platform-rule",
										k8s.AlertRuleLabelId:             idForExtras,
										"severity":                       "critical",
									},
								}, true
							}
							return monitoringv1.Rule{}, false
						},
					}
				}

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
					"severity": "info",
				}

				err := client.UpdatePlatformAlertRule(ctx, idForExtras, updatedRule)
				Expect(err).NotTo(HaveOccurred())
				Expect(createdARC).NotTo(BeNil())
				// Expect two entries: id-stamp Replace, then severity Replace
				Expect(createdARC.Spec.Configs).To(HaveLen(2))

				idCfg := createdARC.Spec.Configs[0]
				Expect(string(idCfg.Action)).To(Equal("Replace"))
				Expect(string(idCfg.TargetLabel)).To(Equal("openshift_io_alert_rule_id"))
				// SourceLabels must include alertname and all original static labels
				var sl []string
				for _, s := range idCfg.SourceLabels {
					sl = append(sl, string(s))
				}
				Expect(sl).To(ContainElements("alertname", "component", "severity", "team"))
				Expect(sl).NotTo(ContainElement("namespace"))
				// Regex must be anchored and include alertname; then values for component,severity,team in sorted key order
				Expect(strings.HasPrefix(idCfg.Regex, "^")).To(BeTrue())
				Expect(strings.HasSuffix(idCfg.Regex, "$")).To(BeTrue())
				// sorted(keys: component, severity, team) => values after alertname: kube;critical;sre
				Expect(idCfg.Regex).To(ContainSubstring("^PlatformAlert;kube;critical;sre$"))
			})

			It("emits id setter then a single Replace for simple severity change", func() {
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
					"severity": "info",
				}

				err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
				Expect(err).NotTo(HaveOccurred())
				Expect(createdARC).NotTo(BeNil())
				// Expect two entries: id setter Replace, then severity Replace
				Expect(createdARC.Spec.Configs).To(HaveLen(2))
				cfg0 := createdARC.Spec.Configs[0]
				Expect(string(cfg0.Action)).To(Equal("Replace"))
				Expect(string(cfg0.TargetLabel)).To(Equal("openshift_io_alert_rule_id"))
				Expect(cfg0.Replacement).To(Equal(platformRuleId))
				cfg1 := createdARC.Spec.Configs[1]
				Expect(string(cfg1.Action)).To(Equal("Replace"))
				Expect(string(cfg1.TargetLabel)).To(Equal("severity"))
				Expect(cfg1.Replacement).To(Equal("info"))
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
						Spec: osmv1.AlertRelabelConfigSpec{
							Configs: []osmv1.RelabelConfig{
								{
									TargetLabel: "testing2",
									Replacement: "newlabel2",
									Action:      "Replace",
								},
							},
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
						Spec: osmv1.AlertRelabelConfigSpec{
							Configs: []osmv1.RelabelConfig{
								{
									TargetLabel: "testing2",
									Replacement: "newlabel2",
									Action:      "Replace",
								},
							},
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

			It("removes override-only label (explicit delete) and deletes ARC when no other overrides remain", func() {
				var updatedARC *osmv1.AlertRelabelConfig
				deleted := false
				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					existingARC := &osmv1.AlertRelabelConfig{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "alertmanagement-existing",
							Namespace: "openshift-monitoring",
						},
						Spec: osmv1.AlertRelabelConfigSpec{
							Configs: []osmv1.RelabelConfig{
								{
									TargetLabel: "testing2",
									Replacement: "newlabel2",
									Action:      "Replace",
								},
							},
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
						DeleteFunc: func(ctx context.Context, namespace string, name string) error {
							deleted = true
							return nil
						},
					}
				}

				// Explicitly drop testing2; keep severity unchanged (no override)
				updatedRule := originalPlatformRule
				updatedRule.Labels = map[string]string{
					"severity": "critical",
					"testing2": "",
				}

				err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
				Expect(err).NotTo(HaveOccurred())
				// No more overrides remain (severity unchanged), ARC should be deleted
				Expect(updatedARC).To(BeNil())
				Expect(deleted).To(BeTrue())
			})
		})

		Context("when dropping labels", func() {
			It("rejects dropping severity label", func() {
				updatedRule := originalPlatformRule
				// Attempt to drop severity explicitly (K8s-style)
				updatedRule.Labels = map[string]string{"severity": ""}

				err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
				Expect(err).To(HaveOccurred())
				Expect(err.Error()).To(ContainSubstring("label \"severity\" cannot be dropped"))
			})
		})

		Context("when attempting to modify protected labels", func() {
			It("ignores provenance/identity labels merged from relabeled state", func() {
				updatedRule := originalPlatformRule
				updatedRule.Labels = map[string]string{
					"severity":                   "critical",
					"openshift_io_alert_rule_id": "fake",
				}
				err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
				Expect(err).NotTo(HaveOccurred())
			})

			It("rejects changing alertname via labels", func() {
				updatedRule := originalPlatformRule
				updatedRule.Labels = map[string]string{
					"alertname": "NewName",
				}
				err := client.UpdatePlatformAlertRule(ctx, platformRuleId, updatedRule)
				Expect(err).To(HaveOccurred())
				Expect(err.Error()).To(ContainSubstring("immutable"))
			})
		})
	})
})
