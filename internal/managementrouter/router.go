package managementrouter

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

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

	r.HandleFunc("/api/v1/alerting/rules", httpRouter.CreateAlertRule).Methods(http.MethodPost)

	return r
}

func writeError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	resp, _ := json.Marshal(map[string]string{"error": message})
	_, _ = w.Write(resp)
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
	var ve *management.ValidationError
	if errors.As(err, &ve) {
		return http.StatusBadRequest, err.Error()
	}
	var na *management.NotAllowedError
	if errors.As(err, &na) {
		return http.StatusMethodNotAllowed, err.Error()
	}
	var ce *management.ConflictError
	if errors.As(err, &ce) {
		return http.StatusConflict, err.Error()
	}
	log.Printf("An unexpected error occurred: %v", err)
	return http.StatusInternalServerError, "An unexpected error occurred"
}
