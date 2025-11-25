package managementrouter

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

type httpRouter struct {
	managementClient management.Client
}

func New(managementClient management.Client) *mux.Router {
	httpRouter := &httpRouter{
		managementClient: managementClient,
	}

	r := mux.NewRouter()

	r.HandleFunc("/api/v1/alerting/health", httpRouter.GetHealth).Methods(http.MethodGet)
	r.HandleFunc("/api/v1/alerting/alerts", httpRouter.GetAlerts).Methods(http.MethodGet)
	r.HandleFunc("/api/v1/alerting/rules", httpRouter.BulkDeleteUserDefinedAlertRules).Methods(http.MethodDelete)
	r.HandleFunc("/api/v1/alerting/rules/{ruleId}", httpRouter.DeleteUserDefinedAlertRuleById).Methods(http.MethodDelete)

	return r
}

func writeError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_, _ = w.Write([]byte(`{"error":"` + message + `"}`))
}

func handleError(w http.ResponseWriter, err error) {
	status, message := parseError(err)
	writeError(w, status, message)
}

func parseError(err error) (int, string) {
	var nf *management.NotFoundError
	if errors.As(err, &nf) {
		return http.StatusNotFound, err.Error()
	}
	var na *management.NotAllowedError
	if errors.As(err, &na) {
		return http.StatusMethodNotAllowed, err.Error()
	}
	log.Printf("An unexpected error occurred: %v", err)
	return http.StatusInternalServerError, "An unexpected error occurred"
}

func parseParam(raw string, name string) (string, error) {
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		return "", fmt.Errorf("invalid %s encoding", name)
	}
	value := strings.TrimSpace(decoded)
	if value == "" {
		return "", fmt.Errorf("missing %s", name)
	}
	return value, nil
}

func getParam(r *http.Request, name string) (string, error) {
	vars := mux.Vars(r)
	raw := vars[name]
	return parseParam(raw, name)
}
