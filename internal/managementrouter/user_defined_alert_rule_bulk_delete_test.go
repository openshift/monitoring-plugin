package managementrouter_test

import (
	"bytes"
	"context"
	"encoding/json"
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

var _ = Describe("BulkDeleteUserDefinedAlertRules", func() {
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

		platformRuleName = "platform"
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

	Context("when deleting multiple rules", func() {
		It("returns deleted and failed for mixed ruleIds and updates rules", func() {
			body := map[string]any{"ruleIds": []string{userRule1Id, platformRuleId, ""}}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp struct {
				Rules []struct {
					Id         string `json:"id"`
					StatusCode int    `json:"status_code"`
					Message    string `json:"message"`
				} `json:"rules"`
			}
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Rules).To(HaveLen(3))

			// u1 -> success
			Expect(resp.Rules[0].Id).To(Equal(userRule1Id))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent), resp.Rules[0].Message)
			Expect(resp.Rules[0].Message).To(BeEmpty())

			// platform1 (user-via-platform) -> success
			Expect(resp.Rules[1].Id).To(Equal(platformRuleId))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusNoContent), resp.Rules[1].Message)
			Expect(resp.Rules[1].Message).To(BeEmpty())

			// "" -> bad request (missing id)
			Expect(resp.Rules[2].Id).To(Equal(""))
			Expect(resp.Rules[2].StatusCode).To(Equal(http.StatusBadRequest), resp.Rules[2].Message)
			Expect(resp.Rules[2].Message).To(ContainSubstring("missing ruleId"))
		})

		It("returns all deleted when all user ruleIds succeed", func() {
			body := map[string]any{"ruleIds": []string{userRule1Id, userRule2Id}}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			Expect(w.Code).To(Equal(http.StatusOK))
			var resp struct {
				Rules []struct {
					Id         string `json:"id"`
					StatusCode int    `json:"status_code"`
					Message    string `json:"message"`
				} `json:"rules"`
			}
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Rules).To(HaveLen(2))

			// platform1 -> success
			Expect(resp.Rules[0].Id).To(Equal(userRule1Id))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent), resp.Rules[0].Message)
			Expect(resp.Rules[0].Message).To(BeEmpty())

			// platform2 -> success
			Expect(resp.Rules[1].Id).To(Equal(userRule2Id))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusNoContent), resp.Rules[1].Message)
			Expect(resp.Rules[1].Message).To(BeEmpty())
		})
	})

	Context("when request body is invalid", func() {
		It("returns 400", func() {
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules", bytes.NewBufferString("{"))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("invalid request body"))
		})
	})

	Context("when ruleIds is empty", func() {
		It("returns 400", func() {
			body := map[string]interface{}{"ruleIds": []string{}}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("ruleIds is required"))
		})
	})
})
