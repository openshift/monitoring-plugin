package managementrouter

import (
	"encoding/json"
	"net/http"
)

type BulkDeleteUserDefinedAlertRulesRequest struct {
	RuleIds []string `json:"ruleIds"`
}

type BulkDeleteUserDefinedAlertRulesResponse struct {
	Rules []DeleteUserDefinedAlertRulesResponse `json:"rules"`
}

func (hr *httpRouter) BulkDeleteUserDefinedAlertRules(w http.ResponseWriter, req *http.Request) {
	var payload BulkDeleteUserDefinedAlertRulesRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(payload.RuleIds) == 0 {
		writeError(w, http.StatusBadRequest, "ruleIds is required")
		return
	}

	results := make([]DeleteUserDefinedAlertRulesResponse, 0, len(payload.RuleIds))

	for _, rawId := range payload.RuleIds {
		id, err := parseParam(rawId, "ruleId")
		if err != nil {
			results = append(results, DeleteUserDefinedAlertRulesResponse{
				Id:         rawId,
				StatusCode: http.StatusBadRequest,
				Message:    err.Error(),
			})
			continue
		}

		if err := hr.managementClient.DeleteUserDefinedAlertRuleById(req.Context(), id); err != nil {
			status, message := parseError(err)
			results = append(results, DeleteUserDefinedAlertRulesResponse{
				Id:         id,
				StatusCode: status,
				Message:    message,
			})
			continue
		}
		results = append(results, DeleteUserDefinedAlertRulesResponse{
			Id:         id,
			StatusCode: http.StatusNoContent,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(BulkDeleteUserDefinedAlertRulesResponse{
		Rules: results,
	})
}
