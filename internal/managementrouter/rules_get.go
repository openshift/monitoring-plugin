package managementrouter

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type GetRulesResponse struct {
	Data     GetRulesResponseData `json:"data"`
	Warnings []string             `json:"warnings,omitempty"`
}

type GetRulesResponseData struct {
	Groups []k8s.PrometheusRuleGroup `json:"groups"`
}

func (hr *httpRouter) GetRules(w http.ResponseWriter, req *http.Request) {
	state, labels, err := parseStateAndLabels(req.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := k8s.WithBearerToken(req.Context(), bearerTokenFromRequest(req))

	groups, err := hr.managementClient.GetRules(ctx, k8s.GetRulesRequest{
		Labels: labels,
		State:  state,
	})
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(GetRulesResponse{
		Data: GetRulesResponseData{
			Groups: groups,
		},
		Warnings: hr.rulesWarnings(ctx),
	}); err != nil {
		log.Printf("failed to encode rules response: %v", err)
	}
}
