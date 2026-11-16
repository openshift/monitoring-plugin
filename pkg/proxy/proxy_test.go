package proxy

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/pem"
	stdlog "log"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	logtest "github.com/sirupsen/logrus/hooks/test"
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

func TestGetProxyInvalidURLDoesNotLeakURL(t *testing.T) {
	for name, proxyURL := range map[string]string{
		"invalid escape":         "https://user:s3cret@alertmanager.example:9095/%zz",
		"invalid bracketed host": "https://user:s3cret@[alertmanager.example]:9095",
	} {
		t.Run(name, func(t *testing.T) {
			hook := logtest.NewGlobal()
			t.Cleanup(func() { logrus.StandardLogger().ReplaceHooks(make(logrus.LevelHooks)) })

			_, err := getProxy(AlertManagerKind, proxyURL, "")
			require.Error(t, err)
			require.NotContains(t, err.Error(), "s3cret")
			require.NotContains(t, err.Error(), "alertmanager.example")

			for _, entry := range hook.AllEntries() {
				line, err := entry.String()
				require.NoError(t, err)
				require.NotContains(t, line, "s3cret")
				require.NotContains(t, line, "alertmanager.example")
			}
		})
	}
}

func TestCreateProxyMissingCADoesNotLeakPath(t *testing.T) {
	dir := t.TempDir()
	_, err := createProxy(AlertManagerKind, &url.URL{Scheme: "https", Host: "localhost"}, filepath.Join(dir, "ca.crt"))
	require.Error(t, err)
	require.NotContains(t, err.Error(), dir)
}

// TestProxyErrorDoesNotLeakUpstream verifies that a failed upstream connection
// does not expose the upstream address in the logs or the client response.
func TestProxyErrorDoesNotLeakUpstream(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	caFile := filepath.Join(t.TempDir(), "ca.crt")
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: upstream.Certificate().Raw})
	require.NoError(t, os.WriteFile(caFile, certPEM, 0600))
	upstreamURL, err := url.Parse(upstream.URL)
	require.NoError(t, err)
	// Close the upstream so the proxy fails to connect.
	upstream.Close()

	hook := logtest.NewGlobal()
	t.Cleanup(func() { logrus.StandardLogger().ReplaceHooks(make(logrus.LevelHooks)) })

	handler := NewProxyHandler(nil, caFile, ThanosQuerierKind, upstream.URL)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/query", nil))

	require.Equal(t, http.StatusBadGateway, rec.Code)
	require.NotContains(t, rec.Body.String(), upstreamURL.Host)
	require.NotEmpty(t, hook.AllEntries())
	for _, entry := range hook.AllEntries() {
		line, err := entry.String()
		require.NoError(t, err)
		require.NotContains(t, line, upstreamURL.Host)
	}
}

// ReverseProxy logs body copy errors itself, bypassing ErrorHandler.
func TestProxyBodyCopyErrorDoesNotLeakUpstream(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "1024")
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write([]byte(`{"status":`)); err != nil {
			t.Errorf("partial write: %v", err)
			return
		}
		w.(http.Flusher).Flush()

		conn, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			t.Errorf("hijack: %v", err)
			return
		}
		// Send a TCP RST.
		tlsConn, ok := conn.(*tls.Conn)
		if !ok {
			t.Errorf("unexpected connection type %T", conn)
			return
		}
		tcpConn, ok := tlsConn.NetConn().(*net.TCPConn)
		if !ok {
			t.Errorf("unexpected connection type %T", tlsConn.NetConn())
			return
		}
		if err := tcpConn.SetLinger(0); err != nil {
			t.Errorf("set linger: %v", err)
		}
		if err := tcpConn.Close(); err != nil {
			t.Errorf("close: %v", err)
		}
	}))
	defer upstream.Close()

	caFile := filepath.Join(t.TempDir(), "ca.crt")
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: upstream.Certificate().Raw})
	require.NoError(t, os.WriteFile(caFile, certPEM, 0600))
	upstreamURL, err := url.Parse(upstream.URL)
	require.NoError(t, err)

	hook := logtest.NewGlobal()
	t.Cleanup(func() { logrus.StandardLogger().ReplaceHooks(make(logrus.LevelHooks)) })
	var stdLogs bytes.Buffer
	stdlog.SetOutput(&stdLogs)
	t.Cleanup(func() { stdlog.SetOutput(os.Stderr) })

	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	handler := NewProxyHandler(nil, caFile, ThanosQuerierKind, upstream.URL)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/v1/query", nil))

	require.Empty(t, stdLogs.String())
	var messages []string
	for _, entry := range hook.AllEntries() {
		line, err := entry.String()
		require.NoError(t, err)
		require.NotContains(t, line, upstreamURL.Host)
		messages = append(messages, entry.Message)
	}
	require.Contains(t, messages, "read error while streaming upstream response body")
}
