package managementrouter

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

// alertRuleUpdateFields is the shared mutation payload for single and bulk
// update endpoints (everything except rule IDs).
type alertRuleUpdateFields struct {
	Labels              *map[string]*string
	AlertingRuleEnabled *bool
	Classification      *AlertRuleClassificationPatch
}

func validateAlertRuleUpdateFields(f alertRuleUpdateFields) string {
	if f.AlertingRuleEnabled == nil && f.Labels == nil && f.Classification == nil {
		return "one of alertingRuleEnabled (toggle drop/restore) or labels (set/unset) or classification is required"
	}
	if f.AlertingRuleEnabled != nil && (f.Labels != nil || f.Classification != nil) {
		return "alertingRuleEnabled cannot be combined with labels or classification in the same request"
	}
	return ""
}

// applyAlertRuleUpdate applies one update mutation. On success it returns the
// effective rule ID (which may change when labels are updated).
// Classification is applied before labels when both are set; those steps are
// not atomic (a later label failure leaves a successful classification applied).
func (hr *httpRouter) applyAlertRuleUpdate(ctx context.Context, id string, f alertRuleUpdateFields) (string, error) {
	if f.AlertingRuleEnabled != nil {
		if !*f.AlertingRuleEnabled {
			return id, hr.managementClient.DropAlertRule(ctx, id)
		}
		return id, hr.managementClient.RestoreAlertRule(ctx, id)
	}

	resultID := id

	if f.Classification != nil {
		cl := f.Classification
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
			if err := hr.managementClient.UpdateAlertRuleClassification(ctx, update); err != nil {
				return id, err
			}
		}
	}

	if f.Labels != nil {
		newRuleId, err := hr.managementClient.UpdateAlertRuleLabels(ctx, id, *f.Labels)
		if err != nil {
			return id, err
		}
		resultID = newRuleId
	}

	return resultID, nil
}

// UpdateAlertRule implements ServerInterface for PATCH /rules/{ruleId}.
func (hr *httpRouter) UpdateAlertRule(w http.ResponseWriter, req *http.Request, ruleId string) {
	id := strings.TrimSpace(ruleId)
	if id == "" {
		writeError(w, http.StatusBadRequest, "ruleId is required")
		return
	}

	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	body, err := io.ReadAll(req.Body)
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
		return
	}

	var payload UpdateAlertRuleRequest
	if err := json.Unmarshal(body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
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

	newID, err := hr.applyAlertRuleUpdate(req.Context(), id, fields)
	if err != nil {
		status, message := parseError(err)
		writeError(w, status, message)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(UpdateAlertRuleResult{
		Id:         newID,
		StatusCode: int32(http.StatusNoContent),
	}); err != nil {
		log.WithError(err).Warn("failed to encode update alert rule response")
	}
}
