package managementrouter

import (
	"encoding/json"
	"net/http"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type GetAlertsResponse struct {
	Data     GetAlertsResponseData `json:"data"`
	Warnings []string              `json:"warnings,omitempty"`
}

type GetAlertsResponseData struct {
	Alerts []k8s.PrometheusAlert `json:"alerts"`
}

func (hr *httpRouter) GetAlerts(w http.ResponseWriter, req *http.Request) {
	state, labels, _, err := parseStateLabelsAndMatchers(req.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := req.Context()

	alerts, warnings, err := hr.managementClient.EnrichAlerts(ctx, k8s.GetAlertsRequest{
		Labels: labels,
		State:  state,
	})
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(GetAlertsResponse{
		Data: GetAlertsResponseData{
			Alerts: alerts,
		},
		Warnings: warnings,
	}); err != nil {
		log.WithError(err).Warn("failed to encode alerts response")
	}
}
