package management_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	corev1 "k8s.io/api/core/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("UpdateAlertRuleClassification", func() {
	var (
		ctx     context.Context
		mockK8s *testutils.MockClient
		client  management.Client

		overrideNamespace = "plugin-test-ns"
		ruleNamespace     = "openshift-cluster-version"
		ruleName          = "cluster-version-operator"
	)

	makeRule := func(ruleId string) monitoringv1.Rule {
		return monitoringv1.Rule{
			Alert: "CannotRetrieveUpdates",
			Labels: map[string]string{
				k8s.AlertRuleLabelId:             ruleId,
				k8s.PrometheusRuleLabelNamespace: ruleNamespace,
				k8s.PrometheusRuleLabelName:      ruleName,
			},
		}
	}

	encodeKey := func(ruleId string) string {
		return base64.RawURLEncoding.EncodeToString([]byte(ruleId))
	}

	BeforeEach(func() {
		Expect(os.Setenv("MONITORING_PLUGIN_NAMESPACE", overrideNamespace)).To(Succeed())
		ctx = context.Background()
		mockK8s = &testutils.MockClient{}
		client = management.New(ctx, mockK8s)
	})

	AfterEach(func() {
		Expect(os.Unsetenv("MONITORING_PLUGIN_NAMESPACE")).To(Succeed())
	})

	Context("validation", func() {
		It("returns ValidationError when ruleId is empty", func() {
			err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{})
			Expect(err).To(HaveOccurred())

			var ve *management.ValidationError
			Expect(errors.As(err, &ve)).To(BeTrue())
		})

		It("returns ValidationError on invalid layer", func() {
			rule := makeRule("rid-1")
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return rule, true
					},
				}
			}
			bad := "invalid"
			err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{
				RuleId:    "rid-1",
				Layer:     &bad,
				LayerSet:  true,
				Component: nil,
			})
			Expect(err).To(HaveOccurred())
			var ve *management.ValidationError
			Expect(errors.As(err, &ve)).To(BeTrue())
		})

		It("returns ValidationError on invalid component", func() {
			rule := makeRule("rid-1")
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return rule, true
					},
				}
			}
			empty := ""
			err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{
				RuleId:       "rid-1",
				Component:    &empty,
				ComponentSet: true,
				Layer:        nil,
				LayerSet:     false,
			})
			Expect(err).To(HaveOccurred())
			var ve *management.ValidationError
			Expect(errors.As(err, &ve)).To(BeTrue())
		})

		It("returns ValidationError on invalid openshift_io_alert_rule_component_from", func() {
			rule := makeRule("rid-1")
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return rule, true
					},
				}
			}
			bad := "bad-label"
			err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{
				RuleId:           "rid-1",
				ComponentFrom:    &bad,
				ComponentFromSet: true,
				LayerFrom:        nil,
				LayerFromSet:     false,
				Component:        nil,
				ComponentSet:     false,
				Layer:            nil,
				LayerSet:         false,
			})
			Expect(err).To(HaveOccurred())
			var ve *management.ValidationError
			Expect(errors.As(err, &ve)).To(BeTrue())
		})

		It("returns ValidationError on invalid openshift_io_alert_rule_layer_from", func() {
			rule := makeRule("rid-1")
			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
				return &testutils.MockRelabeledRulesInterface{
					GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
						return rule, true
					},
				}
			}
			bad := "1layer"
			err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{
				RuleId:       "rid-1",
				LayerFrom:    &bad,
				LayerFromSet: true,
			})
			Expect(err).To(HaveOccurred())
			var ve *management.ValidationError
			Expect(errors.As(err, &ve)).To(BeTrue())
		})
	})

	It("returns NotFoundError when the base rule cannot be found", func() {
		mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
					return monitoringv1.Rule{}, false
				},
			}
		}

		val := "cluster"
		err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{
			RuleId:   "missing",
			Layer:    &val,
			LayerSet: true,
		})
		Expect(err).To(HaveOccurred())

		var nf *management.NotFoundError
		Expect(errors.As(err, &nf)).To(BeTrue())
		Expect(nf.Resource).To(Equal("AlertRule"))
	})

	It("treats empty payload as a no-op (no ConfigMap calls)", func() {
		rule := makeRule("rid-1")
		mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
					return rule, true
				},
			}
		}

		calls := 0
		mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface {
			return &testutils.MockConfigMapInterface{
				GetFunc: func(ctx context.Context, namespace string, name string) (*corev1.ConfigMap, bool, error) {
					calls++
					return nil, false, nil
				},
				UpdateFunc: func(ctx context.Context, cm corev1.ConfigMap) error {
					calls++
					return nil
				},
				CreateFunc: func(ctx context.Context, cm corev1.ConfigMap) (*corev1.ConfigMap, error) {
					calls++
					return &cm, nil
				},
			}
		}

		err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{RuleId: "rid-1"})
		Expect(err).NotTo(HaveOccurred())
		Expect(calls).To(Equal(0))
	})

	It("persists normalized layer and component into the overrides ConfigMap", func() {
		ruleId := "rid-1"
		rule := makeRule(ruleId)

		mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
					Expect(id).To(Equal(ruleId))
					return rule, true
				},
			}
		}

		cmStore := &testutils.MockConfigMapInterface{ConfigMaps: map[string]*corev1.ConfigMap{}}
		mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface { return cmStore }

		component := "team-a"
		layer := "  NaMeSpAcE  "
		err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{
			RuleId:       ruleId,
			Component:    &component,
			ComponentSet: true,
			Layer:        &layer,
			LayerSet:     true,
		})
		Expect(err).NotTo(HaveOccurred())

		cmName := management.OverrideConfigMapName(ruleNamespace)
		key := overrideNamespace + "/" + cmName
		cm, ok := cmStore.ConfigMaps[key]
		Expect(ok).To(BeTrue())

		raw := cm.Data[encodeKey(ruleId)]
		Expect(raw).NotTo(BeEmpty())

		var payload struct {
			Classification struct {
				Component string `json:"openshift_io_alert_rule_component"`
				Layer     string `json:"openshift_io_alert_rule_layer"`
			} `json:"classification"`
		}
		Expect(json.Unmarshal([]byte(raw), &payload)).To(Succeed())
		Expect(payload.Classification.Component).To(Equal("team-a"))
		Expect(payload.Classification.Layer).To(Equal("namespace"))
	})

	It("persists component_from and layer_from into the overrides ConfigMap", func() {
		ruleId := "rid-1"
		rule := makeRule(ruleId)

		mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
					return rule, true
				},
			}
		}

		cmStore := &testutils.MockConfigMapInterface{ConfigMaps: map[string]*corev1.ConfigMap{}}
		mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface { return cmStore }

		componentFrom := "NaMe"
		layerFrom := "LaYeR"
		err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{
			RuleId:           ruleId,
			ComponentFrom:    &componentFrom,
			ComponentFromSet: true,
			LayerFrom:        &layerFrom,
			LayerFromSet:     true,
		})
		Expect(err).NotTo(HaveOccurred())

		cmName := management.OverrideConfigMapName(ruleNamespace)
		key := overrideNamespace + "/" + cmName
		cm, ok := cmStore.ConfigMaps[key]
		Expect(ok).To(BeTrue())

		raw := cm.Data[encodeKey(ruleId)]
		Expect(raw).NotTo(BeEmpty())

		var payload struct {
			Classification struct {
				ComponentFrom string `json:"openshift_io_alert_rule_component_from"`
				LayerFrom     string `json:"openshift_io_alert_rule_layer_from"`
			} `json:"classification"`
		}
		Expect(json.Unmarshal([]byte(raw), &payload)).To(Succeed())
		Expect(payload.Classification.ComponentFrom).To(Equal("NaMe"))
		Expect(payload.Classification.LayerFrom).To(Equal("LaYeR"))
	})

	It("does not create an overrides ConfigMap when clearing a non-existent entry", func() {
		ruleId := "rid-1"
		rule := makeRule(ruleId)

		mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
					return rule, true
				},
			}
		}

		createCalls := 0
		updateCalls := 0
		cmStore := &testutils.MockConfigMapInterface{
			CreateFunc: func(ctx context.Context, cm corev1.ConfigMap) (*corev1.ConfigMap, error) {
				createCalls++
				return &cm, nil
			},
			UpdateFunc: func(ctx context.Context, cm corev1.ConfigMap) error {
				updateCalls++
				return nil
			},
		}
		mockK8s.ConfigMapsFunc = func() k8s.ConfigMapInterface { return cmStore }

		err := client.UpdateAlertRuleClassification(ctx, management.UpdateRuleClassificationRequest{
			RuleId:       ruleId,
			Component:    nil,
			ComponentSet: true,
			Layer:        nil,
			LayerSet:     true,
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(createCalls).To(Equal(0))
		Expect(updateCalls).To(Equal(0))
	})
})
