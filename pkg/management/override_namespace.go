package management

import (
	"os"
	"strings"
)

const (
	// envMonitoringPluginNamespace allows explicit override in dev/test and in unusual deployments.
	envMonitoringPluginNamespace = "MONITORING_PLUGIN_NAMESPACE"
	// envPodNamespace is typically injected by Kubernetes (e.g. via the Downward API) and reflects the running pod namespace.
	envPodNamespace = "POD_NAMESPACE"
)

const serviceAccountNamespacePath = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"

// detectOverrideNamespace returns the namespace used to store/read shared override resources (e.g. ConfigMaps).
//
// Precedence is:
// - MONITORING_PLUGIN_NAMESPACE: explicit operator/dev override (most intentional)
// - POD_NAMESPACE: injected runtime namespace for the pod (common case)
// - serviceAccount namespace file: fallback when POD_NAMESPACE isn't set
func detectOverrideNamespace() string {
	if ns := strings.TrimSpace(os.Getenv(envMonitoringPluginNamespace)); ns != "" {
		return ns
	}
	if ns := strings.TrimSpace(os.Getenv(envPodNamespace)); ns != "" {
		return ns
	}
	if data, err := os.ReadFile(serviceAccountNamespacePath); err == nil {
		if ns := strings.TrimSpace(string(data)); ns != "" {
			return ns
		}
	}
	return "default"
}
