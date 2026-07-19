package managementrouter

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/openshift/monitoring-plugin/pkg/management"
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

	if payload.AlertingRuleEnabled == nil && payload.Labels == nil && payload.Classification == nil {
		writeError(w, http.StatusBadRequest, "one of alertingRuleEnabled (toggle drop/restore) or labels (set/unset) or classification is required")
		return
	}
	if payload.AlertingRuleEnabled != nil && (payload.Labels != nil || payload.Classification != nil) {
		writeError(w, http.StatusBadRequest, "alertingRuleEnabled cannot be combined with labels or classification in the same request")
		return
	}

	var haveToggle bool
	var enabled bool
	if payload.AlertingRuleEnabled != nil {
		enabled = *payload.AlertingRuleEnabled
		haveToggle = true
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

		if haveToggle {
			var err error
			if !enabled {
				err = hr.managementClient.DropAlertRule(req.Context(), id)
			} else {
				err = hr.managementClient.RestoreAlertRule(req.Context(), id)
			}
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
				Id:         id,
				StatusCode: int32(http.StatusNoContent),
			})
			continue
		}

		if payload.Classification != nil {
			cl := payload.Classification
			update := management.UpdateRuleClassificationRequest{RuleId: id}
			if cl.ComponentSet {
				update.Component = cl.Component
				update.ComponentSet = true
			}
			if cl.LayerSet {
				update.Layer = cl.Layer
				update.LayerSet = true
			}
			if cl.ComponentFromSet {
				update.ComponentFrom = cl.ComponentFrom
				update.ComponentFromSet = true
			}
			if cl.LayerFromSet {
				update.LayerFrom = cl.LayerFrom
				update.LayerFromSet = true
			}

			if update.ComponentSet || update.LayerSet || update.ComponentFromSet || update.LayerFromSet {
				if err := hr.managementClient.UpdateAlertRuleClassification(req.Context(), update); err != nil {
					status, message := parseError(err)
					results = append(results, UpdateAlertRuleResult{
						Id:         id,
						StatusCode: int32(status),
						Message:    &message,
					})
					continue
				}
			}
		}

		if payload.Labels != nil {
			newRuleId, err := hr.managementClient.UpdateAlertRuleLabels(req.Context(), id, *payload.Labels)
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
				Id:         newRuleId,
				StatusCode: int32(http.StatusNoContent),
			})
			continue
		}

		results = append(results, UpdateAlertRuleResult{
			Id:         id,
			StatusCode: int32(http.StatusNoContent),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(BulkUpdateAlertRulesResponse{Rules: results}); err != nil {
		log.WithError(err).Warn("failed to encode bulk update response")
	}
}
