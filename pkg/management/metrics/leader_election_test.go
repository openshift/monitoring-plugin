package metrics

import (
	"context"
	"testing"
	"time"
)

func TestLeaderElectionRejoinsAfterLeaseLoss(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	attempts := make(chan struct{}, 3)
	done := make(chan struct{})
	go func() {
		calls := 0
		runLeaderElection(ctx, func(ctx context.Context) {
			calls++
			attempts <- struct{}{}
			if calls > 1 {
				<-ctx.Done()
			}
		})
		close(done)
	}()
	for range 2 {
		select {
		case <-attempts:
		case <-time.After(time.Second):
			t.Fatal("replica did not rejoin election after losing lease")
		}
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("leader election continued after shutdown")
	}
	if len(attempts) != 0 {
		t.Fatal("new election started after shutdown")
	}
}
