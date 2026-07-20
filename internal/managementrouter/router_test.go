package managementrouter

import (
	"fmt"
	"net/http"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

func TestParseError(t *testing.T) {
	tests := []struct {
		name           string
		err            error
		expectedStatus int
		expectedMsg    string
	}{
		{
			name:           "NotFoundError",
			err:            &management.NotFoundError{Resource: "AlertRule", Id: "abc"},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "ValidationError",
			err:            &management.ValidationError{Message: "bad input"},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "NotAllowedError",
			err:            &management.NotAllowedError{Message: "not allowed"},
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "ConflictError",
			err:            &management.ConflictError{Message: "conflict"},
			expectedStatus: http.StatusConflict,
		},
		{
			name: "Kubernetes Forbidden",
			err: apierrors.NewForbidden(schema.GroupResource{
				Group: "monitoring.coreos.com", Resource: "prometheusrules",
			}, "test-pr", fmt.Errorf("access denied")),
			expectedStatus: http.StatusForbidden,
			expectedMsg:    "insufficient permissions",
		},
		{
			name: "Kubernetes Forbidden wrapped",
			err: fmt.Errorf("failed to get PrometheusRule: %w",
				apierrors.NewForbidden(schema.GroupResource{
					Group: "monitoring.coreos.com", Resource: "prometheusrules",
				}, "test-pr", fmt.Errorf("access denied"))),
			expectedStatus: http.StatusForbidden,
			expectedMsg:    "insufficient permissions",
		},
		{
			name:           "Kubernetes Unauthorized",
			err:            apierrors.NewUnauthorized("token expired"),
			expectedStatus: http.StatusUnauthorized,
			expectedMsg:    "authentication failed",
		},
		{
			name:           "unknown error",
			err:            fmt.Errorf("something unexpected"),
			expectedStatus: http.StatusInternalServerError,
			expectedMsg:    "An unexpected error occurred",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, msg := parseError(tt.err)
			if status != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, status)
			}
			if tt.expectedMsg != "" && msg != tt.expectedMsg {
				t.Errorf("expected message %q, got %q", tt.expectedMsg, msg)
			}
		})
	}
}
