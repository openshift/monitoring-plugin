package managementrouter

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func (hr *httpRouter) BulkUpdateAlertRules(w http.ResponseWriter, req *http.Request) {
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	body, err := io.ReadAll(req.Body)
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
		return
	}

	// BulkUpdateAlertRulesRequest.Classification is typed as
	// *AlertRuleClassificationPatch (via x-go-type in the spec), so the
	// three-state omitted/null/string semantics are preserved on decode.
	var payload BulkUpdateAlertRulesRequest
	if err := json.Unmarshal(body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if len(payload.RuleIds) == 0 {
		writeError(w, http.StatusBadRequest, "ruleIds is required")
		return
	}
	if len(payload.RuleIds) > maxBulkUpdateRuleIds {
		writeError(w, http.StatusBadRequest, "ruleIds exceeds maximum of 100")
		return
	}

	fields := alertRuleUpdateFields{
		Labels:              payload.Labels,
		AlertingRuleEnabled: payload.AlertingRuleEnabled,
		Classification:      payload.Classification,
	}
	if msg := validateAlertRuleUpdateFields(fields); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	results := make([]UpdateAlertRuleResult, 0, len(payload.RuleIds))

	for _, rawId := range payload.RuleIds {
		id := strings.TrimSpace(rawId)
		if id == "" {
			msg := "ruleId is empty or whitespace-only"
			results = append(results, UpdateAlertRuleResult{
				Id:         rawId,
				StatusCode: int32(http.StatusBadRequest),
				Message:    &msg,
			})
			continue
		}

		newID, err := hr.applyAlertRuleUpdate(req.Context(), id, fields)
		if err != nil {
			status, message := parseError(err)
			results = append(results, UpdateAlertRuleResult{
				Id:         id,
				StatusCode: int32(status),
				Message:    &message,
			})
			continue
		}
		results = append(results, UpdateAlertRuleResult{
			Id:         newID,
			StatusCode: int32(http.StatusNoContent),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(BulkUpdateAlertRulesResponse{Rules: results}); err != nil {
		log.WithError(err).Warn("failed to encode bulk update response")
	}
}
