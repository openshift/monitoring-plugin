package k8s

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func newTestConfigManager() *clusterMonitoringConfigManager {
	return &clusterMonitoringConfigManager{}
}

func configMap(data map[string]string) *corev1.ConfigMap {
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      clusterMonitoringConfigMap,
			Namespace: ClusterMonitoringNamespace,
		},
		Data: data,
	}
}

func TestHandleUpdate_EnableUserWorkload(t *testing.T) {
	m := newTestConfigManager()

	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "enableUserWorkload: true",
	}))

	enabled, err := m.userWorkloadEnabled()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !enabled {
		t.Fatal("expected userWorkloadEnabled=true")
	}
}

func TestHandleUpdate_DisableUserWorkload(t *testing.T) {
	m := newTestConfigManager()

	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "enableUserWorkload: false",
	}))

	enabled, err := m.userWorkloadEnabled()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if enabled {
		t.Fatal("expected userWorkloadEnabled=false")
	}
}

func TestHandleUpdate_MissingConfigKey(t *testing.T) {
	m := newTestConfigManager()

	m.handleUpdate(configMap(map[string]string{
		"other-key": "irrelevant",
	}))

	enabled, err := m.userWorkloadEnabled()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if enabled {
		t.Fatal("expected userWorkloadEnabled=false when config key is missing")
	}
}

func TestHandleUpdate_EmptyConfigValue(t *testing.T) {
	m := newTestConfigManager()

	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "   ",
	}))

	enabled, err := m.userWorkloadEnabled()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if enabled {
		t.Fatal("expected userWorkloadEnabled=false when config value is blank")
	}
}

func TestHandleUpdate_InvalidYAML(t *testing.T) {
	m := newTestConfigManager()

	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "{{invalid yaml",
	}))

	enabled, err := m.userWorkloadEnabled()
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
	if enabled {
		t.Fatal("expected userWorkloadEnabled=false on parse error")
	}
}

func TestHandleUpdate_DeleteResetsEnabled(t *testing.T) {
	m := newTestConfigManager()

	// First enable UWM.
	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "enableUserWorkload: true",
	}))
	if enabled, _ := m.userWorkloadEnabled(); !enabled {
		t.Fatal("precondition: expected enabled=true after setting it")
	}

	// Simulate ConfigMap deletion via the delete handler.
	m.handleDelete()

	enabled, err := m.userWorkloadEnabled()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if enabled {
		t.Fatal("expected userWorkloadEnabled=false after deletion")
	}
}

func TestHandleUpdate_TransitionsEnabledToDisabled(t *testing.T) {
	m := newTestConfigManager()

	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "enableUserWorkload: true",
	}))
	if enabled, _ := m.userWorkloadEnabled(); !enabled {
		t.Fatal("precondition: expected enabled=true")
	}

	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "enableUserWorkload: false",
	}))
	enabled, err := m.userWorkloadEnabled()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if enabled {
		t.Fatal("expected userWorkloadEnabled=false after update")
	}
}

func TestHandleUpdate_ErrorClearedByValidUpdate(t *testing.T) {
	m := newTestConfigManager()

	// First inject a parse error.
	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "{{bad yaml",
	}))
	if _, err := m.userWorkloadEnabled(); err == nil {
		t.Fatal("precondition: expected error after bad YAML")
	}

	// Now send a valid config.
	m.handleUpdate(configMap(map[string]string{
		clusterMonitoringConfigKey: "enableUserWorkload: true",
	}))
	enabled, err := m.userWorkloadEnabled()
	if err != nil {
		t.Fatalf("expected no error after valid update, got: %v", err)
	}
	if !enabled {
		t.Fatal("expected userWorkloadEnabled=true")
	}
}
