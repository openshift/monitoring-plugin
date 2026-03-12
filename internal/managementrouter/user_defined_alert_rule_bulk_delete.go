package managementrouter

import (
	"encoding/json"
	"net/http"
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

	results := make([]DeleteAlertRuleResult, 0, len(payload.RuleIds))

	for _, rawId := range payload.RuleIds {
		id, err := parseParam(rawId, "ruleId")
		if err != nil {
			msg := err.Error()
			results = append(results, DeleteAlertRuleResult{
				Id:         rawId,
				StatusCode: int32(http.StatusBadRequest),
				Message:    &msg,
			})
			continue
		}

		if err := hr.managementClient.DeleteUserDefinedAlertRuleById(req.Context(), id); err != nil {
			status, message := parseError(err)
			results = append(results, DeleteAlertRuleResult{
				Id:         id,
				StatusCode: int32(status),
				Message:    &message,
			})
			continue
		}
		results = append(results, DeleteAlertRuleResult{
			Id:         id,
			StatusCode: int32(http.StatusNoContent),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(BulkDeleteAlertRulesResponse{Rules: results}); err != nil {
		log.WithError(err).Warn("failed to encode bulk delete response")
	}
}
