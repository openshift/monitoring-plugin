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
	Labels              map[string]*string            `json:"labels,omitempty"`
	AlertingRuleEnabled *bool                         `json:"AlertingRuleEnabled,omitempty"`
	Classification      *AlertRuleClassificationPatch `json:"classification,omitempty"`
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

	if payload.AlertingRuleEnabled == nil && payload.Labels == nil && payload.Classification == nil {
		writeError(w, http.StatusBadRequest, "AlertingRuleEnabled (toggle drop/restore) or labels (set/unset) or classification is required")
		return
	}
	var haveToggle bool
	var enabled bool
	if payload.AlertingRuleEnabled != nil {
		enabled = *payload.AlertingRuleEnabled
		haveToggle = true
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

		// Handle enabled drop/restore first if requested
		notAllowedEnabled := false
		if haveToggle {
			var derr error
			if !enabled {
				derr = hr.managementClient.DropPlatformAlertRule(req.Context(), id)
			} else {
				derr = hr.managementClient.RestorePlatformAlertRule(req.Context(), id)
			}
			if derr != nil {
				// If NotAllowed (likely user-defined), we still allow label updates.
				var na *management.NotAllowedError
				if errors.As(derr, &na) {
					notAllowedEnabled = true
				} else {
					status, message := parseError(derr)
					results = append(results, UpdateAlertRuleResponse{
						Id:         id,
						StatusCode: status,
						Message:    message,
					})
					continue
				}
			}
		}

		if payload.Classification != nil {
			update := management.UpdateRuleClassificationRequest{RuleId: id}
			if payload.Classification.ComponentSet {
				update.Component = payload.Classification.Component
				update.ComponentSet = true
			}
			if payload.Classification.LayerSet {
				update.Layer = payload.Classification.Layer
				update.LayerSet = true
			}
			if payload.Classification.ComponentFromSet {
				update.ComponentFrom = payload.Classification.ComponentFrom
				update.ComponentFromSet = true
			}
			if payload.Classification.LayerFromSet {
				update.LayerFrom = payload.Classification.LayerFrom
				update.LayerFromSet = true
			}

			if update.ComponentSet || update.LayerSet || update.ComponentFromSet || update.LayerFromSet {
				if err := hr.managementClient.UpdateAlertRuleClassification(req.Context(), update); err != nil {
					status, message := parseError(err)
					results = append(results, UpdateAlertRuleResponse{
						Id:         id,
						StatusCode: status,
						Message:    message,
					})
					continue
				}
			}
		}

		if payload.Labels != nil {
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
				if pv == nil || *pv == "" {
					intentLabels[k] = ""
					delete(mergedLabels, k)
					continue
				}
				mergedLabels[k] = *pv
				intentLabels[k] = *pv
			}

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
		}

		// If only enabled was requested and it was NotAllowed, return 405 for this id.
		if notAllowedEnabled && payload.Labels == nil && payload.Classification == nil {
			results = append(results, UpdateAlertRuleResponse{
				Id:         id,
				StatusCode: http.StatusMethodNotAllowed,
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
