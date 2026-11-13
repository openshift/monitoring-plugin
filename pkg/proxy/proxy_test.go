package proxy

import (
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestFilterHeadersStripsCORS verifies the proxy never forwards CORS headers
// served by Alertmanager or Thanos Querier.
func TestFilterHeadersStripsCORS(t *testing.T) {
	resp := &http.Response{Header: http.Header{
		"Access-Control-Allow-Origin":      {"https://example.com"},
		"Access-Control-Allow-Credentials": {"true"},
		"Access-Control-Allow-Headers":     {"Authorization"},
		"Access-Control-Allow-Methods":     {"GET, POST"},
		"Access-Control-Expose-Headers":    {"X-Upstream"},
		"Access-Control-Max-Age":           {"600"},
		"Content-Type":                     {"application/json"},
	}}

	require.NoError(t, FilterHeaders(resp))

	for _, header := range []string{
		"Access-Control-Allow-Origin",
		"Access-Control-Allow-Credentials",
		"Access-Control-Allow-Headers",
		"Access-Control-Allow-Methods",
		"Access-Control-Expose-Headers",
		"Access-Control-Max-Age",
	} {
		require.Empty(t, resp.Header.Values(header), "header %q must be stripped", header)
	}
	require.Equal(t, "application/json", resp.Header.Get("Content-Type"))
}

// TestProxyHandlerDoesNotServeCORS exercises the full proxy path: CORS headers
// set by the upstream must not reach the client.
func TestProxyHandlerDoesNotServeCORS(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "https://upstream.example")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success"}`))
	}))
	defer upstream.Close()

	// The service CA file doubles as the proxy's upstream trust bundle.
	caFile := filepath.Join(t.TempDir(), "ca.crt")
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: upstream.Certificate().Raw})
	require.NoError(t, os.WriteFile(caFile, certPEM, 0600))

	for _, kind := range []KindType{AlertManagerKind, ThanosQuerierKind} {
		t.Run(string(kind), func(t *testing.T) {
			handler := NewProxyHandler(nil, caFile, kind, upstream.URL)

			req := httptest.NewRequest(http.MethodGet, "/api/v2/status", nil)
			// A browser would send Origin; it must not change the outcome.
			req.Header.Set("Origin", "https://evil.example")
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			require.Equal(t, http.StatusOK, rec.Code)
			require.JSONEq(t, `{"status":"success"}`, rec.Body.String())
			for header := range rec.Header() {
				require.NotContains(t, header, "Access-Control-")
			}
		})
	}
}
