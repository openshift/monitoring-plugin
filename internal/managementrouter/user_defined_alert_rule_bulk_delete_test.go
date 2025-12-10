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

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("BulkDeleteUserDefinedAlertRules", func() {
	var (
		router       http.Handler
		mockK8sRules *testutils.MockPrometheusRuleInterface
		mockK8s      *testutils.MockClient
		mockMapper   *testutils.MockMapperClient
	)

	BeforeEach(func() {
		mockK8sRules = &testutils.MockPrometheusRuleInterface{}

		userPR := monitoringv1.PrometheusRule{}
		userPR.Name = "user-pr"
		userPR.Namespace = "default"
		userPR.Spec.Groups = []monitoringv1.RuleGroup{
			{
				Name:  "g1",
				Rules: []monitoringv1.Rule{{Alert: "u1"}, {Alert: "u2"}},
			},
		}

		platformPR := monitoringv1.PrometheusRule{}
		platformPR.Name = "platform-pr"
		platformPR.Namespace = "platform-namespace-1"
		platformPR.Spec.Groups = []monitoringv1.RuleGroup{
			{
				Name:  "pg1",
				Rules: []monitoringv1.Rule{{Alert: "platform1"}},
			},
		}

		mockK8sRules.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
			"default/user-pr":                  &userPR,
			"platform-namespace-1/platform-pr": &platformPR,
		})

		mockNSInformer := &testutils.MockNamespaceInformerInterface{}
		mockNSInformer.SetMonitoringNamespaces(map[string]bool{
			"platform-namespace-1": true,
			"platform-namespace-2": true,
		})
		mockK8s = &testutils.MockClient{
			PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
				return mockK8sRules
			},
			NamespaceInformerFunc: func() k8s.NamespaceInformerInterface {
				return mockNSInformer
			},
		}

		mockMapper = &testutils.MockMapperClient{
			GetAlertingRuleIdFunc: func(rule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(rule.Alert)
			},
			FindAlertRuleByIdFunc: func(alertRuleId mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				id := string(alertRuleId)
				pr := mapper.PrometheusRuleId{
					Namespace: "default",
					Name:      "user-pr",
				}
				if id == "platform1" {
					pr.Namespace = "platform-namespace-1"
					pr.Name = "platform-pr"
				}
				return &pr, nil
			},
		}

		mgmt := management.NewWithCustomMapper(context.Background(), mockK8s, mockMapper)
		router = managementrouter.New(mgmt)
	})

	Context("when deleting multiple rules", func() {
		It("returns deleted and failed for mixed ruleIds and updates rules", func() {
			body := map[string]interface{}{"ruleIds": []string{"u1", "platform1", ""}}
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
			Expect(resp.Rules[0].Id).To(Equal("u1"))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Rules[0].Message).To(BeEmpty())
			// platform1 -> not allowed
			Expect(resp.Rules[1].Id).To(Equal("platform1"))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusMethodNotAllowed))
			Expect(resp.Rules[1].Message).To(ContainSubstring("cannot delete alert rule from a platform-managed PrometheusRule"))
			// "" -> bad request (missing id)
			Expect(resp.Rules[2].Id).To(Equal(""))
			Expect(resp.Rules[2].StatusCode).To(Equal(http.StatusBadRequest))
			Expect(resp.Rules[2].Message).To(ContainSubstring("missing ruleId"))

			prUser, _, err := mockK8sRules.Get(context.Background(), "default", "user-pr")
			Expect(err).NotTo(HaveOccurred())
			userRuleNames := []string{}
			for _, g := range prUser.Spec.Groups {
				for _, r := range g.Rules {
					userRuleNames = append(userRuleNames, r.Alert)
				}
			}
			Expect(userRuleNames).NotTo(ContainElement("u1"))
			Expect(userRuleNames).To(ContainElement("u2"))

			prPlatform, _, err := mockK8sRules.Get(context.Background(), "platform-namespace-1", "platform-pr")
			Expect(err).NotTo(HaveOccurred())
			foundPlatform := false
			for _, g := range prPlatform.Spec.Groups {
				for _, r := range g.Rules {
					if r.Alert == "platform1" {
						foundPlatform = true
					}
				}
			}
			Expect(foundPlatform).To(BeTrue())
		})

		It("succeeds for user rule and fails for platform rule (mixed case)", func() {
			body := map[string]interface{}{"ruleIds": []string{"u1", "platform1"}}
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
			Expect(resp.Rules[0].Id).To(Equal("u1"))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Rules[1].Id).To(Equal("platform1"))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusMethodNotAllowed))
			Expect(resp.Rules[1].Message).To(ContainSubstring("cannot delete alert rule from a platform-managed PrometheusRule"))

			// Ensure only user rule was removed
			prUser, _, err := mockK8sRules.Get(context.Background(), "default", "user-pr")
			Expect(err).NotTo(HaveOccurred())
			userRuleNames := []string{}
			for _, g := range prUser.Spec.Groups {
				for _, r := range g.Rules {
					userRuleNames = append(userRuleNames, r.Alert)
				}
			}
			Expect(userRuleNames).NotTo(ContainElement("u1"))
			Expect(userRuleNames).To(ContainElement("u2"))

			// Platform rule remains intact
			prPlatform, _, err := mockK8sRules.Get(context.Background(), "platform-namespace-1", "platform-pr")
			Expect(err).NotTo(HaveOccurred())
			foundPlatform := false
			for _, g := range prPlatform.Spec.Groups {
				for _, r := range g.Rules {
					if r.Alert == "platform1" {
						foundPlatform = true
					}
				}
			}
			Expect(foundPlatform).To(BeTrue())
		})

		It("returns all deleted when all user ruleIds succeed", func() {
			body := map[string]interface{}{"ruleIds": []string{"u1", "u2"}}
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
			Expect(resp.Rules[0].Id).To(Equal("u1"))
			Expect(resp.Rules[0].StatusCode).To(Equal(http.StatusNoContent))
			Expect(resp.Rules[1].Id).To(Equal("u2"))
			Expect(resp.Rules[1].StatusCode).To(Equal(http.StatusNoContent))

			// User PrometheusRule should be deleted after removing the last rule
			_, found, err := mockK8sRules.Get(context.Background(), "default", "user-pr")
			Expect(err).NotTo(HaveOccurred())
			Expect(found).To(BeFalse())

			// Platform PrometheusRule remains present
			_, found, err = mockK8sRules.Get(context.Background(), "platform-namespace-1", "platform-pr")
			Expect(err).NotTo(HaveOccurred())
			Expect(found).To(BeTrue())
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
