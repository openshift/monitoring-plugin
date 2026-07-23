// Package managementrouter implements the management API HTTP handlers.
// The OpenAPI spec lives in api/openapi.yaml. Regenerate bindings with:
//
//go:generate go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen --config ../../api/oapi-codegen.yaml ../../api/openapi.yaml
package managementrouter

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
)

var log = logrus.WithField("module", "managementrouter")

// maxRequestBodyBytes limits incoming request bodies to 1 MB across all handlers.
const maxRequestBodyBytes = 1 << 20 // 1 MB

const maxBulkDeleteRuleIds = 100

type httpRouter struct {
	managementClient management.Client
}

// New creates the management API router. Routes are registered via the
// generated HandlerWithOptions so they stay in sync with the OpenAPI spec.
func New(managementClient management.Client) *mux.Router {
	hr := &httpRouter{managementClient: managementClient}

	r := mux.NewRouter()
	r.Use(authMiddleware)

	HandlerWithOptions(hr, GorillaServerOptions{
		BaseURL:    "/api/v1/alerting",
		BaseRouter: r,
	})

	return r
}

// authMiddleware extracts the user's bearer token forwarded by the OpenShift
// console bridge and stores it in the request context so downstream handlers
// can perform API calls on behalf of the user.
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		token := ""
		if len(auth) > 7 && auth[:7] == "Bearer " {
			token = auth[7:]
		}
		if token == "" {
			writeError(w, http.StatusUnauthorized, "missing authorization token")
			return
		}
		ctx := k8s.WithBearerToken(r.Context(), token)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// writeError sends a JSON {"error": message} response with the given status code.
func writeError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	resp, err := json.Marshal(map[string]string{"error": message})
	if err != nil {
		// json.Marshal on map[string]string never fails in practice.
		panic(err)
	}
	if _, err := w.Write(resp); err != nil {
		log.WithError(err).Warn("failed to write error response")
	}
}

// handleError maps err to an HTTP status via parseError and writes the response.
func handleError(w http.ResponseWriter, err error) {
	status, message := parseError(err)
	writeError(w, status, message)
}

// parseError inspects err and returns a (statusCode, userMessage) pair.
// Kubernetes auth errors are checked first to prevent information leakage;
// domain errors are then mapped to 4xx codes.
func parseError(err error) (int, string) {
	var (
		nf *management.NotFoundError
		ve *management.ValidationError
		na *management.NotAllowedError
		ce *management.ConflictError
	)

	switch {
	case apierrors.IsUnauthorized(err):
		return http.StatusUnauthorized, "authentication failed"
	case apierrors.IsForbidden(err):
		return http.StatusForbidden, "insufficient permissions"
	case errors.As(err, &nf):
		return http.StatusNotFound, err.Error()
	case errors.As(err, &ve):
		return http.StatusBadRequest, err.Error()
	case errors.As(err, &na):
		return http.StatusMethodNotAllowed, err.Error()
	case errors.As(err, &ce):
		return http.StatusConflict, err.Error()
	default:
		log.WithError(err).Error("unexpected management API error")
		return http.StatusInternalServerError, "An unexpected error occurred"
	}
}
