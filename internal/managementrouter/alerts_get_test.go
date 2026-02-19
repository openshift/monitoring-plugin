package managementrouter_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/prometheus/model/relabel"
	"k8s.io/apimachinery/pkg/util/intstr"
)

var _ = Describe("GetAlerts", func() {
	var (
		mockK8s              *testutils.MockClient
		mockPrometheusAlerts *testutils.MockPrometheusAlertsInterface
		mockManagement       management.Client
		router               http.Handler
	)

	BeforeEach(func() {
		By("setting up mock clients")
		mockPrometheusAlerts = &testutils.MockPrometheusAlertsInterface{}
		mockK8s = &testutils.MockClient{
			PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
				return mockPrometheusAlerts
			},
		}
		mockManagement = management.New(context.Background(), mockK8s)
		router = managementrouter.New(mockManagement)
	})

	Context("flat label parsing", func() {
		It("parses flat query params into Labels map and state", func() {
			var captured k8s.GetAlertsRequest
			mockPrometheusAlerts.GetAlertsFunc = func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
				captured = req
				return []k8s.PrometheusAlert{}, nil
			}

			By("making the request")
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts?namespace=ns1&severity=critical&state=firing&team=sre", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			By("verifying the response")
			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(captured.State).To(Equal("firing"))
			Expect(captured.Labels["namespace"]).To(Equal("ns1"))
			Expect(captured.Labels["severity"]).To(Equal("critical"))
			Expect(captured.Labels["team"]).To(Equal("sre"))
		})
	})

	Context("when getting all alerts without filters", func() {
		It("should return all active alerts", func() {
			By("setting up test alerts")
			testAlerts := []k8s.PrometheusAlert{
				{
					Labels: map[string]string{
						managementlabels.AlertNameLabel: "HighCPUUsage",
						"severity":                      "warning",
						"namespace":                     "default",
					},
					Annotations: map[string]string{
						"description": "CPU usage is high",
					},
					State:    "firing",
					ActiveAt: time.Now(),
				},
				{
					Labels: map[string]string{
						managementlabels.AlertNameLabel: "LowMemory",
						"severity":                      "critical",
						"namespace":                     "monitoring",
					},
					Annotations: map[string]string{
						"description": "Memory is running low",
					},
					State:    "firing",
					ActiveAt: time.Now(),
				},
			}
			mockPrometheusAlerts.SetActiveAlerts(testAlerts)

			By("making the request")
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			By("verifying the response")
			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(w.Header().Get("Content-Type")).To(Equal("application/json"))

			var response managementrouter.GetAlertsResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Data.Alerts).To(HaveLen(2))
			Expect(response.Data.Alerts[0].Labels[managementlabels.AlertNameLabel]).To(Equal("HighCPUUsage"))
			Expect(response.Data.Alerts[1].Labels[managementlabels.AlertNameLabel]).To(Equal("LowMemory"))
		})

		It("returns warnings when user workload routes are missing", func() {
			mockK8s.AlertingHealthFunc = func(ctx context.Context) (k8s.AlertingHealth, error) {
				return k8s.AlertingHealth{
					UserWorkloadEnabled: true,
					UserWorkload: &k8s.AlertingStackHealth{
						Prometheus:   k8s.AlertingRouteHealth{Status: k8s.RouteNotFound},
						Alertmanager: k8s.AlertingRouteHealth{Status: k8s.RouteNotFound},
					},
				}, nil
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			var response managementrouter.GetAlertsResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Warnings).To(ContainElements(
				"user workload Prometheus route is missing",
				"user workload Alertmanager route is missing",
			))
		})

		It("suppresses warnings when fallbacks are healthy", func() {
			mockK8s.AlertingHealthFunc = func(ctx context.Context) (k8s.AlertingHealth, error) {
				return k8s.AlertingHealth{
					UserWorkloadEnabled: true,
					UserWorkload: &k8s.AlertingStackHealth{
						Prometheus: k8s.AlertingRouteHealth{
							Status:            k8s.RouteUnreachable,
							FallbackReachable: true,
						},
						Alertmanager: k8s.AlertingRouteHealth{
							Status:            k8s.RouteUnreachable,
							FallbackReachable: true,
						},
					},
				}, nil
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			var response managementrouter.GetAlertsResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Warnings).To(BeEmpty())
		})

		It("should return empty array when no alerts exist", func() {
			By("setting up empty alerts")
			mockPrometheusAlerts.SetActiveAlerts([]k8s.PrometheusAlert{})

			By("making the request")
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			By("verifying the response")
			Expect(w.Code).To(Equal(http.StatusOK))

			var response managementrouter.GetAlertsResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Data.Alerts).To(BeEmpty())
		})
	})

	Context("when handling errors", func() {
		It("should return 500 when GetAlerts fails", func() {
			By("configuring mock to return error")
			mockPrometheusAlerts.GetAlertsFunc = func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
				return nil, fmt.Errorf("connection error")
			}

			By("making the request")
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			By("verifying error response")
			Expect(w.Code).To(Equal(http.StatusInternalServerError))
			Expect(w.Body.String()).To(ContainSubstring("An unexpected error occurred"))
		})
	})

	Context("bearer token forwarding", func() {
		It("forwards the Authorization bearer token to the management client via context", func() {
			var capturedCtx context.Context
			mockPrometheusAlerts.GetAlertsFunc = func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
				capturedCtx = ctx
				return []k8s.PrometheusAlert{}, nil
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			req.Header.Set("Authorization", "Bearer test-token-abc123")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			token := k8s.BearerTokenFromContext(capturedCtx)
			Expect(token).To(Equal("test-token-abc123"))
		})

		It("handles missing Authorization header gracefully", func() {
			var capturedCtx context.Context
			mockPrometheusAlerts.GetAlertsFunc = func(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
				capturedCtx = ctx
				return []k8s.PrometheusAlert{}, nil
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			token := k8s.BearerTokenFromContext(capturedCtx)
			Expect(token).To(BeEmpty())
		})
	})

	Context("alert enrichment from relabeled rules cache", func() {
		It("enriches alerts with alertRuleId, prometheusRule metadata, and alertingRule name", func() {
			baseRule := monitoringv1.Rule{
				Alert: "HighCPU",
				Expr:  intstr.FromString("node_cpu > 0.9"),
				Labels: map[string]string{
					"severity": "critical",
				},
			}
			ruleId := alertrule.GetAlertingRuleId(&baseRule)

			relabeledRule := monitoringv1.Rule{
				Alert: "HighCPU",
				Expr:  intstr.FromString("node_cpu > 0.9"),
				Labels: map[string]string{
					managementlabels.AlertNameLabel:        "HighCPU",
					"severity":                             "critical",
					k8s.AlertRuleLabelId:                   ruleId,
					k8s.PrometheusRuleLabelNamespace:       "openshift-monitoring",
					k8s.PrometheusRuleLabelName:            "cluster-cpu-rules",
					managementlabels.AlertingRuleLabelName: "my-alerting-rule",
				},
			}

			mockRelabeled := &testutils.MockRelabeledRulesInterface{
				ListFunc: func(ctx context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{relabeledRule}
				},
				GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
					if id == ruleId {
						return relabeledRule, true
					}
					return monitoringv1.Rule{}, false
				},
				ConfigFunc: func() []*relabel.Config {
					return []*relabel.Config{}
				},
			}

			mockNamespace := &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool {
					return name == "openshift-monitoring"
				},
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface { return mockRelabeled }
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface { return mockNamespace }
			mockManagement = management.New(context.Background(), mockK8s)
			router = managementrouter.New(mockManagement)

			testAlerts := []k8s.PrometheusAlert{
				{
					Labels: map[string]string{
						managementlabels.AlertNameLabel: "HighCPU",
						"severity":                      "critical",
						k8s.AlertSourceLabel:            k8s.AlertSourcePlatform,
						k8s.AlertBackendLabel:           "alertmanager",
					},
					Annotations: map[string]string{"summary": "CPU is high"},
					State:       "firing",
					ActiveAt:    time.Now(),
				},
			}
			mockPrometheusAlerts.SetActiveAlerts(testAlerts)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))

			var response managementrouter.GetAlertsResponse
			Expect(json.NewDecoder(w.Body).Decode(&response)).To(Succeed())
			Expect(response.Data.Alerts).To(HaveLen(1))

			alert := response.Data.Alerts[0]
			Expect(alert.AlertRuleId).To(Equal(ruleId))
			Expect(alert.PrometheusRuleNamespace).To(Equal("openshift-monitoring"))
			Expect(alert.PrometheusRuleName).To(Equal("cluster-cpu-rules"))
			Expect(alert.AlertingRuleName).To(Equal("my-alerting-rule"))
			Expect(alert.AlertComponent).NotTo(BeEmpty())
			Expect(alert.AlertLayer).NotTo(BeEmpty())
		})

		It("enriches platform alert without alertingRule when PrometheusRule is not from AlertingRule CR", func() {
			baseRule := monitoringv1.Rule{
				Alert: "KubePodCrashLooping",
				Expr:  intstr.FromString("rate(kube_pod_restart_total[5m]) > 0"),
				Labels: map[string]string{
					"severity": "warning",
				},
			}
			ruleId := alertrule.GetAlertingRuleId(&baseRule)

			relabeledRule := monitoringv1.Rule{
				Alert: "KubePodCrashLooping",
				Expr:  intstr.FromString("rate(kube_pod_restart_total[5m]) > 0"),
				Labels: map[string]string{
					managementlabels.AlertNameLabel:  "KubePodCrashLooping",
					"severity":                       "warning",
					k8s.AlertRuleLabelId:             ruleId,
					k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
					k8s.PrometheusRuleLabelName:      "kube-state-metrics",
				},
			}

			mockRelabeled := &testutils.MockRelabeledRulesInterface{
				ListFunc: func(ctx context.Context) []monitoringv1.Rule {
					return []monitoringv1.Rule{relabeledRule}
				},
				GetFunc: func(ctx context.Context, id string) (monitoringv1.Rule, bool) {
					if id == ruleId {
						return relabeledRule, true
					}
					return monitoringv1.Rule{}, false
				},
				ConfigFunc: func() []*relabel.Config {
					return []*relabel.Config{}
				},
			}

			mockNamespace := &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool {
					return name == "openshift-monitoring"
				},
			}

			mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface { return mockRelabeled }
			mockK8s.NamespaceFunc = func() k8s.NamespaceInterface { return mockNamespace }
			mockManagement = management.New(context.Background(), mockK8s)
			router = managementrouter.New(mockManagement)

			testAlerts := []k8s.PrometheusAlert{
				{
					Labels: map[string]string{
						managementlabels.AlertNameLabel: "KubePodCrashLooping",
						"severity":                      "warning",
						k8s.AlertSourceLabel:            k8s.AlertSourcePlatform,
						k8s.AlertBackendLabel:           "alertmanager",
					},
					State:    "firing",
					ActiveAt: time.Now(),
				},
			}
			mockPrometheusAlerts.SetActiveAlerts(testAlerts)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))

			var response managementrouter.GetAlertsResponse
			Expect(json.NewDecoder(w.Body).Decode(&response)).To(Succeed())
			Expect(response.Data.Alerts).To(HaveLen(1))

			alert := response.Data.Alerts[0]
			Expect(alert.AlertRuleId).To(Equal(ruleId))
			Expect(alert.PrometheusRuleNamespace).To(Equal("openshift-monitoring"))
			Expect(alert.PrometheusRuleName).To(Equal("kube-state-metrics"))
			Expect(alert.AlertingRuleName).To(BeEmpty())
		})
	})
})
