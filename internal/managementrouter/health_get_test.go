package managementrouter_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
)

var _ = Describe("GetHealth", func() {
	var router http.Handler

	BeforeEach(func() {
		By("setting up the HTTP router")
		router = managementrouter.New(nil)
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

		It("should return correct JSON structure with status ok", func() {
			By("making the request")
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/health", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			By("verifying the response body")
			var response managementrouter.GetHealthResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Status).To(Equal("ok"))
		})
	})
})
