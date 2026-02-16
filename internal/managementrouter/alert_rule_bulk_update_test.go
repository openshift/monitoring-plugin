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

var _ = Describe("BulkUpdateAlertRules", func() {
	var (
		router             http.Handler
		mockK8sRules       *testutils.MockPrometheusRuleInterface
		mockK8s            *testutils.MockClient
		mockRelabeledRules *testutils.MockRelabeledRulesInterface
	)

	var (
		userRule1      = monitoringv1.Rule{Alert: "user-alert-1", Expr: intstr.FromString("up == 0"), Labels: map[string]string{"severity": "warning"}}
		userRule1Id    = alertrule.GetAlertingRuleId(&userRule1)
		userRule2      = monitoringv1.Rule{Alert: "user-alert-2", Expr: intstr.FromString("cpu > 80"), Labels: map[string]string{"severity": "info"}}
		userRule2Id    = alertrule.GetAlertingRuleId(&userRule2)
		platformRule   = monitoringv1.Rule{Alert: "platform-alert", Expr: intstr.FromString("memory > 90"), Labels: map[string]string{"severity": "critical"}}
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
						Alert:  "user-alert-1",
						Expr:   intstr.FromString("up == 0"),
						Labels: map[string]string{"severity": "warning"},
					},
					{
						Alert:  "user-alert-2",
						Expr:   intstr.FromString("cpu > 80"),
						Labels: map[string]string{"severity": "info"},
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
						Expr:   intstr.FromString("memory > 90"),
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
				if id == userRule1Id {
					return monitoringv1.Rule{
						Alert: "user-alert-1",
						Expr:  intstr.FromString("up == 0"),
						Labels: map[string]string{
							"severity":                       "warning",
							k8s.PrometheusRuleLabelNamespace: "default",
							k8s.PrometheusRuleLabelName:      "user-pr",
						},
					}, true
				}
				if id == userRule2Id {
					return monitoringv1.Rule{
						Alert: "user-alert-2",
						Expr:  intstr.FromString("cpu > 80"),
						Labels: map[string]string{
							"severity":                       "info",
							k8s.PrometheusRuleLabelNamespace: "default",
							k8s.PrometheusRuleLabelName:      "user-pr",
						},
					}, true
				}
				if id == platformRuleId {
					return monitoringv1.Rule{
						Alert: "platform-alert",
						Expr:  intstr.FromString("memory > 90"),
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

	Context("when updating multiple user-defined rules", func() {
		It("should successfully update all rules and return new IDs", func() {
			body := map[string]interface{}{
				"ruleIds": []string{userRule1Id, userRule2Id},
				"labels": map[string]string{
					"component": "api",
					"team":      "backend",
				},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.BulkUpdateAlertRulesResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Rules).To(HaveLen(2))

			updatedRule1 := monitoringv1.Rule{
				Alert: "user-alert-1",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity":  "warning",
					"component": "api",
					"team":      "backend",
				},
			}
			expectedNewId1 := alertrule.GetAlertingRuleId(&updatedRule1)

			updatedRule2 := monitoringv1.Rule{
				Alert: "user-alert-2",
				Expr:  intstr.FromString("cpu > 80"),
				Labels: map[string]string{
					"severity":  "info",
					"component": "api",
					"team":      "backend",
				},
			}
			expectedNewId2 := alertrule.GetAlertingRuleId(&updatedRule2)

			Expect(resp.Rules[0].Id).To(Equal(expectedNewId1))
			Expect(resp.Rules[0].Id).NotTo(Equal(userRule1Id))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Rules[1].Id).To(Equal(expectedNewId2))
			Expect(resp.Rules[1].Id).NotTo(Equal(userRule2Id))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusNoContent))
		})

		It("should drop labels with empty string value", func() {
			mockRelabeledRules.GetFunc = func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
				if id == userRule1Id {
					return monitoringv1.Rule{
						Alert: "user-alert-1",
						Expr:  intstr.FromString("up == 0"),
						Labels: map[string]string{
							"severity":                       "warning",
							"team":                           "backend",
							k8s.PrometheusRuleLabelNamespace: "default",
							k8s.PrometheusRuleLabelName:      "user-pr",
						},
					}, true
				}
				return monitoringv1.Rule{}, false
			}

			mgmt := management.New(context.Background(), mockK8s)
			router = managementrouter.New(mgmt)

			body := map[string]interface{}{
				"ruleIds": []string{userRule1Id},
				"labels": map[string]string{
					"team":     "",
					"severity": "critical",
				},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.BulkUpdateAlertRulesResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Rules).To(HaveLen(1))

			updatedRule := monitoringv1.Rule{
				Alert: "user-alert-1",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "critical",
				},
			}
			expectedNewId := alertrule.GetAlertingRuleId(&updatedRule)

			Expect(resp.Rules[0].Id).To(Equal(expectedNewId))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))
		})
	})

	Context("when updating mixed platform and user-defined rules", func() {
		It("should handle both types correctly - platform keeps same ID, user gets new ID", func() {
			mockARC := &testutils.MockAlertRelabelConfigInterface{}
			mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
				return mockARC
			}

			body := map[string]interface{}{
				"ruleIds": []string{userRule1Id, platformRuleId},
				"labels": map[string]string{
					"component": "api",
				},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.BulkUpdateAlertRulesResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Rules).To(HaveLen(2))

			updatedUserRule := monitoringv1.Rule{
				Alert: "user-alert-1",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity":  "warning",
					"component": "api",
				},
			}
			expectedNewUserId := alertrule.GetAlertingRuleId(&updatedUserRule)
			Expect(resp.Rules[0].Id).To(Equal(expectedNewUserId))
			Expect(resp.Rules[0].Id).NotTo(Equal(userRule1Id))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))

			Expect(resp.Rules[1].Id).To(Equal(platformRuleId))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusNoContent))
		})
	})

	Context("when request body is invalid", func() {
		It("should return 400", func() {
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewBufferString("{"))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("invalid request body"))
		})
	})

	Context("when ruleIds is empty", func() {
		It("should return 400", func() {
			body := map[string]interface{}{
				"ruleIds": []string{},
				"labels":  map[string]string{"component": "api"},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("ruleIds is required"))
		})
	})

	Context("when both labels and AlertingRuleEnabled are missing", func() {
		It("should return 400", func() {
			body := map[string]interface{}{
				"ruleIds": []string{userRule1Id},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("AlertingRuleEnabled (toggle drop/restore) or labels (set/unset) is required"))
		})
	})

	Context("enabled toggle in bulk for platform/user/missing", func() {
		It("should drop platform, mark user as not allowed, and missing as not found", func() {
			mockARC := &testutils.MockAlertRelabelConfigInterface{}
			mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface { return mockARC }

			body := map[string]interface{}{
				"ruleIds":             []string{platformRuleId, userRule1Id, "missing-alert;hash"},
				"AlertingRuleEnabled": false,
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.BulkUpdateAlertRulesResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Rules).To(HaveLen(3))

			// Order corresponds to input order
			Expect(resp.Rules[0].Id).To(Equal(platformRuleId))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Rules[1].Id).To(Equal(userRule1Id))
			// user-defined alerts cannot be dropped/restored via enabled
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusMethodNotAllowed))
			Expect(resp.Rules[2].Id).To(Equal("missing-alert;hash"))
			Expect(resp.Rules[2].StatusCode).To(Equal(http.StatusNotFound))
		})
	})

	Context("when some rules are not found", func() {
		It("should return mixed results", func() {
			mockRelabeledRules.GetFunc = func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
				if id == userRule1Id {
					return monitoringv1.Rule{
						Alert: "user-alert-1",
						Expr:  intstr.FromString("up == 0"),
						Labels: map[string]string{
							"severity":                       "warning",
							k8s.PrometheusRuleLabelNamespace: "default",
							k8s.PrometheusRuleLabelName:      "user-pr",
						},
					}, true
				}
				return monitoringv1.Rule{}, false
			}

			mgmt := management.New(context.Background(), mockK8s)
			router = managementrouter.New(mgmt)

			body := map[string]interface{}{
				"ruleIds": []string{userRule1Id, "missing-alert;hash"},
				"labels":  map[string]string{"component": "api"},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.BulkUpdateAlertRulesResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Rules).To(HaveLen(2))

			updatedRule := monitoringv1.Rule{
				Alert: "user-alert-1",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity":  "warning",
					"component": "api",
				},
			}
			expectedNewId := alertrule.GetAlertingRuleId(&updatedRule)

			Expect(resp.Rules[0].Id).To(Equal(expectedNewId))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Rules[1].Id).To(Equal("missing-alert;hash"))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusNotFound))
		})
	})

	Context("when ruleId is invalid", func() {
		It("should return 400 for invalid ruleId", func() {
			body := map[string]interface{}{
				"ruleIds": []string{userRule1Id, ""},
				"labels":  map[string]string{"component": "api"},
			}
			buf, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			var resp managementrouter.BulkUpdateAlertRulesResponse
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Rules).To(HaveLen(2))

			updatedRule := monitoringv1.Rule{
				Alert: "user-alert-1",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity":  "warning",
					"component": "api",
				},
			}
			expectedNewId := alertrule.GetAlertingRuleId(&updatedRule)

			Expect(resp.Rules[0].Id).To(Equal(expectedNewId))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Rules[1].Id).To(Equal(""))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusBadRequest))
			Expect(resp.Rules[1].Message).To(ContainSubstring("missing ruleId"))
		})
	})
})
