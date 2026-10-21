package metrics

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	coordinationv1client "k8s.io/client-go/kubernetes/typed/coordination/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/leaderelection"
	"k8s.io/client-go/tools/leaderelection/resourcelock"
)

const (
	// OpenShift defaults tolerate at least 60 seconds of API disruption.
	leaseName     = "monitoring-plugin-metrics"
	leaseDuration = 137 * time.Second
	leaseRenew    = 107 * time.Second
	leaseRetry    = 26 * time.Second
)

// startLeaderElection sets up Lease-based leader election for the alerts
// effective metric. Returns a thread-safe isLeader callback.
func startLeaderElection(ctx context.Context, kubeConfig *rest.Config, namespace string) (func() bool, error) {
	coordClient, err := coordinationv1client.NewForConfig(kubeConfig)
	if err != nil {
		return nil, fmt.Errorf("create coordination client: %w", err)
	}

	identity, err := os.Hostname()
	if err != nil {
		return nil, fmt.Errorf("get hostname: %w", err)
	}

	lock := &resourcelock.LeaseLock{
		LeaseMeta: metav1.ObjectMeta{
			Name:      leaseName,
			Namespace: namespace,
		},
		Client: coordClient,
		LockConfig: resourcelock.ResourceLockConfig{
			Identity: identity,
		},
	}

	var mu sync.Mutex
	isLeading := false

	isLeader := func() bool {
		mu.Lock()
		defer mu.Unlock()
		return isLeading
	}

	le, err := leaderelection.NewLeaderElector(leaderelection.LeaderElectionConfig{
		Lock:            lock,
		LeaseDuration:   leaseDuration,
		RenewDeadline:   leaseRenew,
		RetryPeriod:     leaseRetry,
		ReleaseOnCancel: true,
		Callbacks: leaderelection.LeaderCallbacks{
			OnStartedLeading: func(leaderCtx context.Context) {
				mu.Lock()
				// This callback runs asynchronously and can arrive after lease loss.
				if leaderCtx.Err() != nil {
					mu.Unlock()
					return
				}
				isLeading = true
				mu.Unlock()
				metricsLog.Info("became leader for alert management metrics")
			},
			OnStoppedLeading: func() {
				mu.Lock()
				isLeading = false
				mu.Unlock()
				metricsLog.Info("lost leadership for alert management metrics")
			},
			OnNewLeader: func(identity string) {
				metricsLog.Infof("new leader for alert management metrics: %s", identity)
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create leader elector: %w", err)
	}

	go runLeaderElection(ctx, le.Run)
	return isLeader, nil
}

// runLeaderElection rejoins after losing a lease, until the server shuts down.
func runLeaderElection(ctx context.Context, run func(context.Context)) {
	for ctx.Err() == nil {
		run(ctx)
	}
}
