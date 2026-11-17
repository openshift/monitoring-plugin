package api

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/sirupsen/logrus"
	logtest "github.com/sirupsen/logrus/hooks/test"
	"github.com/stretchr/testify/require"
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

	rec := httptest.NewRecorder()
	ListTempoResourcesHandler(k8sclient).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/list-tempostacks", nil))

	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.JSONEq(t, `{"status":"error","error":"cannot list Tempo resources"}`, rec.Body.String())
	require.Len(t, hook.AllEntries(), 1)
	entry := hook.LastEntry()
	require.Equal(t, "connection_refused", entry.Data["error_kind"])
	line, err := entry.String()
	require.NoError(t, err)
	require.NotContains(t, line, apiURL.Host)
}
