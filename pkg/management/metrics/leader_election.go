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

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

const (
	// OpenShift defaults tolerate at least 60 seconds of API disruption.
	leaseDuration = 137 * time.Second
	leaseRenew    = 107 * time.Second
	leaseRetry    = 26 * time.Second

	// Bound for waiting on the leader elector during shutdown: releasing
	// the lease is a single API call, and the lease expires on its own
	// after leaseDuration even when the release cannot be delivered.
	leaderElectionStopTimeout = 15 * time.Second
)

// startLeaderElection sets up Lease-based leader election for the alerts
// metrics and connects its leadership lifecycle to the collector. The
// returned function blocks until the elector has stopped and released its
// lease after ctx is cancelled; it is safe to call multiple times.
func startLeaderElection(ctx context.Context, kubeConfig *rest.Config, namespace string, onStartedLeading func(context.Context), onStoppedLeading func()) (func(), error) {
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
			Name:      k8s.MetricsLeaderLeaseName,
			Namespace: namespace,
		},
		Client: coordClient,
		LockConfig: resourcelock.ResourceLockConfig{
			Identity: identity,
		},
	}

	le, err := leaderelection.NewLeaderElector(leaderelection.LeaderElectionConfig{
		Lock:            lock,
		LeaseDuration:   leaseDuration,
		RenewDeadline:   leaseRenew,
		RetryPeriod:     leaseRetry,
		ReleaseOnCancel: true,
		Callbacks: leaderelection.LeaderCallbacks{
			OnStartedLeading: onStartedLeading,
			OnStoppedLeading: onStoppedLeading,
			OnNewLeader: func(identity string) {
				metricsLog.Infof("new leader for alert management metrics: %s", identity)
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create leader elector: %w", err)
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		runLeaderElection(ctx, le.Run)
	}()

	var once sync.Once
	return func() {
		once.Do(func() {
			select {
			case <-done:
			case <-time.After(leaderElectionStopTimeout):
				metricsLog.Warn("timed out waiting for the metrics leader election to stop; the lease expires on its own")
			}
		})
	}, nil
}

// runLeaderElection rejoins after losing a lease, until the server shuts down.
func runLeaderElection(ctx context.Context, run func(context.Context)) {
	for ctx.Err() == nil {
		run(ctx)
	}
}
