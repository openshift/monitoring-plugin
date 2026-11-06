package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type troubleshootingCodeRef struct {
	Name string `json:"$codeRef"`
}

type troubleshootingProperties struct {
	ContextID    string                  `json:"contextId"`
	Scope        string                  `json:"scope"`
	Provider     *troubleshootingCodeRef `json:"provider"`
	Reducer      *troubleshootingCodeRef `json:"reducer"`
	UseValueHook *troubleshootingCodeRef `json:"useValueHook"`
}

type troubleshootingExtension struct {
	Type       string                    `json:"type"`
	Properties troubleshootingProperties `json:"properties"`
}

type troubleshootingPatchOperation struct {
	Op    string                   `json:"op"`
	Path  string                   `json:"path"`
	Value troubleshootingExtension `json:"value"`
}

func troubleshootingPatchOperations(t *testing.T) []troubleshootingPatchOperation {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(testConfigPath(t), "troubleshooting.patch.json"))
	require.NoError(t, err)
	var operations []troubleshootingPatchOperation
	require.NoError(t, json.Unmarshal(data, &operations))
	require.NotEmpty(t, operations)
	return operations
}

// TestTroubleshootingManifestGate checks that only the troubleshooting flag enables its extensions.
func TestTroubleshootingManifestGate(t *testing.T) {
	configPath := testConfigPath(t)
	operations := troubleshootingPatchOperations(t)
	for _, tc := range []struct {
		name            string
		features        map[Feature]bool
		troubleshooting bool
	}{
		{"core monitoring features", defaultFeatures, false},
		{"extended monitoring features", map[Feature]bool{ClusterHealthAnalyzer: true, PersesDashboards: true, AcmAlerting: true}, false},
		{"explicit false", map[Feature]bool{Troubleshooting: false, Metrics: true}, false},
		{"agent-navigation alone", map[Feature]bool{"agent-navigation": true}, false},
		{"troubleshooting only", map[Feature]bool{Troubleshooting: true}, true},
		{"combined", map[Feature]bool{Troubleshooting: true, "agent-navigation": true, ClusterHealthAnalyzer: true, PersesDashboards: true}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := patchManifest([]byte(`{"extensions":[]}`), &Config{Features: tc.features, ConfigPath: configPath})
			var manifest struct {
				Extensions []troubleshootingExtension `json:"extensions"`
			}
			require.NoError(t, json.Unmarshal(result, &manifest))
			for _, operation := range operations {
				matches := 0
				for _, extension := range manifest.Extensions {
					if reflect.DeepEqual(operation.Value, extension) {
						matches++
					}
				}
				if tc.troubleshooting {
					require.Equal(t, 1, matches, "%s must be registered exactly once", operation.Value.Type)
				} else {
					require.Zero(t, matches, "%s must not be registered", operation.Value.Type)
				}
			}
		})
	}
}

// TestTroubleshootingCodeRefs checks that referenced modules are exposed by the plugin.
func TestTroubleshootingCodeRefs(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(testConfigPath(t), "..", "web", "package.json"))
	require.NoError(t, err)
	var pkg struct {
		ConsolePlugin struct {
			ExposedModules map[string]string `json:"exposedModules"`
		} `json:"consolePlugin"`
	}
	require.NoError(t, json.Unmarshal(data, &pkg))
	for _, operation := range troubleshootingPatchOperations(t) {
		properties := operation.Value.Properties
		for _, ref := range []*troubleshootingCodeRef{properties.Provider, properties.Reducer, properties.UseValueHook} {
			if ref == nil {
				continue
			}
			require.NotEmpty(t, ref.Name)
			// $codeRef is either "Module" (default export) or "Module.Export".
			module, _, _ := strings.Cut(ref.Name, ".")
			require.Contains(t, pkg.ConsolePlugin.ExposedModules, module)
			require.NotEmpty(t, pkg.ConsolePlugin.ExposedModules[module])
		}
	}
}
