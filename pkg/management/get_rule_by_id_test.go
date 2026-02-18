package management_test

import (
	"context"
	"errors"
	"maps"

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
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
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

	Context("when rule has openshift_io_rule_managed_by label computed by DetermineManagedBy", func() {
		var (
			mockARC          *testutils.MockAlertRelabelConfigInterface
			mockNamespaceMgr *testutils.MockNamespaceInterface
		)

		BeforeEach(func() {
			mockARC = &testutils.MockAlertRelabelConfigInterface{}
			mockNamespaceMgr = &testutils.MockNamespaceInterface{}
		})

		It("returns rule with openshift_io_rule_managed_by=operator when PrometheusRule has OwnerReferences", func() {
			promRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "operator-rule",
					Namespace: "test-namespace",
					OwnerReferences: []metav1.OwnerReference{
						{
							APIVersion: "apps/v1",
							Kind:       "Deployment",
							Name:       "test-operator",
							UID:        "test-uid",
						},
					},
				},
			}

			mockNamespaceMgr.IsClusterMonitoringNamespaceFunc = func(name string) bool {
				return false // User rule
			}
			ruleManagedBy, relabelConfigManagedBy := k8s.DetermineManagedByForTesting(ctx, mockARC, mockNamespaceMgr, promRule, testRuleId)

			// Create rule with label computed by DetermineManagedBy
			ruleWithLabel := testRule
			if ruleWithLabel.Labels == nil {
				ruleWithLabel.Labels = make(map[string]string)
			} else {
				ruleWithLabel.Labels = maps.Clone(ruleWithLabel.Labels) // Deep copy labels
			}
			ruleWithLabel.Labels[managementlabels.AlertNameLabel] = ruleWithLabel.Alert
			ruleWithLabel.Labels[k8s.AlertRuleLabelId] = testRuleId
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelNamespace] = promRule.Namespace
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelName] = promRule.Name
			if ruleManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RuleManagedByLabel] = ruleManagedBy
			}
			if relabelConfigManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RelabelConfigManagedByLabel] = relabelConfigManagedBy
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == testRuleId {
							return ruleWithLabel, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			rule, err := client.GetRuleById(ctx, testRuleId)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Labels).To(HaveKey(managementlabels.RuleManagedByLabel))
			Expect(rule.Labels[managementlabels.RuleManagedByLabel]).To(Equal("operator"))
		})

		It("returns rule without openshift_io_rule_managed_by label when PrometheusRule has no special conditions", func() {
			promRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "local-rule",
					Namespace: "test-namespace",
				},
			}

			mockNamespaceMgr.IsClusterMonitoringNamespaceFunc = func(name string) bool {
				return false // User rule
			}
			ruleManagedBy, relabelConfigManagedBy := k8s.DetermineManagedByForTesting(ctx, mockARC, mockNamespaceMgr, promRule, testRuleId)

			ruleWithLabel := testRule
			if ruleWithLabel.Labels == nil {
				ruleWithLabel.Labels = make(map[string]string)
			} else {
				ruleWithLabel.Labels = maps.Clone(ruleWithLabel.Labels) // Deep copy labels
			}
			ruleWithLabel.Labels[managementlabels.AlertNameLabel] = ruleWithLabel.Alert
			ruleWithLabel.Labels[k8s.AlertRuleLabelId] = testRuleId
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelNamespace] = promRule.Namespace
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelName] = promRule.Name
			if ruleManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RuleManagedByLabel] = ruleManagedBy
			}
			if relabelConfigManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RelabelConfigManagedByLabel] = relabelConfigManagedBy
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == testRuleId {
							return ruleWithLabel, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			rule, err := client.GetRuleById(ctx, testRuleId)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Labels).NotTo(HaveKey(managementlabels.RuleManagedByLabel)) // Label should not be added
		})

		It("returns platform rule with openshift_io_relabel_config_managed_by=gitops when AlertRelabelConfig is GitOps managed", func() {
			promRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "platform-rule",
					Namespace: "openshift-monitoring",
					OwnerReferences: []metav1.OwnerReference{
						{
							APIVersion: "apps/v1",
							Kind:       "Deployment",
							Name:       "test-operator",
							UID:        "test-uid",
						},
					},
				},
			}

			mockARC.GetFunc = func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				return &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      name,
						Namespace: namespace,
						Annotations: map[string]string{
							"argocd.argoproj.io/tracking-id": "test-id",
						},
					},
				}, true, nil
			}

			mockNamespaceMgr.IsClusterMonitoringNamespaceFunc = func(name string) bool {
				return true // Platform rule
			}
			ruleManagedBy, relabelConfigManagedBy := k8s.DetermineManagedByForTesting(ctx, mockARC, mockNamespaceMgr, promRule, testRuleId)

			ruleWithLabel := testRule
			if ruleWithLabel.Labels == nil {
				ruleWithLabel.Labels = make(map[string]string)
			} else {
				ruleWithLabel.Labels = maps.Clone(ruleWithLabel.Labels) // Deep copy labels
			}
			ruleWithLabel.Labels[managementlabels.AlertNameLabel] = ruleWithLabel.Alert
			ruleWithLabel.Labels[k8s.AlertRuleLabelId] = testRuleId
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelNamespace] = promRule.Namespace
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelName] = promRule.Name
			if ruleManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RuleManagedByLabel] = ruleManagedBy
			}
			if relabelConfigManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RelabelConfigManagedByLabel] = relabelConfigManagedBy
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == testRuleId {
							return ruleWithLabel, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			rule, err := client.GetRuleById(ctx, testRuleId)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Labels).To(HaveKey(managementlabels.RuleManagedByLabel))
			Expect(rule.Labels[managementlabels.RuleManagedByLabel]).To(Equal("operator")) // Platform rule with OwnerReferences
			Expect(rule.Labels).To(HaveKey(managementlabels.RelabelConfigManagedByLabel))
			Expect(rule.Labels[managementlabels.RelabelConfigManagedByLabel]).To(Equal("gitops"))
		})

		It("returns platform rule with openshift_io_rule_managed_by=gitops when PrometheusRule is GitOps managed", func() {
			promRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "platform-rule",
					Namespace: "openshift-monitoring",
					Annotations: map[string]string{
						"argocd.argoproj.io/tracking-id": "test-id",
					},
				},
			}

			mockNamespaceMgr.IsClusterMonitoringNamespaceFunc = func(name string) bool {
				return true // Platform rule
			}
			ruleManagedBy, relabelConfigManagedBy := k8s.DetermineManagedByForTesting(ctx, mockARC, mockNamespaceMgr, promRule, testRuleId)

			ruleWithLabel := testRule
			if ruleWithLabel.Labels == nil {
				ruleWithLabel.Labels = make(map[string]string)
			} else {
				ruleWithLabel.Labels = maps.Clone(ruleWithLabel.Labels) // Deep copy labels
			}
			ruleWithLabel.Labels[managementlabels.AlertNameLabel] = ruleWithLabel.Alert
			ruleWithLabel.Labels[k8s.AlertRuleLabelId] = testRuleId
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelNamespace] = promRule.Namespace
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelName] = promRule.Name
			if ruleManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RuleManagedByLabel] = ruleManagedBy
			}
			if relabelConfigManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RelabelConfigManagedByLabel] = relabelConfigManagedBy
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == testRuleId {
							return ruleWithLabel, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			rule, err := client.GetRuleById(ctx, testRuleId)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Labels).To(HaveKey(managementlabels.RuleManagedByLabel))
			Expect(rule.Labels[managementlabels.RuleManagedByLabel]).To(Equal("gitops")) // Platform rule with GitOps annotations
		})

		It("returns platform rule without openshift_io_relabel_config_managed_by label when AlertRelabelConfig is not GitOps managed", func() {
			promRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "platform-rule",
					Namespace: "openshift-monitoring",
					OwnerReferences: []metav1.OwnerReference{
						{
							APIVersion: "apps/v1",
							Kind:       "Deployment",
							Name:       "test-operator",
							UID:        "test-uid",
						},
					},
				},
			}

			mockARC.GetFunc = func(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
				return &osmv1.AlertRelabelConfig{
					ObjectMeta: metav1.ObjectMeta{
						Name:      name,
						Namespace: namespace,
						// No GitOps annotations/labels
					},
				}, true, nil
			}

			mockNamespaceMgr.IsClusterMonitoringNamespaceFunc = func(name string) bool {
				return true // Platform rule
			}
			ruleManagedBy, relabelConfigManagedBy := k8s.DetermineManagedByForTesting(ctx, mockARC, mockNamespaceMgr, promRule, testRuleId)

			ruleWithLabel := testRule
			if ruleWithLabel.Labels == nil {
				ruleWithLabel.Labels = make(map[string]string)
			} else {
				ruleWithLabel.Labels = maps.Clone(ruleWithLabel.Labels) // Deep copy labels
			}
			ruleWithLabel.Labels[managementlabels.AlertNameLabel] = ruleWithLabel.Alert
			ruleWithLabel.Labels[k8s.AlertRuleLabelId] = testRuleId
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelNamespace] = promRule.Namespace
			ruleWithLabel.Labels[k8s.PrometheusRuleLabelName] = promRule.Name
			if ruleManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RuleManagedByLabel] = ruleManagedBy
			}
			if relabelConfigManagedBy != "" {
				ruleWithLabel.Labels[managementlabels.RelabelConfigManagedByLabel] = relabelConfigManagedBy
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						if id == testRuleId {
							return ruleWithLabel, true
						}
						return monitoringv1.Rule{}, false
					},
				}
			}

			rule, err := client.GetRuleById(ctx, testRuleId)
			Expect(err).NotTo(HaveOccurred())
			Expect(rule.Labels).To(HaveKey(managementlabels.RuleManagedByLabel))
			Expect(rule.Labels[managementlabels.RuleManagedByLabel]).To(Equal("operator"))   // Platform rule with OwnerReferences
			Expect(rule.Labels).NotTo(HaveKey(managementlabels.RelabelConfigManagedByLabel)) // Label should not be added
		})
	})
})
