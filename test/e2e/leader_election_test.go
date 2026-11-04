//go:build e2e

package e2e

import (
	"context"
	"fmt"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/metrics"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

const (
	pluginDeploymentName = "monitoring-plugin"
	leaderPollInterval   = 5 * time.Second
	leaderPollTimeout    = 3 * time.Minute
)

// TestAlertMetricsElectsSingleLeader verifies that with multiple plugin
// replicas available, only a single replica is elected as the alert-metrics
// leader: the holder of the monitoring-plugin-metrics Lease must be one of
// the ready plugin pods, and the metric family is still served.
func TestAlertMetricsElectsSingleLeader(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()
	deployments := f.Clientset.AppsV1().Deployments(k8s.ClusterMonitoringNamespace)

	deployment, err := deployments.Get(ctx, pluginDeploymentName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get deployment %s/%s: %v", k8s.ClusterMonitoringNamespace, pluginDeploymentName, err)
	}

	originalReplicas := int32(1)
	if deployment.Spec.Replicas != nil {
		originalReplicas = *deployment.Spec.Replicas
	}

	// The operator deploys two replicas by default; scale up when running
	// against a cluster configured differently, and restore afterwards.
	if originalReplicas < 2 {
		t.Logf("Scaling %s from %d to 2 replicas for the leader-election check", pluginDeploymentName, originalReplicas)
		scaled := deployment.DeepCopy()
		replicas := int32(2)
		scaled.Spec.Replicas = &replicas
		if _, err := deployments.Update(ctx, scaled, metav1.UpdateOptions{}); err != nil {
			t.Fatalf("Failed to scale deployment %s to 2 replicas: %v", pluginDeploymentName, err)
		}
		defer func() {
			// Read the deployment fresh: restoring the object fetched at
			// test start could revert operator changes made meanwhile.
			current, err := deployments.Get(context.Background(), pluginDeploymentName, metav1.GetOptions{})
			if err != nil {
				t.Logf("Failed to get deployment %s for restore: %v", pluginDeploymentName, err)
				return
			}
			restored := current.DeepCopy()
			restored.Spec.Replicas = &originalReplicas
			if _, err := deployments.Update(context.Background(), restored, metav1.UpdateOptions{}); err != nil {
				t.Logf("Failed to restore deployment %s replicas to %d: %v", pluginDeploymentName, originalReplicas, err)
			}
		}()
	}

	podSelector := metav1.FormatLabelSelector(deployment.Spec.Selector)

	// Wait for at least two ready replicas and a Lease holder that is one of
	// them. The holder is the single replica emitting the alert metrics.
	var holder string
	err = framework.Poll(leaderPollInterval, leaderPollTimeout, func() error {
		pods, err := f.Clientset.CoreV1().Pods(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{
			LabelSelector: podSelector,
		})
		if err != nil {
			return err
		}

		readyPods := 0
		holderReady := false
		for _, pod := range pods.Items {
			for _, condition := range pod.Status.Conditions {
				if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
					readyPods++
					if pod.Name == holder {
						holderReady = true
					}
					break
				}
			}
		}
		if readyPods < 2 {
			return fmt.Errorf("waiting for ready plugin replicas: %d/%d", readyPods, 2)
		}

		lease, err := f.Clientset.CoordinationV1().Leases(k8s.ClusterMonitoringNamespace).Get(
			ctx, k8s.MetricsLeaderLeaseName, metav1.GetOptions{},
		)
		if err != nil {
			return err
		}
		if lease.Spec.HolderIdentity == nil || *lease.Spec.HolderIdentity == "" {
			return fmt.Errorf("waiting for the %s Lease to be acquired", k8s.MetricsLeaderLeaseName)
		}
		holder = *lease.Spec.HolderIdentity

		if !holderReady {
			return fmt.Errorf("waiting for the Lease holder %s to be a ready plugin pod", holder)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for a single leader among the plugin replicas: %v", err)
	}

	t.Logf("Lease %s is held by a single ready replica: %s", k8s.MetricsLeaderLeaseName, holder)

	// The leader keeps serving the metric family while other replicas stand by.
	samples := waitForMetricSamples(t, f, nil)
	t.Logf("Metric family %s is served by the leader (%d series)", metrics.MetricName, len(samples))
}
