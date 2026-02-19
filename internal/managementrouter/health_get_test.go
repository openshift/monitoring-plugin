package managementrouter_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
)

var _ = Describe("GetHealth", func() {
	var (
		router         http.Handler
		mockManagement *healthStubManagementClient
	)

	BeforeEach(func() {
		By("setting up the HTTP router")
		mockManagement = &healthStubManagementClient{
			alertingHealth: func(ctx context.Context) (k8s.AlertingHealth, error) {
				return k8s.AlertingHealth{
					Platform: &k8s.AlertingStackHealth{
						Prometheus: k8s.AlertingRouteHealth{
							Name:      "prometheus-k8s",
							Namespace: "openshift-monitoring",
							Status:    k8s.RouteReachable,
						},
						Alertmanager: k8s.AlertingRouteHealth{
							Name:      "alertmanager-main",
							Namespace: "openshift-monitoring",
							Status:    k8s.RouteReachable,
						},
					},
					UserWorkloadEnabled: true,
					UserWorkload: &k8s.AlertingStackHealth{
						Prometheus: k8s.AlertingRouteHealth{
							Name:      "prometheus-user-workload",
							Namespace: "openshift-user-workload-monitoring",
							Status:    k8s.RouteReachable,
						},
						Alertmanager: k8s.AlertingRouteHealth{
							Name:      "alertmanager-user-workload",
							Namespace: "openshift-user-workload-monitoring",
							Status:    k8s.RouteReachable,
						},
					},
				}, nil
			},
		}
		router = managementrouter.New(mockManagement)
	})

	Context("when calling the health endpoint", func() {
		It("should return 200 OK status code", func() {
			By("making the request")
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/health", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			By("verifying the status code")
			Expect(w.Code).To(Equal(http.StatusOK))
		})

		It("should return correct JSON structure with alerting data", func() {
			By("making the request")
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/health", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			By("verifying the response body")
			var response managementrouter.GetHealthResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Alerting).NotTo(BeNil())
		})
	})

	Context("when GetAlertingHealth returns an error", func() {
		BeforeEach(func() {
			mockManagement.alertingHealth = func(ctx context.Context) (k8s.AlertingHealth, error) {
				return k8s.AlertingHealth{}, fmt.Errorf("connection refused")
			}
		})

		It("should return 500 via handleError", func() {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/health", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusInternalServerError))

			var errResp map[string]string
			err := json.NewDecoder(w.Body).Decode(&errResp)
			Expect(err).NotTo(HaveOccurred())
			Expect(errResp["error"]).To(ContainSubstring("connection refused"))
		})
	})
})

type healthStubManagementClient struct {
	alertingHealth func(ctx context.Context) (k8s.AlertingHealth, error)
}

func (s *healthStubManagementClient) ListRules(ctx context.Context, prOptions management.PrometheusRuleOptions, arOptions management.AlertRuleOptions) ([]monitoringv1.Rule, error) {
	return nil, nil
}

func (s *healthStubManagementClient) GetRuleById(ctx context.Context, alertRuleId string) (monitoringv1.Rule, error) {
	return monitoringv1.Rule{}, nil
}

func (s *healthStubManagementClient) CreateUserDefinedAlertRule(ctx context.Context, alertRule monitoringv1.Rule, prOptions management.PrometheusRuleOptions) (string, error) {
	return "", nil
}

func (s *healthStubManagementClient) CreatePlatformAlertRule(ctx context.Context, alertRule monitoringv1.Rule) (string, error) {
	return "", nil
}

func (s *healthStubManagementClient) UpdateUserDefinedAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) (string, error) {
	return "", nil
}

func (s *healthStubManagementClient) DeleteUserDefinedAlertRuleById(ctx context.Context, alertRuleId string) error {
	return nil
}

func (s *healthStubManagementClient) UpdatePlatformAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) error {
	return nil
}

func (s *healthStubManagementClient) DropPlatformAlertRule(ctx context.Context, alertRuleId string) error {
	return nil
}

func (s *healthStubManagementClient) RestorePlatformAlertRule(ctx context.Context, alertRuleId string) error {
	return nil
}

func (s *healthStubManagementClient) GetAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
	return nil, nil
}

func (s *healthStubManagementClient) GetRules(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
	return []k8s.PrometheusRuleGroup{}, nil
}

func (s *healthStubManagementClient) GetAlertingHealth(ctx context.Context) (k8s.AlertingHealth, error) {
	if s.alertingHealth != nil {
		return s.alertingHealth(ctx)
	}
	return k8s.AlertingHealth{}, nil
}

func (s *healthStubManagementClient) UpdateAlertRuleClassification(ctx context.Context, req management.UpdateRuleClassificationRequest) error {
	return nil
}

func (s *healthStubManagementClient) BulkUpdateAlertRuleClassification(ctx context.Context, items []management.UpdateRuleClassificationRequest) []error {
	return nil
}
