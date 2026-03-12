package managementrouter

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

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
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(payload.RuleIds) == 0 {
		writeError(w, http.StatusBadRequest, "ruleIds is required")
		return
	}

	if payload.AlertingRuleEnabled == nil && payload.Labels == nil && payload.Classification == nil {
		writeError(w, http.StatusBadRequest, "alertingRuleEnabled (toggle drop/restore) or labels (set/unset) or classification is required")
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
		id, err := parseParam(rawId, "ruleId")
		if err != nil {
			msg := err.Error()
			results = append(results, UpdateAlertRuleResult{
				Id:         rawId,
				StatusCode: int32(http.StatusBadRequest),
				Message:    &msg,
			})
			continue
		}

		notAllowedEnabled := false
		if haveToggle {
			var derr error
			if !enabled {
				derr = hr.managementClient.DropPlatformAlertRule(req.Context(), id)
			} else {
				derr = hr.managementClient.RestorePlatformAlertRule(req.Context(), id)
			}
			if derr != nil {
				var na *management.NotAllowedError
				if errors.As(derr, &na) {
					notAllowedEnabled = true
				} else {
					status, message := parseError(derr)
					results = append(results, UpdateAlertRuleResult{
						Id:         id,
						StatusCode: int32(status),
						Message:    &message,
					})
					continue
				}
			}
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
			currentRule, err := hr.managementClient.GetRuleById(req.Context(), id)
			if err != nil {
				status, message := parseError(err)
				results = append(results, UpdateAlertRuleResult{
					Id:         id,
					StatusCode: int32(status),
					Message:    &message,
				})
				continue
			}

			// platformLabels uses "" to signal "drop this label"; the management
			// layer's UpdatePlatformAlertRule interprets "" as a delete directive.
			// userLabels is the fully-merged map for user-defined rules where we
			// simply omit deleted keys rather than set them to "".
			platformLabels := make(map[string]string)
			userLabels := make(map[string]string)
			for k, v := range currentRule.Labels {
				userLabels[k] = v
			}
			for k, pv := range *payload.Labels {
				if pv == nil || *pv == "" {
					platformLabels[k] = ""
					delete(userLabels, k)
				} else {
					platformLabels[k] = *pv
					userLabels[k] = *pv
				}
			}

			updatedPlatformRule := monitoringv1.Rule{Labels: platformLabels}

			err = hr.managementClient.UpdatePlatformAlertRule(req.Context(), id, updatedPlatformRule)
			if err != nil {
				var ve *management.ValidationError
				var nf *management.NotFoundError
				if errors.As(err, &ve) || errors.As(err, &nf) {
					status, message := parseError(err)
					results = append(results, UpdateAlertRuleResult{
						Id:         id,
						StatusCode: int32(status),
						Message:    &message,
					})
					continue
				}

				var na *management.NotAllowedError
				if errors.As(err, &na) {
					updatedUserRule := currentRule
					updatedUserRule.Labels = userLabels

					newRuleId, err := hr.managementClient.UpdateUserDefinedAlertRule(req.Context(), id, updatedUserRule)
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

				status, message := parseError(err)
				results = append(results, UpdateAlertRuleResult{
					Id:         id,
					StatusCode: int32(status),
					Message:    &message,
				})
				continue
			}
		}

		if notAllowedEnabled && payload.Labels == nil && payload.Classification == nil {
			results = append(results, UpdateAlertRuleResult{
				Id:         id,
				StatusCode: int32(http.StatusMethodNotAllowed),
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
