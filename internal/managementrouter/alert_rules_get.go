package managementrouter

import (
	"encoding/json"
	"net/http"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

type GetAlertRulesResponse struct {
	Data   GetAlertRulesResponseData `json:"data"`
	Status string                    `json:"status"`
}

type GetAlertRulesResponseData struct {
	Rules []monitoringv1.Rule `json:"rules"`
}

// Query parameter keys used by management HTTP handlers (scoped to router)
const (
	queryPrometheusRuleNamespace = "namespace"
	queryPrometheusRuleName      = "prometheusRuleName"
	queryAlertRuleName           = "name"
	queryAlertRuleSource         = "source"
)

func (hr *httpRouter) GetAlertRules(w http.ResponseWriter, req *http.Request) {
	q := req.URL.Query()

	prOptions := management.PrometheusRuleOptions{
		Namespace: q.Get(queryPrometheusRuleNamespace),
		Name:      q.Get(queryPrometheusRuleName),
	}

	arOptions := management.AlertRuleOptions{
		Name:   q.Get(queryAlertRuleName),
		Source: q.Get(queryAlertRuleSource),
	}

	rules, err := hr.managementClient.ListRules(req.Context(), prOptions, arOptions)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(GetAlertRulesResponse{
		Data: GetAlertRulesResponseData{
			Rules: rules,
		},
		Status: "success",
	})
}
