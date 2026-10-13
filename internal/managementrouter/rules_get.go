package managementrouter

import (
	"encoding/json"
	"net/http"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

// GetRules serves GET /api/v1/alerting/rules.
func (hr *httpRouter) GetRules(w http.ResponseWriter, req *http.Request) {
	state, labels, matchers, err := parseStateLabelsAndMatchers(req.URL.Query(), validRuleAlertStates)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := req.Context()

	groups, warnings, err := hr.managementClient.EnrichRules(ctx, k8s.GetRulesRequest{
		Labels:   labels,
		Matchers: matchers,
		State:    state,
	})
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	resp := GetRulesResponse{
		Data: GetRulesResponseData{
			Groups: groups,
		},
	}
	if len(warnings) > 0 {
		resp.Warnings = &warnings
	}
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.WithError(err).Warn("failed to encode rules response")
	}
}
