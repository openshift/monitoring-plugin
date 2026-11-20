package k8s

import (
	"sync"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestPortForwardTunnelConcurrentAccess(t *testing.T) {
	var tunnel portForwardTunnel
	var callers sync.WaitGroup
	opens := 0
	open := func(func(error)) (string, error) {
		opens++
		return "127.0.0.1:1234", nil
	}
	for range 10 {
		callers.Go(func() {
			addr, err := tunnel.address("test-service", open)
			if err != nil || addr != "127.0.0.1:1234" {
				t.Errorf("address = %q, error = %v", addr, err)
			}
		})
	}
	callers.Wait()
	if opens != 1 {
		t.Fatalf("opened %d tunnels concurrently, want 1", opens)
	}
}

func TestReadyPodName(t *testing.T) {
	now := metav1.Now()
	ready := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "thanos-querier-ready"},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			Conditions: []corev1.PodCondition{{
				Type:   corev1.PodReady,
				Status: corev1.ConditionTrue,
			}},
		},
	}
	deleting := ready
	deleting.Name = "thanos-querier-deleting"
	deleting.DeletionTimestamp = &now
	pending := ready
	pending.Name = "thanos-querier-pending"
	pending.Status.Phase = corev1.PodPending
	notReady := ready
	notReady.Name = "thanos-querier-not-ready"
	notReady.Status.Conditions = []corev1.PodCondition{{
		Type:   corev1.PodReady,
		Status: corev1.ConditionFalse,
	}}

	name, err := readyPodName([]corev1.Pod{deleting, pending, notReady, ready})
	if err != nil {
		t.Fatalf("ready pod: %v", err)
	}
	if name != ready.Name {
		t.Fatalf("pod %q, want %q", name, ready.Name)
	}

	if _, err := readyPodName(nil); err == nil {
		t.Fatal("expected error when no pod is ready")
	}
}
