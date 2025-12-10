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

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("UpdatePlatformAlertRule", func() {
	var (
		ctx        context.Context
		mockK8s    *testutils.MockClient
		mockPR     *testutils.MockPrometheusRuleInterface
		mockARC    *testutils.MockAlertRelabelConfigInterface
		mockMapper *testutils.MockMapperClient
		client     management.Client
	)

	BeforeEach(func() {
		ctx = context.Background()

		mockPR = &testutils.MockPrometheusRuleInterface{}
		mockARC = &testutils.MockAlertRelabelConfigInterface{}
		mockNSInformer := &testutils.MockNamespaceInformerInterface{}
		mockNSInformer.SetMonitoringNamespaces(map[string]bool{
			"platform-namespace-1": true,
			"platform-namespace-2": true,
		})
		mockK8s = &testutils.MockClient{
			PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
				return mockPR
			},
			AlertRelabelConfigsFunc: func() k8s.AlertRelabelConfigInterface {
				return mockARC
			},
			NamespaceInformerFunc: func() k8s.NamespaceInformerInterface {
				return mockNSInformer
			},
		}
		mockMapper = &testutils.MockMapperClient{}

		client = management.NewWithCustomMapper(ctx, mockK8s, mockMapper)
	})

	Context("when updating a platform alert rule", func() {
		It("should create an AlertRelabelConfig to update labels", func() {
			By("setting up the existing platform rule")
			existingRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning",
					"team":     "platform",
				},
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "openshift-platform-alerts",
					Namespace: "platform-namespace-1",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "platform-group",
							Rules: []monitoringv1.Rule{existingRule},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"platform-namespace-1/openshift-platform-alerts": prometheusRule,
			})

			alertRuleId := "test-platform-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "platform-namespace-1",
					Name:      "openshift-platform-alerts",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "PlatformAlert" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("updating labels through AlertRelabelConfig")
			updatedRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "critical",
					"team":     "platform",
					"owner":    "sre",
				},
			}

			err := client.UpdatePlatformAlertRule(ctx, alertRuleId, updatedRule)
			Expect(err).ToNot(HaveOccurred())

			By("verifying AlertRelabelConfig was created")
			arcs, err := mockARC.List(ctx, "platform-namespace-1")
			Expect(err).ToNot(HaveOccurred())
			Expect(arcs).To(HaveLen(1))

			arc := arcs[0]
			Expect(arc.Namespace).To(Equal("platform-namespace-1"))
			Expect(arc.Name).To(Equal("alertmanagement-test-platform-rule-id"))

			By("verifying relabel configs include label updates with alertname matching")
			Expect(arc.Spec.Configs).To(HaveLen(2))

			severityUpdate := false
			ownerAdd := false
			for _, config := range arc.Spec.Configs {
				Expect(config.Action).To(Equal("Replace"))
				Expect(config.SourceLabels).To(ContainElement(osmv1.LabelName("alertname")))
				Expect(config.Regex).To(ContainSubstring("PlatformAlert"))

				if config.TargetLabel == "severity" && config.Replacement == "critical" {
					severityUpdate = true
					Expect(config.SourceLabels).To(ContainElement(osmv1.LabelName("severity")))
				}
				if config.TargetLabel == "owner" && config.Replacement == "sre" {
					ownerAdd = true
					Expect(config.SourceLabels).To(ContainElement(osmv1.LabelName("owner")))
				}
			}
			Expect(severityUpdate).To(BeTrue())
			Expect(ownerAdd).To(BeTrue())
		})

		It("should update existing AlertRelabelConfig when one already exists", func() {
			By("setting up the existing platform rule and AlertRelabelConfig")
			existingRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning",
				},
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "openshift-platform-alerts",
					Namespace: "platform-namespace-1",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "platform-group",
							Rules: []monitoringv1.Rule{existingRule},
						},
					},
				},
			}

			existingARC := &osmv1.AlertRelabelConfig{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-platform-rule-id-relabel",
					Namespace: "platform-namespace-1",
				},
				Spec: osmv1.AlertRelabelConfigSpec{
					Configs: []osmv1.RelabelConfig{
						{
							SourceLabels: []osmv1.LabelName{"alertname"},
							Regex:        "PlatformAlert",
							Action:       "Keep",
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"platform-namespace-1/openshift-platform-alerts": prometheusRule,
			})
			mockARC.SetAlertRelabelConfigs(map[string]*osmv1.AlertRelabelConfig{
				"platform-namespace-1/alertmanagement-test-platform-rule-id": existingARC,
			})

			alertRuleId := "test-platform-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "platform-namespace-1",
					Name:      "openshift-platform-alerts",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "PlatformAlert" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("updating labels through existing AlertRelabelConfig")
			updatedRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "critical",
				},
			}

			err := client.UpdatePlatformAlertRule(ctx, alertRuleId, updatedRule)
			Expect(err).ToNot(HaveOccurred())

			By("verifying existing AlertRelabelConfig was updated")
			arc, found, err := mockARC.Get(ctx, "platform-namespace-1", "alertmanagement-test-platform-rule-id")
			Expect(found).To(BeTrue())
			Expect(err).ToNot(HaveOccurred())
			Expect(arc.Spec.Configs).To(HaveLen(1))
			Expect(arc.Spec.Configs[0].Action).To(Equal("Replace"))
			Expect(arc.Spec.Configs[0].SourceLabels).To(ContainElement(osmv1.LabelName("alertname")))
			Expect(arc.Spec.Configs[0].TargetLabel).To(Equal("severity"))
			Expect(arc.Spec.Configs[0].Replacement).To(Equal("critical"))
		})

		It("should handle label removal", func() {
			By("setting up the existing platform rule with multiple labels")
			existingRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning",
					"team":     "platform",
					"owner":    "sre",
				},
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "openshift-platform-alerts",
					Namespace: "platform-namespace-1",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "platform-group",
							Rules: []monitoringv1.Rule{existingRule},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"platform-namespace-1/openshift-platform-alerts": prometheusRule,
			})

			alertRuleId := "test-platform-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "platform-namespace-1",
					Name:      "openshift-platform-alerts",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "PlatformAlert" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("updating with fewer labels")
			updatedRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning",
				},
			}

			err := client.UpdatePlatformAlertRule(ctx, alertRuleId, updatedRule)
			Expect(err).ToNot(HaveOccurred())

			By("verifying AlertRelabelConfig includes label removal actions")
			arcs, err := mockARC.List(ctx, "platform-namespace-1")
			Expect(err).ToNot(HaveOccurred())
			Expect(arcs).To(HaveLen(1))

			arc := arcs[0]
			Expect(arc.Spec.Configs).To(HaveLen(2))

			labelRemovalCount := 0
			for _, config := range arc.Spec.Configs {
				if config.Replacement == "" && (config.TargetLabel == "team" || config.TargetLabel == "owner") {
					labelRemovalCount++
					Expect(config.Action).To(Equal("Replace"))
					Expect(config.SourceLabels).To(ContainElement(osmv1.LabelName("alertname")))
				}
			}
			Expect(labelRemovalCount).To(Equal(2))
		})

		It("should return error when trying to update non-platform rule", func() {
			By("setting up a user-defined rule")
			alertRuleId := "test-user-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "user-namespace",
					Name:      "user-rule",
				}, nil
			}

			updatedRule := monitoringv1.Rule{
				Alert: "UserAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "critical",
				},
			}

			err := client.UpdatePlatformAlertRule(ctx, alertRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("cannot update non-platform alert rule"))
		})

		It("should return error when no label changes detected", func() {
			By("setting up the existing platform rule")
			existingRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning",
				},
			}

			prometheusRule := &monitoringv1.PrometheusRule{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "openshift-platform-alerts",
					Namespace: "platform-namespace-1",
				},
				Spec: monitoringv1.PrometheusRuleSpec{
					Groups: []monitoringv1.RuleGroup{
						{
							Name:  "platform-group",
							Rules: []monitoringv1.Rule{existingRule},
						},
					},
				},
			}

			mockPR.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
				"platform-namespace-1/openshift-platform-alerts": prometheusRule,
			})

			alertRuleId := "test-platform-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return &mapper.PrometheusRuleId{
					Namespace: "platform-namespace-1",
					Name:      "openshift-platform-alerts",
				}, nil
			}
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				if alertRule.Alert == "PlatformAlert" {
					return mapper.PrometheusAlertRuleId(alertRuleId)
				}
				return mapper.PrometheusAlertRuleId("other-id")
			}

			By("updating with same labels")
			updatedRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning",
				},
			}

			err := client.UpdatePlatformAlertRule(ctx, alertRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("no label changes detected"))
		})

		It("should return error when alert rule not found", func() {
			By("setting up mapper to return rule ID")
			alertRuleId := "non-existent-rule-id"
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return nil, errors.New("alert rule not found")
			}

			updatedRule := monitoringv1.Rule{
				Alert: "PlatformAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "critical",
				},
			}

			err := client.UpdatePlatformAlertRule(ctx, alertRuleId, updatedRule)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("alert rule not found"))
		})
	})
})
