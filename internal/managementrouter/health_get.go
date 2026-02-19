package managementrouter

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type GetHealthResponse struct {
	Alerting *k8s.AlertingHealth `json:"alerting,omitempty"`
}

func (hr *httpRouter) GetHealth(w http.ResponseWriter, r *http.Request) {
	resp := GetHealthResponse{}

	if hr.managementClient != nil {
		health, err := hr.managementClient.GetAlertingHealth(r.Context())
		if err != nil {
			handleError(w, err)
			return
		}
		resp.Alerting = &health
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("failed to encode health response: %v", err)
	}
}
