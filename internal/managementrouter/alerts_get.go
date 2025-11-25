package managementrouter

import (
	"encoding/json"
	"net/http"

	"github.com/go-playground/form/v4"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type GetAlertsQueryParams struct {
	Labels map[string]string `form:"labels"`
	State  string            `form:"state"`
}

type GetAlertsResponse struct {
	Data   GetAlertsResponseData `json:"data"`
	Status string                `json:"status"`
}

type GetAlertsResponseData struct {
	Alerts []k8s.PrometheusAlert `json:"alerts"`
}

func (hr *httpRouter) GetAlerts(w http.ResponseWriter, req *http.Request) {
	var params GetAlertsQueryParams

	if err := form.NewDecoder().Decode(&params, req.URL.Query()); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid query parameters: "+err.Error())
		return
	}

	alerts, err := hr.managementClient.GetAlerts(req.Context(), k8s.GetAlertsRequest{
		Labels: params.Labels,
		State:  params.State,
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
