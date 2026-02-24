package managementrouter_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("DeleteUserDefinedAlertRuleById", func() {
	var (
		router  http.Handler
		mockK8s *testutils.MockClient
	)

	var (
		userRule1Name = "u1"
		userRule1     = monitoringv1.Rule{Alert: userRule1Name, Labels: map[string]string{k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr"}}
		userRule1Id   = alertrule.GetAlertingRuleId(&userRule1)

		userRule2Name = "u2"
		userRule2     = monitoringv1.Rule{Alert: userRule2Name, Labels: map[string]string{k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr"}}
		userRule2Id   = alertrule.GetAlertingRuleId(&userRule2)

		platformRuleName = "p1"
		platformRule     = monitoringv1.Rule{Alert: platformRuleName, Labels: map[string]string{k8s.PrometheusRuleLabelNamespace: "platform-namespace-1", k8s.PrometheusRuleLabelName: "platform-pr"}}
		platformRuleId   = alertrule.GetAlertingRuleId(&platformRule)
	)

	BeforeEach(func() {
		mockK8s = &testutils.MockClient{}
		mgmt := management.New(context.Background(), mockK8s)
		router = managementrouter.New(mgmt)

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
									Rules: []monitoringv1.Rule{userRule1, userRule2, platformRule},
								},
							},
						},
					}, true, nil
				},
				DeleteFunc: func(ctx context.Context, namespace string, name string) error {
					return nil
				},
				UpdateFunc: func(ctx context.Context, pr monitoringv1.PrometheusRule) error {
					return nil
				},
			}
		}

		mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
					switch id {
					case userRule1Id:
						return userRule1, true
					case userRule2Id:
						return userRule2, true
					case platformRuleId:
						return platformRule, true
					default:
						return monitoringv1.Rule{}, false
					}
				},
			}
		}

		// Provide owning AlertingRule so platform (user-via-platform) deletion can succeed
		mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				GetFunc: func(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error) {
					if name == "platform-alert-rules" {
						return &osmv1.AlertingRule{
							ObjectMeta: metav1.ObjectMeta{
								Name:      "platform-alert-rules",
								Namespace: k8s.ClusterMonitoringNamespace,
							},
							Spec: osmv1.AlertingRuleSpec{
								Groups: []osmv1.RuleGroup{
									{
										Name: "test-group",
										Rules: []osmv1.Rule{
											{Alert: platformRuleName},
										},
									},
								},
							},
						}, true, nil
					}
					return nil, false, nil
				},
				UpdateFunc: func(ctx context.Context, ar osmv1.AlertingRule) error {
					return nil
				},
			}
		}

		mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool {
					return strings.HasPrefix(name, "platform-namespace-")
				},
			}
		}
	})

	Context("when ruleId is missing or blank", func() {
		It("returns 400 with missing ruleId message", func() {
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules/%20", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("missing ruleId"))
		})
	})

	Context("when rule is not found", func() {
		It("returns 404 with expected message", func() {
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules/missing", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusNotFound))
			Expect(w.Body.String()).To(ContainSubstring("AlertRule with id missing not found"))
		})
	})

	Context("when deleting a user-defined rule", func() {
		It("returns 204", func() {
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules/"+userRule1Id, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusNoContent))
		})
	})

	Context("when deleting a platform rule", func() {
		It("returns 204 for user-via-platform (not operator-managed)", func() {
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules/"+platformRuleId, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusNoContent))
			Expect(w.Body.String()).To(BeEmpty())
		})
	})
})
