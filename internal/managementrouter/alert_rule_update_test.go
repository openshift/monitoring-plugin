package managementrouter_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("UpdateAlertRule", func() {
	var (
		router             http.Handler
		mockK8sRules       *testutils.MockPrometheusRuleInterface
		mockK8s            *testutils.MockClient
		mockRelabeledRules *testutils.MockRelabeledRulesInterface
	)

	var (
		userRule       = monitoringv1.Rule{Alert: "user-alert", Expr: intstr.FromString("up == 0"), Labels: map[string]string{"severity": "warning"}}
		userRuleId     = alertrule.GetAlertingRuleId(&userRule)
		platformRule   = monitoringv1.Rule{Alert: "platform-alert", Expr: intstr.FromString("cpu > 80"), Labels: map[string]string{"severity": "critical"}}
		platformRuleId = alertrule.GetAlertingRuleId(&platformRule)
	)

	BeforeEach(func() {
		mockK8sRules = &testutils.MockPrometheusRuleInterface{}

		userPR := monitoringv1.PrometheusRule{}
		userPR.Name = "user-pr"
		userPR.Namespace = "default"
		userPR.Spec.Groups = []monitoringv1.RuleGroup{
			{
				Name: "g1",
				Rules: []monitoringv1.Rule{
					{
						Alert:  "user-alert",
						Expr:   intstr.FromString("up == 0"),
						Labels: map[string]string{"severity": "warning"},
					},
				},
			},
		}

		platformPR := monitoringv1.PrometheusRule{}
		platformPR.Name = "platform-pr"
		platformPR.Namespace = "platform-namespace-1"
		platformPR.Spec.Groups = []monitoringv1.RuleGroup{
			{
				Name: "pg1",
				Rules: []monitoringv1.Rule{
					{
						Alert:  "platform-alert",
						Expr:   intstr.FromString("cpu > 80"),
						Labels: map[string]string{"severity": "critical"},
					},
				},
			},
		}

		mockK8sRules.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
			"default/user-pr":                  &userPR,
			"platform-namespace-1/platform-pr": &platformPR,
		})

		mockNamespace := &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool {
				return name == "platform-namespace-1" || name == "platform-namespace-2"
			},
		}

		mockRelabeledRules = &testutils.MockRelabeledRulesInterface{
			GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
				if id == userRuleId {
					return monitoringv1.Rule{
						Alert: "user-alert",
						Expr:  intstr.FromString("up == 0"),
						Labels: map[string]string{
							"severity":                       "warning",
							k8s.PrometheusRuleLabelNamespace: "default",
							k8s.PrometheusRuleLabelName:      "user-pr",
						},
					}, true
				}
				if id == platformRuleId {
					return monitoringv1.Rule{
						Alert: "platform-alert",
						Expr:  intstr.FromString("cpu > 80"),
						Labels: map[string]string{
							"severity":                       "critical",
							k8s.PrometheusRuleLabelNamespace: "platform-namespace-1",
							k8s.PrometheusRuleLabelName:      "platform-pr",
						},
					}, true
				}
				return monitoringv1.Rule{}, false
			},
		}

		mockK8s = &testutils.MockClient{
			PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
				return mockK8sRules
			},
			NamespaceFunc: func() k8s.NamespaceInterface {
				return mockNamespace
			},
			RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
				return mockRelabeledRules
			},
		}

		mgmt := management.New(context.Background(), mockK8s)
		router = managementrouter.New(mgmt)
	})

	Context("when updating a user-defined alert rule", func() {
		It("should successfully update the rule and return new ID", func() {
			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "user-alert",
					"expr":  "up == 1",
					"labels": map[string]string{
						"severity": "critical",
						"team":     "sre",
					},
				},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules/"+userRuleId, bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.UpdateAlertRuleResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())

			updatedRule := monitoringv1.Rule{
				Alert: "user-alert",
				Expr:  intstr.FromString("up == 1"),
				Labels: map[string]string{
					"severity": "critical",
					"team":     "sre",
				},
			}
			expectedNewRuleId := alertrule.GetAlertingRuleId(&updatedRule)

			Expect(resp.Id).To(Equal(expectedNewRuleId))
			Expect(resp.Id).NotTo(Equal("user-alert"))
			Expect(resp.StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Message).To(BeEmpty())
		})

		It("should replace all labels without merging", func() {
			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "user-alert",
					"expr":  "up == 0",
					"labels": map[string]string{
						"team": "sre",
					},
				},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules/"+userRuleId, bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.UpdateAlertRuleResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())

			updatedRule := monitoringv1.Rule{
				Alert: "user-alert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"team": "sre",
				},
			}
			expectedNewRuleId := alertrule.GetAlertingRuleId(&updatedRule)

			Expect(resp.Id).To(Equal(expectedNewRuleId))
			Expect(resp.StatusCode).To(Equal(http.StatusNoContent))
		})
	})

	Context("when updating a platform alert rule", func() {
		It("should successfully update labels via AlertRelabelConfig", func() {
			mockARC := &testutils.MockAlertRelabelConfigInterface{}
			mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
				return mockARC
			}

			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "platform-alert",
					"expr":  "cpu > 80",
					"labels": map[string]string{
						"severity": "warning",
					},
				},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules/"+platformRuleId, bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.UpdateAlertRuleResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Id).To(Equal(platformRuleId))
			Expect(resp.StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Message).To(BeEmpty())
		})
	})

	Context("when ruleId is missing", func() {
		It("should return 400", func() {
			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "test-alert",
				},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules/%20", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("missing ruleId"))
		})
	})

	Context("when request body is invalid", func() {
		It("should return 400", func() {
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules/user-alert", bytes.NewBufferString("{"))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("invalid request body"))
		})
	})

	Context("when alertingRule is missing", func() {
		It("should return 400", func() {
			body := map[string]interface{}{}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules/"+userRuleId, bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("alertingRule is required"))
		})
	})

	Context("when rule is not found", func() {
		It("should return JSON response with 404 status code", func() {
			mockRelabeledRules.GetFunc = func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
				return monitoringv1.Rule{}, false
			}

			mgmt := management.New(context.Background(), mockK8s)
			router = managementrouter.New(mgmt)

			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "missing-alert",
				},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules/missing-alert;hash", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.UpdateAlertRuleResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Id).To(Equal("missing-alert;hash"))
			Expect(resp.StatusCode).To(Equal(http.StatusNotFound))
			Expect(resp.Message).To(ContainSubstring("not found"))
		})
	})
})
