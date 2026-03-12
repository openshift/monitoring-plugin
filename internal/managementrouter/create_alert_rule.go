package managementrouter

import (
	"encoding/json"
	"net/http"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

type CreateAlertRuleRequest struct {
	AlertingRule   *monitoringv1.Rule                `json:"alertingRule,omitempty"`
	PrometheusRule *management.PrometheusRuleOptions `json:"prometheusRule,omitempty"`
}

type CreateAlertRuleResponse struct {
	Id string `json:"id"`
}

func (hr *httpRouter) CreateAlertRule(w http.ResponseWriter, req *http.Request) {
	var payload CreateAlertRuleRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if payload.AlertingRule == nil {
		writeError(w, http.StatusBadRequest, "alertingRule is required")
		return
	}

	alertRule := *payload.AlertingRule

	var (
		id  string
		err error
	)

	if payload.PrometheusRule != nil {
		id, err = hr.managementClient.CreateUserDefinedAlertRule(req.Context(), alertRule, *payload.PrometheusRule)
	} else {
		id, err = hr.managementClient.CreatePlatformAlertRule(req.Context(), alertRule)
	}

	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(CreateAlertRuleResponse{Id: id})
}
