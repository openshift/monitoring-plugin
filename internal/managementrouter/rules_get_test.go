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

var _ = Describe("GetRules", func() {
	var (
		mockManagement *stubManagementClient
		router         http.Handler
	)

	BeforeEach(func() {
		mockManagement = &stubManagementClient{}
		router = managementrouter.New(mockManagement)
	})

	Context("flat label parsing", func() {
		It("parses flat query params into Labels map and state", func() {
			var captured k8s.GetRulesRequest
			mockManagement.getRules = func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
				captured = req
				return []k8s.PrometheusRuleGroup{}, nil
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/rules?namespace=ns1&severity=critical&state=firing&team=sre", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(captured.State).To(Equal("firing"))
			Expect(captured.Labels["namespace"]).To(Equal("ns1"))
			Expect(captured.Labels["severity"]).To(Equal("critical"))
			Expect(captured.Labels["team"]).To(Equal("sre"))
		})
	})

	Context("when getting rules without filters", func() {
		It("returns groups in response", func() {
			mockManagement.getRules = func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
				return []k8s.PrometheusRuleGroup{
					{
						Name: "group-a",
					},
				}, nil
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/rules", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(w.Header().Get("Content-Type")).To(Equal("application/json"))

			var response managementrouter.GetRulesResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Data.Groups).To(HaveLen(1))
			Expect(response.Data.Groups[0].Name).To(Equal("group-a"))
		})

		It("returns warnings when user workload Prometheus route is missing", func() {
			mockManagement.alertingHealth = func(ctx context.Context) (k8s.AlertingHealth, error) {
				return k8s.AlertingHealth{
					UserWorkloadEnabled: true,
					UserWorkload: &k8s.AlertingStackHealth{
						Prometheus: k8s.AlertingRouteHealth{Status: k8s.RouteNotFound},
					},
				}, nil
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/rules", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			var response managementrouter.GetRulesResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Warnings).To(ContainElement("user workload Prometheus route is missing"))
		})

		It("suppresses warnings when fallback is healthy", func() {
			mockManagement.alertingHealth = func(ctx context.Context) (k8s.AlertingHealth, error) {
				return k8s.AlertingHealth{
					UserWorkloadEnabled: true,
					UserWorkload: &k8s.AlertingStackHealth{
						Prometheus: k8s.AlertingRouteHealth{
							Status:            k8s.RouteUnreachable,
							FallbackReachable: true,
						},
					},
				}, nil
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/rules", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			var response managementrouter.GetRulesResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Warnings).To(BeEmpty())
		})
	})

	Context("when handling errors", func() {
		It("returns 500 when GetRules fails", func() {
			mockManagement.getRules = func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
				return nil, fmt.Errorf("connection error")
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/rules", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusInternalServerError))
			Expect(w.Body.String()).To(ContainSubstring("An unexpected error occurred"))
		})
	})
})

type stubManagementClient struct {
	getRules       func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error)
	alertingHealth func(ctx context.Context) (k8s.AlertingHealth, error)
}

func (s *stubManagementClient) ListRules(ctx context.Context, prOptions management.PrometheusRuleOptions, arOptions management.AlertRuleOptions) ([]monitoringv1.Rule, error) {
	return nil, nil
}

func (s *stubManagementClient) GetRuleById(ctx context.Context, alertRuleId string) (monitoringv1.Rule, error) {
	return monitoringv1.Rule{}, nil
}

func (s *stubManagementClient) CreateUserDefinedAlertRule(ctx context.Context, alertRule monitoringv1.Rule, prOptions management.PrometheusRuleOptions) (string, error) {
	return "", nil
}

func (s *stubManagementClient) CreatePlatformAlertRule(ctx context.Context, alertRule monitoringv1.Rule) (string, error) {
	return "", nil
}

func (s *stubManagementClient) UpdateUserDefinedAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) (string, error) {
	return "", nil
}

func (s *stubManagementClient) DeleteUserDefinedAlertRuleById(ctx context.Context, alertRuleId string) error {
	return nil
}

func (s *stubManagementClient) UpdatePlatformAlertRule(ctx context.Context, alertRuleId string, alertRule monitoringv1.Rule) error {
	return nil
}

func (s *stubManagementClient) DropPlatformAlertRule(ctx context.Context, alertRuleId string) error {
	return nil
}

func (s *stubManagementClient) RestorePlatformAlertRule(ctx context.Context, alertRuleId string) error {
	return nil
}

func (s *stubManagementClient) GetAlerts(ctx context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
	return nil, nil
}

func (s *stubManagementClient) GetRules(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
	if s.getRules != nil {
		return s.getRules(ctx, req)
	}
	return []k8s.PrometheusRuleGroup{}, nil
}

func (s *stubManagementClient) GetAlertingHealth(ctx context.Context) (k8s.AlertingHealth, error) {
	if s.alertingHealth != nil {
		return s.alertingHealth(ctx)
	}
	return k8s.AlertingHealth{}, nil
}

func (s *stubManagementClient) UpdateAlertRuleClassification(ctx context.Context, req management.UpdateRuleClassificationRequest) error {
	return nil
}

func (s *stubManagementClient) BulkUpdateAlertRuleClassification(ctx context.Context, items []management.UpdateRuleClassificationRequest) []error {
	return nil
}
