package managementrouter

import (
	"encoding/json"
	"net/http"
)

// GetHealth serves GET /api/v1/alerting/health.
func (hr *httpRouter) GetHealth(w http.ResponseWriter, req *http.Request) {
	resp := GetHealthResponse{}

	if hr.managementClient != nil {
		health, err := hr.managementClient.GetAlertingHealth(req.Context())
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
		log.WithError(err).Warn("failed to encode health response")
	}
}
