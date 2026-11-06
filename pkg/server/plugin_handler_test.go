package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	jsonpatch "github.com/evanphx/json-patch"
	"github.com/stretchr/testify/require"
)

// Resolve paths from the source file because prepareServerAssets changes the working directory.
func testConfigPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok, "cannot resolve the test source path")
	return filepath.Join(filepath.Dir(file), "..", "..", "config")
}

// TestPatchManifestAllFeatures checks all enabled patches in production order.
func TestPatchManifestAllFeatures(t *testing.T) {
	configPath := testConfigPath(t)
	allFeatures := map[Feature]bool{
		Troubleshooting:       true,
		Alerting:              true,
		AlertManagementAPI:    true,
		Metrics:               true,
		LegacyDashboards:      true,
		Targets:               true,
		Overview:              true,
		ClusterHealthAnalyzer: true,
		PersesDashboards:      true,
		AcmAlerting:           true,
		Logging:               true,
	}

	base := []byte(`{"name":"test-plugin","version":"1.0.0","extensions":[{"type":"test/sentinel","properties":{"value":"preserve me"}}]}`)
	actual := patchManifest(base, &Config{Features: allFeatures, ConfigPath: configPath})
	var manifest struct {
		Name       string           `json:"name"`
		Version    string           `json:"version"`
		Extensions []map[string]any `json:"extensions"`
	}
	require.NoError(t, json.Unmarshal(actual, &manifest))
	require.Equal(t, "test-plugin", manifest.Name)
	require.Equal(t, "1.0.0", manifest.Version)
	require.Contains(t, manifest.Extensions, map[string]any{
		"type": "test/sentinel", "properties": map[string]any{"value": "preserve me"},
	})

	expected := base
	for _, patchFile := range []string{
		"monitoring-plugin.patch.json",
		"alerting.patch.json",
		"alert-management-api.patch.json",
		"metrics.patch.json",
		"legacy-dashboards.patch.json",
		"targets.patch.json",
		"monitoring-console-plugin.patch.json",
		"overview.patch.json",
		"logging.patch.json",
		"troubleshooting.patch.json",
		"acm-alerting.patch.json",
		"cluster-health-analyzer.patch.json",
		"perses-dashboards.patch.json",
	} {
		patchData, err := os.ReadFile(filepath.Join(configPath, patchFile))
		require.NoError(t, err)
		patch, err := jsonpatch.DecodePatch(patchData)
		require.NoError(t, err)
		expected, err = patch.ApplyIndent(expected, " ")
		require.NoError(t, err, "%s must apply cleanly", patchFile)
	}
	require.JSONEq(t, string(expected), string(actual),
		"patchManifest must apply every enabled patch in order without silently skipping failures")
}

// TestPatchManifestWithoutFeatures checks that an absent or empty feature map leaves the manifest untouched.
func TestPatchManifestWithoutFeatures(t *testing.T) {
	base := []byte(`{"name":"test-plugin","extensions":[{"type":"test/sentinel"}]}`)
	for _, tc := range []struct {
		name     string
		features map[Feature]bool
	}{
		{name: "nil"},
		{name: "empty", features: map[Feature]bool{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, base, patchManifest(base, &Config{Features: tc.features, ConfigPath: t.TempDir()}))
		})
	}
}

// TestPerformPatchFailurePreservesManifest checks the fallback for unreadable and invalid patches.
func TestPerformPatchFailurePreservesManifest(t *testing.T) {
	for _, tc := range []struct {
		name  string
		patch string
	}{
		{name: "missing file"},
		{name: "malformed JSON", patch: `[`},
		{name: "invalid path", patch: `[{"op":"add","path":"/missing/0","value":{}}]`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "test.patch.json")
			if tc.patch != "" {
				require.NoError(t, os.WriteFile(path, []byte(tc.patch), 0600))
			}
			base := []byte(`{"name":"test-plugin","extensions":[]}`)
			require.Equal(t, base, performPatch(base, path))
		})
	}
}
