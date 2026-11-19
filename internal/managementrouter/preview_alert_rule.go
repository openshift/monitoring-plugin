package managementrouter

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

// PreviewAlertRuleCreate implements ServerInterface.
func (hr *httpRouter) PreviewAlertRuleCreate(w http.ResponseWriter, req *http.Request) {
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	body, err := io.ReadAll(req.Body)
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
		return
	}

	var payload PreviewAlertRuleCreateRequest
	if err := json.Unmarshal(body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	createReq := management.PreviewCreateRequest{
		AlertRule: alertRuleSpecToMonitoringV1(payload.AlertingRule),
	}
	if payload.PrometheusRule != nil {
		opts := prometheusRuleTargetToOptions(*payload.PrometheusRule)
		createReq.PROptions = &opts
	}

	plan, err := hr.managementClient.PreviewAlertRuleCreate(req.Context(), createReq)
	if err != nil {
		handleError(w, err)
		return
	}
	writePreviewPlan(w, plan)
}

// PreviewAlertRuleUpdate implements ServerInterface.
func (hr *httpRouter) PreviewAlertRuleUpdate(w http.ResponseWriter, req *http.Request) {
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	body, err := io.ReadAll(req.Body)
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
		return
	}

	var payload PreviewAlertRuleUpdateRequest
	if err := json.Unmarshal(body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ruleID := strings.TrimSpace(payload.RuleId)
	if ruleID == "" {
		writeError(w, http.StatusBadRequest, "ruleId is required for update preview")
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

	updateReq := management.PreviewUpdateRequest{
		RuleID:              ruleID,
		AlertingRuleEnabled: payload.AlertingRuleEnabled,
	}
	if payload.Labels != nil {
		updateReq.Labels = *payload.Labels
	}
	updateReq.Classification = classificationPatchToRequest(ruleID, payload.Classification)

	plan, err := hr.managementClient.PreviewAlertRuleUpdate(req.Context(), updateReq)
	if err != nil {
		handleError(w, err)
		return
	}
	writePreviewPlan(w, plan)
}

func writePreviewPlan(w http.ResponseWriter, plan *management.RuleChangePlan) {
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
