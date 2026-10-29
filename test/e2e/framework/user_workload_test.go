//go:build e2e

package framework

import (
	"context"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	monitoringfake "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned/fake"
	"gopkg.in/yaml.v2"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func TestMergeEnableUserWorkload(t *testing.T) {
	unchanged, changed, err := mergeEnableUserWorkload("enableUserWorkload: true\n")
	if err != nil {
		t.Fatalf("already enabled: %v", err)
	}
	if changed {
		t.Fatal("expected already-enabled config to stay unchanged")
	}
	if unchanged != "enableUserWorkload: true\n" {
		t.Fatalf("rewrote unchanged config: %q", unchanged)
	}

	merged, changed, err := mergeEnableUserWorkload("enableUserWorkload: false\nprometheusK8s:\n  retention: 12h\n")
	if err != nil {
		t.Fatalf("merge false: %v", err)
	}
	if !changed {
		t.Fatal("expected a change when user workload monitoring is disabled")
	}
	parsed := map[string]interface{}{}
	if err := yaml.Unmarshal([]byte(merged), &parsed); err != nil {
		t.Fatalf("parse merged config: %v", err)
	}
	if parsed["enableUserWorkload"] != true {
		t.Fatalf("enableUserWorkload = %#v", parsed["enableUserWorkload"])
	}
	prometheusK8s, ok := parsed["prometheusK8s"].(map[interface{}]interface{})
	if !ok || prometheusK8s["retention"] != "12h" {
		t.Fatalf("prometheusK8s = %#v", parsed["prometheusK8s"])
	}

	if _, _, err := mergeEnableUserWorkload(":\n"); err == nil {
		t.Fatal("expected invalid config to fail")
	}
}

func TestUserWorkloadPrometheusReady(t *testing.T) {
	if err := userWorkloadPrometheusReady(nil); err == nil {
		t.Fatal("expected a missing prometheus to fail")
	}

	prometheus := &monitoringv1.Prometheus{
		Status: monitoringv1.PrometheusStatus{
			Conditions: []monitoringv1.Condition{{
				Type:   monitoringv1.Available,
				Status: monitoringv1.ConditionFalse,
			}},
		},
	}
	if err := userWorkloadPrometheusReady(prometheus); err == nil {
		t.Fatal("expected Available=False to fail")
	}

	prometheus.Status.Conditions[0].Status = monitoringv1.ConditionTrue
	if err := userWorkloadPrometheusReady(prometheus); err != nil {
		t.Fatalf("available prometheus: %v", err)
	}
}

func availableUserWorkloadPrometheus() *monitoringv1.Prometheus {
	return &monitoringv1.Prometheus{
		ObjectMeta: metav1.ObjectMeta{
			Name:      userWorkloadPrometheusName,
			Namespace: k8s.UserWorkloadMonitoringNamespace,
		},
		Status: monitoringv1.PrometheusStatus{
			Conditions: []monitoringv1.Condition{{
				Type:   monitoringv1.Available,
				Status: monitoringv1.ConditionTrue,
			}},
		},
	}
}

func TestEnsureUserWorkloadMonitoringCreatesConfigAndWaits(t *testing.T) {
	client := fake.NewClientset()
	promClient := monitoringfake.NewSimpleClientset(availableUserWorkloadPrometheus())

	cleanup, err := ensureUserWorkloadMonitoring(context.Background(), client, promClient)
	if err != nil {
		t.Fatalf("ensure user workload monitoring: %v", err)
	}

	configMap, err := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace).Get(
		context.Background(), monitoringConfigMapName, metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get configmap: %v", err)
	}
	parsed := map[string]interface{}{}
	if err := yaml.Unmarshal([]byte(configMap.Data[monitoringConfigKey]), &parsed); err != nil {
		t.Fatalf("parse config: %v", err)
	}
	if parsed["enableUserWorkload"] != true {
		t.Fatalf("enableUserWorkload = %#v", parsed["enableUserWorkload"])
	}
	if err := cleanup(); err != nil {
		t.Fatalf("restore monitoring config: %v", err)
	}
	if _, err := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace).Get(context.Background(), monitoringConfigMapName, metav1.GetOptions{}); err == nil {
		t.Fatal("expected created configmap to be deleted")
	}
}

func TestEnsureUserWorkloadMonitoringKeepsExistingKeys(t *testing.T) {
	client := fake.NewClientset(&corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      monitoringConfigMapName,
			Namespace: k8s.ClusterMonitoringNamespace,
		},
		Data: map[string]string{
			monitoringConfigKey: "enableUserWorkload: false\nprometheusK8s:\n  retention: 24h\n",
		},
	})
	promClient := monitoringfake.NewSimpleClientset(availableUserWorkloadPrometheus())

	cleanup, err := ensureUserWorkloadMonitoring(context.Background(), client, promClient)
	if err != nil {
		t.Fatalf("ensure user workload monitoring: %v", err)
	}

	configMap, err := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace).Get(
		context.Background(), monitoringConfigMapName, metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get configmap: %v", err)
	}
	parsed := map[string]interface{}{}
	if err := yaml.Unmarshal([]byte(configMap.Data[monitoringConfigKey]), &parsed); err != nil {
		t.Fatalf("parse config: %v", err)
	}
	if parsed["enableUserWorkload"] != true {
		t.Fatalf("enableUserWorkload = %#v", parsed["enableUserWorkload"])
	}
	prometheusK8s, ok := parsed["prometheusK8s"].(map[interface{}]interface{})
	if !ok || prometheusK8s["retention"] != "24h" {
		t.Fatalf("prometheusK8s = %#v", parsed["prometheusK8s"])
	}
	if err := cleanup(); err != nil {
		t.Fatalf("restore monitoring config: %v", err)
	}
	restored, err := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace).Get(context.Background(), monitoringConfigMapName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get restored configmap: %v", err)
	}
	if restored.Data[monitoringConfigKey] != "enableUserWorkload: false\nprometheusK8s:\n  retention: 24h\n" {
		t.Fatalf("restored config = %q", restored.Data[monitoringConfigKey])
	}
}

func TestEnsureUserWorkloadMonitoringRestoresOnReadinessFailure(t *testing.T) {
	client := fake.NewClientset()
	promClient := monitoringfake.NewSimpleClientset()
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	if _, err := ensureUserWorkloadMonitoring(ctx, client, promClient); err == nil {
		t.Fatal("expected readiness failure")
	}
	if _, err := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace).Get(context.Background(), monitoringConfigMapName, metav1.GetOptions{}); err == nil {
		t.Fatal("expected configmap to be removed after readiness failure")
	}
}

func TestRestoreUserWorkloadMonitoringRejectsConcurrentChange(t *testing.T) {
	client := fake.NewClientset(&corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: monitoringConfigMapName, Namespace: k8s.ClusterMonitoringNamespace, ResourceVersion: "1"},
		Data:       map[string]string{monitoringConfigKey: "enableUserWorkload: false\n"},
	})
	change, err := applyEnableUserWorkload(context.Background(), client)
	if err != nil {
		t.Fatalf("enable user workload monitoring: %v", err)
	}
	configMap, err := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace).Get(context.Background(), monitoringConfigMapName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get configmap: %v", err)
	}
	configMap.ResourceVersion = "2"
	if _, err := client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace).Update(context.Background(), configMap, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("simulate concurrent update: %v", err)
	}
	if err := restoreUserWorkloadMonitoring(context.Background(), client, change); err == nil {
		t.Fatal("expected cleanup to reject a concurrent change")
	}
}
