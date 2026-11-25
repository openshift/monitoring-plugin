package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	logtest "github.com/sirupsen/logrus/hooks/test"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

func TestListTempoResourcesHandlerDoesNotLeakAPIAddress(t *testing.T) {
	apiServer := httptest.NewServer(http.NotFoundHandler())
	apiURL, err := url.Parse(apiServer.URL)
	require.NoError(t, err)
	apiServer.Close()

	k8sclient, err := dynamic.NewForConfig(&rest.Config{Host: apiServer.URL})
	require.NoError(t, err)

	hook := logtest.NewGlobal()
	t.Cleanup(func() { logrus.StandardLogger().ReplaceHooks(make(logrus.LevelHooks)) })

	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	rec := httptest.NewRecorder()
	ListTempoResourcesHandler(k8sclient).ServeHTTP(rec, httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/v1/list-tempostacks", nil))

	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.JSONEq(t, `{"status":"error","error":"cannot list Tempo resources"}`, rec.Body.String())
	require.Len(t, hook.AllEntries(), 1)
	entry := hook.LastEntry()
	require.Equal(t, "connection_refused", entry.Data["error_kind"])
	line, err := entry.String()
	require.NoError(t, err)
	require.NotContains(t, line, apiURL.Host)
}

func TestReadStatusFromCR(t *testing.T) {
	tests := []struct {
		name            string
		status          map[string]interface{}
		expectedReady   bool
		expectedMessage string
	}{
		{
			name:          "no status (not reconciled yet)",
			status:        nil,
			expectedReady: false,
		},
		{
			name:          "no conditions",
			status:        map[string]interface{}{"conditions": []interface{}{}},
			expectedReady: false,
		},
		{
			name: "ready",
			status: map[string]interface{}{"conditions": []interface{}{
				map[string]interface{}{"type": "Pending", "status": "False", "message": "some components pending"},
				map[string]interface{}{"type": "Ready", "status": "True", "message": "all components are up"},
			}},
			expectedReady: true,
		},
		{
			name: "pending",
			status: map[string]interface{}{"conditions": []interface{}{
				map[string]interface{}{"type": "Ready", "status": "False", "message": "all components are up"},
				map[string]interface{}{"type": "Pending", "status": "True", "message": "some components pending"},
			}},
			expectedReady:   false,
			expectedMessage: "some components pending",
		},
		{
			name: "configuration error",
			status: map[string]interface{}{"conditions": []interface{}{
				map[string]interface{}{"type": "ConfigurationError", "status": "True", "message": "invalid storage secret"},
			}},
			expectedReady:   false,
			expectedMessage: "invalid storage secret",
		},
		{
			name: "active condition without message",
			status: map[string]interface{}{"conditions": []interface{}{
				map[string]interface{}{"type": "Failed", "status": "True"},
			}},
			expectedReady:   false,
			expectedMessage: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cr := &unstructured.Unstructured{Object: map[string]interface{}{}}
			if tt.status != nil {
				cr.Object["status"] = tt.status
			}

			ready, message := readStatusFromCR(cr)
			require.Equal(t, tt.expectedReady, ready)
			require.Equal(t, tt.expectedMessage, message)
		})
	}
}
