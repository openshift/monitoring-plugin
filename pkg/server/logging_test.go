package server

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLoggingManifestGate(t *testing.T) {
	for _, tc := range []struct {
		name     string
		features map[Feature]bool
		logging  bool
	}{
		{"CMO defaults", defaultFeatures, false},
		{"COO defaults", map[Feature]bool{ClusterHealthAnalyzer: true, PersesDashboards: true, AcmAlerting: true}, false},
		{"explicit false", map[Feature]bool{Logging: false, Metrics: true}, false},
		{"logging only", map[Feature]bool{Logging: true}, true},
		{"combined", map[Feature]bool{Logging: true, ClusterHealthAnalyzer: true, PersesDashboards: true}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := patchManifest([]byte(`{"extensions":[]}`), &Config{Features: tc.features, ConfigPath: "../../config"})
			var manifest struct {
				Extensions []json.RawMessage `json:"extensions"`
			}
			require.NoError(t, json.Unmarshal(result, &manifest))
			// Every source extension must be registered exactly once, or absent when disabled.
			patch, err := os.ReadFile("../../config/logging.patch.json")
			require.NoError(t, err)
			var additions []struct {
				Value json.RawMessage `json:"value"`
			}
			require.NoError(t, json.Unmarshal(patch, &additions))
			require.Len(t, additions, 10)
			for _, addition := range additions {
				var expected interface{}
				require.NoError(t, json.Unmarshal(addition.Value, &expected))
				matches := 0
				for _, extension := range manifest.Extensions {
					var actual interface{}
					require.NoError(t, json.Unmarshal(extension, &actual))
					a, _ := json.Marshal(actual)
					b, _ := json.Marshal(expected)
					if string(a) == string(b) {
						matches++
					}
				}
				if tc.logging {
					require.Equal(t, 1, matches)
				} else {
					require.Zero(t, matches)
				}
			}
			if tc.logging {
				require.Contains(t, string(result), `"mcp"`)
			}
		})
	}
}

func TestLoggingConfig(t *testing.T) {
	for _, tc := range []struct {
		name, yaml, expected string
		timeout              time.Duration
	}{
		{"nested defaults", "logging: {}\n", `{"logging":{}}`, 30 * time.Second},
		{"isolated timeout", "timeout: 45s\nlogging:\n  timeout: 2.5s\n  logsLimit: 50\n  schema: select\n  useTenantInHeader: true\n  isStreamingEnabledInDefaultPage: true\n  showTimezoneSelector: true\n  alertingRuleTenantLabelKey: tenant\n  alertingRuleNamespaceLabelKey: namespace\n", `{"timeout":45,"logging":{"timeout":2.5,"logsLimit":50,"schema":"select","useTenantInHeader":true,"isStreamingEnabledInDefaultPage":true,"showTimezoneSelector":true,"alertingRuleTenantLabelKey":"tenant","alertingRuleNamespaceLabelKey":"namespace"}}`, 45 * time.Second},
		{"logging timeout alone", "logging:\n  timeout: 5s\n", `{"logging":{"timeout":5}}`, 30 * time.Second},
		{"shared zero is unset", "timeout: 0s\nlogging:\n  schema: otel\n", `{"logging":{"schema":"otel"}}`, 30 * time.Second},
		{"no logging", "timeout: 15s\n", `{"timeout":15}`, 15 * time.Second},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			configFile := filepath.Join(dir, "config.yaml")
			require.NoError(t, os.WriteFile(configFile, []byte(tc.yaml), 0600))
			cfg := &Config{Features: map[Feature]bool{Logging: true}, PluginConfigPath: configFile, StaticPath: dir, ConfigPath: "../../config"}
			handler, config := configHandler(cfg)
			require.NotNil(t, config)
			response := httptest.NewRecorder()
			handler(response, httptest.NewRequest("GET", "/config", nil))
			require.JSONEq(t, tc.expected, response.Body.String())
			server, err := createHTTPServer(context.Background(), cfg)
			require.NoError(t, err) // logging alone must not require in-cluster ACM credentials.
			require.Equal(t, tc.timeout, server.ReadTimeout)
			require.Equal(t, tc.timeout, server.WriteTimeout)
		})
	}
	t.Run("missing config", func(t *testing.T) {
		handler, config := configHandler(&Config{PluginConfigPath: filepath.Join(t.TempDir(), "missing")})
		require.Nil(t, config)
		response := httptest.NewRecorder()
		handler(response, httptest.NewRequest("GET", "/config", nil))
		require.JSONEq(t, `{}`, response.Body.String())
	})
}

// Existing non-logging configuration behavior must remain unchanged.
func TestLoggingDoesNotChangeLegacyConfigDefaults(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	require.NoError(t, os.WriteFile(path, []byte("{}"), 0600))
	handler, config := configHandler(&Config{Features: defaultFeatures, PluginConfigPath: path})
	response := httptest.NewRecorder()
	handler(response, httptest.NewRequest("GET", "/config", nil))
	require.JSONEq(t, "{}", response.Body.String())
	require.Zero(t, config.Timeout)
}
