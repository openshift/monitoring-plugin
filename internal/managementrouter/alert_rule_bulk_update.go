package managementrouter

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

// Note: router no longer filters provenance/identity labels here.
// Backend enforces ARC scoping and ignores/guards protected labels as needed.

type BulkUpdateAlertRulesRequest struct {
	RuleIds []string `json:"ruleIds"`
	// Use pointer values so we can distinguish null (delete) vs string value (set)
	Labels map[string]*string `json:"labels"`
}

type BulkUpdateAlertRulesResponse struct {
	Rules []UpdateAlertRuleResponse `json:"rules"`
}

func (hr *httpRouter) BulkUpdateAlertRules(w http.ResponseWriter, req *http.Request) {
	var payload BulkUpdateAlertRulesRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(payload.RuleIds) == 0 {
		writeError(w, http.StatusBadRequest, "ruleIds is required")
		return
	}

	if payload.Labels == nil {
		writeError(w, http.StatusBadRequest, "labels is required")
		return
	}

	results := make([]UpdateAlertRuleResponse, 0, len(payload.RuleIds))

	for _, rawId := range payload.RuleIds {
		id, err := parseParam(rawId, "ruleId")
		if err != nil {
			results = append(results, UpdateAlertRuleResponse{
				Id:         rawId,
				StatusCode: http.StatusBadRequest,
				Message:    err.Error(),
			})
			continue
		}

		// For bulk update, merge labels and handle empty strings as drops
		currentRule, err := hr.managementClient.GetRuleById(req.Context(), id)
		if err != nil {
			status, message := parseError(err)
			results = append(results, UpdateAlertRuleResponse{
				Id:         id,
				StatusCode: status,
				Message:    message,
			})
			continue
		}

		mergedLabels := make(map[string]string)
		intentLabels := make(map[string]string)
		for k, v := range currentRule.Labels {
			mergedLabels[k] = v
		}
		for k, pv := range payload.Labels {
			// K8s-aligned: null => delete; support empty string as delete for compatibility
			if pv == nil || *pv == "" {
				// keep intent for platform path as explicit delete
				intentLabels[k] = ""
				delete(mergedLabels, k)
				continue
			}
			mergedLabels[k] = *pv
			intentLabels[k] = *pv
		}

		// For platform flow, pass only the user-intent labels (avoid pinning merged fields)
		updatedPlatformRule := monitoringv1.Rule{Labels: intentLabels}

		err = hr.managementClient.UpdatePlatformAlertRule(req.Context(), id, updatedPlatformRule)
		if err != nil {
			var ve *management.ValidationError
			var nf *management.NotFoundError
			if errors.As(err, &ve) || errors.As(err, &nf) {
				status, message := parseError(err)
				results = append(results, UpdateAlertRuleResponse{
					Id:         id,
					StatusCode: status,
					Message:    message,
				})
				continue
			}

			var na *management.NotAllowedError
			if errors.As(err, &na) && strings.Contains(na.Error(), "cannot update non-platform alert rule") {
				// Not a platform rule, try user-defined
				// For user-defined, we apply the merged labels to the PR
				updatedUserRule := currentRule
				updatedUserRule.Labels = mergedLabels

				newRuleId, err := hr.managementClient.UpdateUserDefinedAlertRule(req.Context(), id, updatedUserRule)
				if err != nil {
					status, message := parseError(err)
					results = append(results, UpdateAlertRuleResponse{
						Id:         id,
						StatusCode: status,
						Message:    message,
					})
					continue
				}
				results = append(results, UpdateAlertRuleResponse{
					Id:         newRuleId,
					StatusCode: http.StatusNoContent,
				})
				continue
			}

			status, message := parseError(err)
			results = append(results, UpdateAlertRuleResponse{
				Id:         id,
				StatusCode: status,
				Message:    message,
			})
			continue
		}

		results = append(results, UpdateAlertRuleResponse{
			Id:         id,
			StatusCode: http.StatusNoContent,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(BulkUpdateAlertRulesResponse{
		Rules: results,
	})
}
