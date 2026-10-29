package managementrouter

import (
	"encoding/json"
	"net/http"
	"strings"
)

// BulkDeleteUserDefinedAlertRules implements ServerInterface.
func (hr *httpRouter) BulkDeleteUserDefinedAlertRules(w http.ResponseWriter, req *http.Request) {
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	var payload BulkDeleteAlertRulesRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(payload.RuleIds) == 0 {
		writeError(w, http.StatusBadRequest, "ruleIds is required")
		return
	}
	if len(payload.RuleIds) > maxBulkDeleteRuleIds {
		writeError(w, http.StatusBadRequest, "ruleIds exceeds maximum of 100")
		return
	}

	results := make([]DeleteAlertRuleResult, 0, len(payload.RuleIds))

	for _, id := range payload.RuleIds {
		id = strings.TrimSpace(id)
		if id == "" {
			msg := "missing ruleId"
			results = append(results, DeleteAlertRuleResult{
				Id:         id,
				StatusCode: http.StatusBadRequest,
				Message:    &msg,
			})
			continue
		}

		if err := hr.managementClient.DeleteAlertRuleById(req.Context(), id); err != nil {
			status, message := parseError(err)
			results = append(results, DeleteAlertRuleResult{
				Id:         id,
				StatusCode: status,
				Message:    &message,
			})
			continue
		}
		results = append(results, DeleteAlertRuleResult{
			Id:         id,
			StatusCode: http.StatusNoContent,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(BulkDeleteAlertRulesResponse{Rules: results}); err != nil {
		log.WithError(err).Warn("failed to encode bulk delete response")
	}
}
