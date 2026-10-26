package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// Resolved before any test runs: prepareServerAssets in server_test.go changes the working directory.
var troubleshootingConfigPath, _ = filepath.Abs("../../config")

func TestTroubleshootingManifestGate(t *testing.T) {
	for _, tc := range []struct {
		name            string
		features        map[Feature]bool
		troubleshooting bool
	}{
		{"CMO defaults", defaultFeatures, false},
		{"COO defaults", map[Feature]bool{ClusterHealthAnalyzer: true, PersesDashboards: true, AcmAlerting: true}, false},
		{"explicit false", map[Feature]bool{Troubleshooting: false, Metrics: true}, false},
		{"agent-navigation alone", map[Feature]bool{"agent-navigation": true}, false},
		{"troubleshooting only", map[Feature]bool{Troubleshooting: true}, true},
		{"combined", map[Feature]bool{Troubleshooting: true, "agent-navigation": true, ClusterHealthAnalyzer: true, PersesDashboards: true}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := patchManifest([]byte(`{"extensions":[]}`), &Config{Features: tc.features, ConfigPath: troubleshootingConfigPath})
			var manifest struct {
				Extensions []json.RawMessage `json:"extensions"`
			}
			require.NoError(t, json.Unmarshal(result, &manifest))
			// Every source extension must be registered exactly once, or absent when disabled.
			patch, err := os.ReadFile(filepath.Join(troubleshootingConfigPath, "troubleshooting.patch.json"))
			require.NoError(t, err)
			var additions []struct {
				Value json.RawMessage `json:"value"`
			}
			require.NoError(t, json.Unmarshal(patch, &additions))
			require.Len(t, additions, 3)
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
				if tc.troubleshooting {
					require.Equal(t, 1, matches)
				} else {
					require.Zero(t, matches)
				}
			}
		})
	}
}
