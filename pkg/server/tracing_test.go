package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

// tracingConfigPath locates config/ from this source file, not the working directory:
// prepareServerAssets in server_test.go changes the working directory.
func tracingConfigPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok, "cannot resolve the test source path")
	return filepath.Join(filepath.Dir(file), "..", "..", "config")
}

// tracingExtensions are the extensions of the distributed-tracing-console-plugin
// console-extensions.json, which config/tracing.patch.json must register unchanged.
var tracingExtensions = []string{
	`{"type":"console.navigation/href","properties":{"id":"distributed-tracing","name":"Traces","href":"/observe/traces","perspective":"admin","section":"observe"}}`,
	`{"type":"console.page/route","properties":{"exact":true,"path":"/observe/traces","component":{"$codeRef":"TracesPage"}}}`,
	`{"type":"console.page/route","properties":{"exact":true,"path":"/observe/traces/:traceId","component":{"$codeRef":"TraceDetailPage"}}}`,
}

func TestTracingManifestGate(t *testing.T) {
	configPath := tracingConfigPath(t)
	for _, tc := range []struct {
		name     string
		features map[Feature]bool
		tracing  bool
	}{
		{"CMO defaults", defaultFeatures, false},
		{"COO defaults", map[Feature]bool{ClusterHealthAnalyzer: true, PersesDashboards: true, AcmAlerting: true}, false},
		{"explicit false", map[Feature]bool{Tracing: false, Metrics: true}, false},
		{"tracing only", map[Feature]bool{Tracing: true}, true},
		{"combined", map[Feature]bool{Tracing: true, Logging: true, ClusterHealthAnalyzer: true, PersesDashboards: true}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := patchManifest([]byte(`{"extensions":[]}`), &Config{Features: tc.features, ConfigPath: configPath})
			var manifest struct {
				Extensions []json.RawMessage `json:"extensions"`
			}
			require.NoError(t, json.Unmarshal(result, &manifest))
			// Every source extension must be registered exactly once, or absent when disabled.
			for _, source := range tracingExtensions {
				var expected any
				require.NoError(t, json.Unmarshal([]byte(source), &expected))
				b, err := json.Marshal(expected)
				require.NoError(t, err)
				matches := 0
				for _, extension := range manifest.Extensions {
					var actual any
					require.NoError(t, json.Unmarshal(extension, &actual))
					a, err := json.Marshal(actual)
					require.NoError(t, err)
					if string(a) == string(b) {
						matches++
					}
				}
				if tc.tracing {
					require.Equal(t, 1, matches, source)
				} else {
					require.Zero(t, matches, source)
				}
			}
		})
	}
}

// newTempoAPIKubeconfig starts a stub API server that answers the Tempo CR list requests
// of the tracing handlers with empty lists, and returns a kubeconfig pointing at it.
func newTempoAPIKubeconfig(t *testing.T) string {
	t.Helper()
	emptyLists := map[string]string{
		"/apis/tempo.grafana.com/v1alpha1/tempostacks":      `{"apiVersion":"tempo.grafana.com/v1alpha1","kind":"TempoStackList","metadata":{},"items":[]}`,
		"/apis/tempo.grafana.com/v1alpha1/tempomonolithics": `{"apiVersion":"tempo.grafana.com/v1alpha1","kind":"TempoMonolithicList","metadata":{},"items":[]}`,
	}
	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list, ok := emptyLists[r.URL.Path]
		if r.Method != http.MethodGet || !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(list))
	}))
	t.Cleanup(apiServer.Close)

	kubeconfig := filepath.Join(t.TempDir(), "kubeconfig")
	require.NoError(t, clientcmd.WriteToFile(clientcmdapi.Config{
		Clusters:       map[string]*clientcmdapi.Cluster{"stub": {Server: apiServer.URL}},
		AuthInfos:      map[string]*clientcmdapi.AuthInfo{"stub": {}},
		Contexts:       map[string]*clientcmdapi.Context{"stub": {Cluster: "stub", AuthInfo: "stub"}},
		CurrentContext: "stub",
	}, kubeconfig))
	return kubeconfig
}

// The proxy forwards the user's token to Tempo, so the tracing routes must not exist
// unless the feature is enabled, even when another feature creates the Kubernetes client.
func TestTracingRouteGate(t *testing.T) {
	t.Setenv("KUBECONFIG", newTempoAPIKubeconfig(t))

	newHandler := func(t *testing.T, cfg *Config) http.Handler {
		staticPath := t.TempDir()
		cfg.StaticPath = staticPath
		cfg.ConfigPath = tracingConfigPath(t)
		cfg.PluginConfigPath = filepath.Join(staticPath, "config.yaml")
		httpServer, err := createHTTPServer(context.Background(), cfg)
		require.NoError(t, err)
		return httpServer.Handler
	}
	get := func(t *testing.T, handler http.Handler, path string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		return recorder
	}

	for _, tc := range []struct {
		name string
		cfg  *Config
	}{
		{"CMO defaults", &Config{Features: defaultFeatures}},
		{"explicit false", &Config{Features: map[Feature]bool{Tracing: false, Logging: true}}},
		// acm-alerting creates the Kubernetes client, which must not mount the tracing routes.
		{"client without tracing", &Config{
			Features:         map[Feature]bool{AcmAlerting: true},
			AlertmanagerUrl:  "https://alertmanager.example",
			ThanosQuerierUrl: "https://thanos-querier.example",
		}},
	} {
		t.Run(tc.name+" falls through to the files handler", func(t *testing.T) {
			handler := newHandler(t, tc.cfg)
			require.Equal(t, http.StatusNotFound, get(t, handler, "/api/v1/list-tempo-resources").Code)
			require.Equal(t, http.StatusNotFound, get(t, handler, "/proxy/ns/name/tenant").Code)
		})
	}

	t.Run("tracing on reaches the tracing handlers", func(t *testing.T) {
		handler := newHandler(t, &Config{Features: map[Feature]bool{Tracing: true}})

		list := get(t, handler, "/api/v1/list-tempo-resources")
		require.Equal(t, http.StatusOK, list.Code)
		require.Contains(t, list.Body.String(), `"status":"success"`)

		// The stub has no Tempo resources, so the proxy rejects the target before forwarding.
		proxied := get(t, handler, "/proxy/ns/name/tenant")
		require.Equal(t, http.StatusInternalServerError, proxied.Code)
		require.Contains(t, proxied.Body.String(), "is not a valid Tempo resource")
	})
}
