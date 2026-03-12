package management_test

import (
	"context"
	"testing"
	"time"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

func TestGetAlertingHealth_SetsDeadlineWhenCallerHasNone(t *testing.T) {
	var hasDeadline bool
	mockK8s := &testutils.MockClient{
		AlertingHealthFunc: func(ctx context.Context) (k8s.AlertingHealth, error) {
			_, hasDeadline = ctx.Deadline()
			return k8s.AlertingHealth{}, nil
		},
	}
	client := management.New(context.Background(), mockK8s)
	if _, err := client.GetAlertingHealth(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !hasDeadline {
		t.Fatal("expected GetAlertingHealth to set a deadline when the caller did not")
	}
}

func TestGetAlertingHealth_PreservesCallerDeadline(t *testing.T) {
	callerDeadline := time.Now().Add(2 * time.Second)
	ctx, cancel := context.WithDeadline(context.Background(), callerDeadline)
	defer cancel()

	var gotDeadline time.Time
	var sawDeadline bool
	mockK8s := &testutils.MockClient{
		AlertingHealthFunc: func(ctx context.Context) (k8s.AlertingHealth, error) {
			gotDeadline, sawDeadline = ctx.Deadline()
			return k8s.AlertingHealth{}, nil
		},
	}
	client := management.New(context.Background(), mockK8s)
	if _, err := client.GetAlertingHealth(ctx); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !sawDeadline {
		t.Fatal("expected the caller's deadline to be forwarded")
	}
	if !gotDeadline.Equal(callerDeadline) {
		t.Errorf("expected caller deadline %v, got %v", callerDeadline, gotDeadline)
	}
}
