package managementrouter

import (
	"net/http"
)

type DeleteUserDefinedAlertRulesResponse struct {
	Id         string `json:"id"`
	StatusCode int    `json:"status_code"`
	Message    string `json:"message,omitempty"`
}

func (hr *httpRouter) DeleteUserDefinedAlertRuleById(w http.ResponseWriter, req *http.Request) {
	ruleId, err := getParam(req, "ruleId")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := hr.managementClient.DeleteUserDefinedAlertRuleById(req.Context(), ruleId); err != nil {
		handleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
