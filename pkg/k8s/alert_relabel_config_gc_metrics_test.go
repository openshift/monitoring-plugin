package k8s

import (
	"context"
	"errors"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestGCOrphanedARCs_ListErrorIncrementsMetric(t *testing.T) {
	metrics := newAlertRelabelConfigGCMetrics()
	mock := &mockARCInterface{listErr: errors.New("list failed")}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock, gcMetrics: metrics}

	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})

	if got := testutil.ToFloat64(metrics.listErrors); got != 1 {
		t.Fatalf("list errors = %v, want 1", got)
	}
	if got := testutil.ToFloat64(metrics.deleteErrors); got != 0 {
		t.Fatalf("delete errors = %v, want 0", got)
	}
}

func TestGCOrphanedARCs_DeleteErrorIncrementsMetric(t *testing.T) {
	metrics := newAlertRelabelConfigGCMetrics()
	mock := &mockARCInterface{
		arcs: map[string]*osmv1.AlertRelabelConfig{
			"openshift-monitoring/arc-orphan": newARC("openshift-monitoring", "arc-orphan", "rule-gone", expiredOrphanMarker(), nil),
		},
		deleteErr: errors.New("delete failed"),
	}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock, gcMetrics: metrics}

	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})

	if got := testutil.ToFloat64(metrics.deleteErrors); got != 1 {
		t.Fatalf("delete errors = %v, want 1", got)
	}
	if len(mock.deleted) != 0 {
		t.Fatalf("expected no deletions, got %v", mock.deleted)
	}
}

func TestGCOrphanedARCs_GitOpsOrphanSetsGauge(t *testing.T) {
	metrics := newAlertRelabelConfigGCMetrics()
	mock := &mockARCInterface{
		arcs: map[string]*osmv1.AlertRelabelConfig{
			"openshift-monitoring/arc-gitops": newARC("openshift-monitoring", "arc-gitops", "rule-gone",
				map[string]string{"argocd.argoproj.io/tracking-id": "some-id"}, nil),
			"openshift-monitoring/arc-live": newARC("openshift-monitoring", "arc-live", "rule-alive", nil, nil),
		},
	}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock, gcMetrics: metrics}

	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{"rule-alive": {}})

	if got := testutil.ToFloat64(metrics.gitopsOrphans); got != 1 {
		t.Fatalf("gitops orphans = %v, want 1", got)
	}
	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{"rule-alive": {}, "rule-gone": {}})
	if got := testutil.ToFloat64(metrics.gitopsOrphans); got != 0 {
		t.Fatalf("gitops orphan gauge did not reset: %v", got)
	}
}
