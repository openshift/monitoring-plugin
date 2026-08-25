package managementrouter

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

// PreviewAlertRule implements ServerInterface.
func (hr *httpRouter) PreviewAlertRule(w http.ResponseWriter, req *http.Request) {
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	var payload PreviewAlertRuleRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ruleID := ""
	if payload.RuleId != nil {
		ruleID = strings.TrimSpace(*payload.RuleId)
	}

	var (
		plan *management.RuleChangePlan
		err  error
	)

	if ruleID == "" {
		if payload.AlertingRule == nil {
			writeError(w, http.StatusBadRequest, "alertingRule is required for create preview")
			return
		}
		alertRule := alertRuleSpecToMonitoringV1(*payload.AlertingRule)
		createReq := management.PreviewCreateRequest{AlertRule: alertRule}
		if payload.PrometheusRule != nil {
			opts := prometheusRuleTargetToOptions(*payload.PrometheusRule)
			createReq.PROptions = &opts
		}
		plan, err = hr.managementClient.PreviewAlertRuleCreate(req.Context(), createReq)
	} else {
		fields := alertRuleUpdateFields{
			Labels:              payload.Labels,
			AlertingRuleEnabled: payload.AlertingRuleEnabled,
			Classification:      payload.Classification,
		}
		if msg := validateAlertRuleUpdateFields(fields); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		updateReq := management.PreviewUpdateRequest{
			RuleID:              ruleID,
			AlertingRuleEnabled: payload.AlertingRuleEnabled,
		}
		if payload.Labels != nil {
			updateReq.Labels = *payload.Labels
		}
		if payload.Classification != nil {
			cl := payload.Classification
			updateReq.Classification = &management.UpdateRuleClassificationRequest{RuleId: ruleID}
			if cl.ComponentSet {
				updateReq.Classification.Component = cl.Component
				updateReq.Classification.ComponentSet = true
			}
			if cl.LayerSet {
				updateReq.Classification.Layer = cl.Layer
				updateReq.Classification.LayerSet = true
			}
			if cl.ComponentFromSet {
				updateReq.Classification.ComponentFrom = cl.ComponentFrom
				updateReq.Classification.ComponentFromSet = true
			}
			if cl.LayerFromSet {
				updateReq.Classification.LayerFrom = cl.LayerFrom
				updateReq.Classification.LayerFromSet = true
			}
		}
		plan, err = hr.managementClient.PreviewAlertRuleUpdate(req.Context(), updateReq)
	}

	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(ruleChangePlanToResponse(plan)); err != nil {
		log.WithError(err).Warn("failed to encode preview alert rule response")
	}
}

func ruleChangePlanToResponse(plan *management.RuleChangePlan) PreviewAlertRuleResponse {
	desiredRule := monitoringV1RuleToAlertRuleSpec(plan.DesiredRule)
	resp := PreviewAlertRuleResponse{
		Writable:    plan.Writable,
		Resources:   make([]PreviewResourceChange, 0, len(plan.Resources)),
		DesiredRule: desiredRule,
	}
	if plan.ManagedBy != nil {
		switch *plan.ManagedBy {
		case management.ManagedByGitOps:
			v := Gitops
			resp.ManagedBy = &v
		case management.ManagedByOperator:
			v := Operator
			resp.ManagedBy = &v
		}
	}
	for _, res := range plan.Resources {
		entry := PreviewResourceChange{
			Resource: PreviewTargetResource{
				ApiVersion: res.Resource.APIVersion,
				Kind:       res.Resource.Kind,
				Name:       res.Resource.Name,
			},
			Changes: make([]RuleChange, 0, len(res.Changes)),
		}
		if res.Resource.Namespace != "" {
			ns := res.Resource.Namespace
			entry.Resource.Namespace = &ns
		}
		if res.DesiredObject != nil {
			entry.DesiredObject = &res.DesiredObject
		}
		for _, ch := range res.Changes {
			rc := RuleChange{
				Field:     ch.Field,
				Operation: RuleChangeOperation(ch.Operation),
			}
			if ch.CurrentValue != nil {
				rc.CurrentValue = ch.CurrentValue
			}
			if ch.NewValue != nil {
				rc.NewValue = ch.NewValue
			}
			entry.Changes = append(entry.Changes, rc)
		}
		resp.Resources = append(resp.Resources, entry)
	}
	return resp
}
