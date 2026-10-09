package managementrouter

import (
	"net/http"
	"strings"
)

// DeleteAlertRule implements ServerInterface for DELETE /rules/{ruleId}.
func (hr *httpRouter) DeleteAlertRule(w http.ResponseWriter, req *http.Request, ruleId string) {
	id := strings.TrimSpace(ruleId)
	if id == "" {
		writeError(w, http.StatusBadRequest, "ruleId is required")
		return
	}

	if err := hr.managementClient.DeleteAlertRuleById(req.Context(), id); err != nil {
		status, message := parseError(err)
		writeError(w, status, message)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
