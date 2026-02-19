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
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("CreateAlertRule", func() {
	var (
		router       http.Handler
		mockK8sRules *testutils.MockPrometheusRuleInterface
		mockARules   *testutils.MockAlertingRuleInterface
		mockK8s      *testutils.MockClient
	)

	BeforeEach(func() {
		mockK8sRules = &testutils.MockPrometheusRuleInterface{}
		mockARules = &testutils.MockAlertingRuleInterface{}
		mockK8s = &testutils.MockClient{
			PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
				return mockK8sRules
			},
			AlertingRulesFunc: func() k8s.AlertingRuleInterface {
				return mockARules
			},
			NamespaceFunc: func() k8s.NamespaceInterface {
				return &testutils.MockNamespaceInterface{
					IsClusterMonitoringNamespaceFunc: func(name string) bool {
						return false
					},
				}
			},
		}
	})

	Context("create new user defined alert rule", func() {
		It("creates a new rule", func() {
			mgmt := management.New(context.Background(), mockK8s)
			router = managementrouter.New(mgmt)

			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert":       "cpuHigh",
					"expr":        "vector(1)",
					"for":         "5m",
					"labels":      map[string]string{"severity": "warning"},
					"annotations": map[string]string{"summary": "cpu high"},
				},
				"prometheusRule": map[string]interface{}{
					"prometheusRuleName":      "user-pr",
					"prometheusRuleNamespace": "default",
				},
			}
			buf, _ := json.Marshal(body)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/alerting/rules", bytes.NewReader(buf))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusCreated))
			var resp struct {
				Id string `json:"id"`
			}
			Expect(json.NewDecoder(w.Body).Decode(&resp)).To(Succeed())
			Expect(resp.Id).NotTo(BeEmpty())

			pr, found, err := mockK8sRules.Get(context.Background(), "default", "user-pr")
			Expect(err).NotTo(HaveOccurred())
			Expect(found).To(BeTrue())
			allAlerts := []string{}
			for _, g := range pr.Spec.Groups {
				for _, r := range g.Rules {
					allAlerts = append(allAlerts, r.Alert)
				}
			}
			Expect(allAlerts).To(ContainElement("cpuHigh"))
		})

		It("creates a new rule into a non-default group when groupName is provided", func() {
			mgmt := management.New(context.Background(), mockK8s)
			router = managementrouter.New(mgmt)

			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "cpuCustomGroup",
					"expr":  "vector(1)",
				},
				"prometheusRule": map[string]interface{}{
					"prometheusRuleName":      "user-pr",
					"prometheusRuleNamespace": "default",
					"groupName":               "custom-group",
				},
			}
			buf, _ := json.Marshal(body)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/alerting/rules", bytes.NewReader(buf))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusCreated))

			pr, found, err := mockK8sRules.Get(context.Background(), "default", "user-pr")
			Expect(err).NotTo(HaveOccurred())
			Expect(found).To(BeTrue())

			var grp *monitoringv1.RuleGroup
			for i := range pr.Spec.Groups {
				if pr.Spec.Groups[i].Name == "custom-group" {
					grp = &pr.Spec.Groups[i]
					break
				}
			}
			Expect(grp).NotTo(BeNil())
			alerts := []string{}
			for _, r := range grp.Rules {
				alerts = append(alerts, r.Alert)
			}
			Expect(alerts).To(ContainElement("cpuCustomGroup"))
		})
	})

	Context("invalid JSON body", func() {
		It("fails for invalid JSON", func() {
			mgmt := management.New(context.Background(), mockK8s)
			router = managementrouter.New(mgmt)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/alerting/rules", bytes.NewBufferString("{"))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("invalid request body"))
		})
	})

	Context("missing target PrometheusRule (name/namespace)", func() {
		It("fails for missing target PR", func() {
			mgmt := management.New(context.Background(), mockK8s)
			router = managementrouter.New(mgmt)

			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "x",
					"expr":  "vector(1)",
				},
				"prometheusRule": map[string]interface{}{
					// missing PR name/namespace
				},
			}
			buf, _ := json.Marshal(body)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/alerting/rules", bytes.NewReader(buf))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("PrometheusRule Name and Namespace must be specified"))
		})
	})

	Context("target is platform-managed PR", func() {
		It("rejects with MethodNotAllowed", func() {
			mockNamespace := &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool {
					return name == "openshift-monitoring"
				},
			}
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
				return mockNamespace
			}
			mgmt := management.New(context.Background(), mockK8s)
			router = managementrouter.New(mgmt)

			body := map[string]interface{}{
				"alertingRule": map[string]interface{}{
					"alert": "x",
					"expr":  "vector(1)",
				},
				"prometheusRule": map[string]interface{}{
					"prometheusRuleName":      "platform-pr",
					"prometheusRuleNamespace": "openshift-monitoring",
				},
			}
			buf, _ := json.Marshal(body)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/alerting/rules", bytes.NewReader(buf))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusMethodNotAllowed))
			Expect(w.Body.String()).To(ContainSubstring("cannot add user-defined alert rule to a platform-managed PrometheusRule"))
		})
	})
})
