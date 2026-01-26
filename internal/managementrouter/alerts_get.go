package managementrouter

import (
	"encoding/json"
	"net/http"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type GetAlertsResponse struct {
	Data   GetAlertsResponseData `json:"data"`
	Status string                `json:"status"`
}

type GetAlertsResponseData struct {
	Alerts []k8s.PrometheusAlert `json:"alerts"`
}

func (hr *httpRouter) GetAlerts(w http.ResponseWriter, req *http.Request) {
	// Flat label filters: any key other than "state" is treated as a label match
	q := req.URL.Query()
	state := q.Get("state")
	labels := make(map[string]string)
	for key, vals := range q {
		if key == "state" {
			continue
		}
		if len(vals) > 0 && vals[0] != "" {
			labels[key] = vals[0]
		}
	}

	alerts, err := hr.managementClient.GetAlerts(req.Context(), k8s.GetAlertsRequest{
		Labels: labels,
		State:  state,
	})
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(GetAlertsResponse{
		Data: GetAlertsResponseData{
			Alerts: alerts,
		},
		Status: "success",
	})
}
