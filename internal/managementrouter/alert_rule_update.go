package managementrouter

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

type UpdateAlertRuleRequest struct {
	AlertingRule        *monitoringv1.Rule `json:"alertingRule,omitempty"`
	AlertingRuleEnabled *bool              `json:"AlertingRuleEnabled,omitempty"`
}

type UpdateAlertRuleResponse struct {
	Id         string `json:"id"`
	StatusCode int    `json:"status_code"`
	Message    string `json:"message,omitempty"`
}

func (hr *httpRouter) UpdateAlertRule(w http.ResponseWriter, req *http.Request) {
	ruleId, err := getParam(req, "ruleId")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var payload UpdateAlertRuleRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	alertingRuleEnabled := payload.AlertingRuleEnabled

	// Handle drop/restore for platform alerts
	if alertingRuleEnabled != nil {
		var derr error
		if !*alertingRuleEnabled {
			derr = hr.managementClient.DropPlatformAlertRule(req.Context(), ruleId)
		} else {
			derr = hr.managementClient.RestorePlatformAlertRule(req.Context(), ruleId)
		}
		if derr != nil {
			status, message := parseError(derr)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(UpdateAlertRuleResponse{
				Id:         ruleId,
				StatusCode: status,
				Message:    message,
			})
			return
		}
		if payload.AlertingRule == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(UpdateAlertRuleResponse{
				Id:         ruleId,
				StatusCode: http.StatusNoContent,
			})
			return
		}
	}

	if payload.AlertingRule == nil && alertingRuleEnabled == nil {
		writeError(w, http.StatusBadRequest, "either alertingRule (labels) or AlertingRuleEnabled (toggle drop/restore) is required")
		return
	}

	alertRule := *payload.AlertingRule

	err = hr.managementClient.UpdatePlatformAlertRule(req.Context(), ruleId, alertRule)
	if err != nil {
		var ve *management.ValidationError
		var nf *management.NotFoundError
		if errors.As(err, &ve) || errors.As(err, &nf) {
			status, message := parseError(err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(UpdateAlertRuleResponse{
				Id:         ruleId,
				StatusCode: status,
				Message:    message,
			})
			return
		}

		var na *management.NotAllowedError
		if errors.As(err, &na) && strings.Contains(na.Error(), "cannot update non-platform alert rule") {
			// Not a platform rule, try user-defined update
			newRuleId, err := hr.managementClient.UpdateUserDefinedAlertRule(req.Context(), ruleId, alertRule)
			if err != nil {
				status, message := parseError(err)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(UpdateAlertRuleResponse{
					Id:         ruleId,
					StatusCode: status,
					Message:    message,
				})
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(UpdateAlertRuleResponse{
				Id:         newRuleId,
				StatusCode: http.StatusNoContent,
			})
			return
		}

		status, message := parseError(err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(UpdateAlertRuleResponse{
			Id:         ruleId,
			StatusCode: status,
			Message:    message,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(UpdateAlertRuleResponse{
		Id:         ruleId,
		StatusCode: http.StatusNoContent,
	})
}
