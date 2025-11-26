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
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
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

		mockManagement = management.NewWithCustomMapper(context.Background(), mockK8s, &testutils.MockMapperClient{})
		router = managementrouter.New(mockManagement)
	})

	Context("when getting all alerts without filters", func() {
		It("should return all active alerts", func() {
			By("setting up test alerts")
			testAlerts := []k8s.PrometheusAlert{
				{
					Labels: map[string]string{
						"alertname": "HighCPUUsage",
						"severity":  "warning",
						"namespace": "default",
					},
					Annotations: map[string]string{
						"description": "CPU usage is high",
					},
					State:    "firing",
					ActiveAt: time.Now(),
				},
				{
					Labels: map[string]string{
						"alertname": "LowMemory",
						"severity":  "critical",
						"namespace": "monitoring",
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
			Expect(response.Data.Alerts[0].Labels["alertname"]).To(Equal("HighCPUUsage"))
			Expect(response.Data.Alerts[1].Labels["alertname"]).To(Equal("LowMemory"))
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

})
