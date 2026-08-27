package k8s

import (
	"context"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

type mockARCInterface struct {
	arcs    map[string]*osmv1.AlertRelabelConfig
	deleted []string
}

func (m *mockARCInterface) List(_ context.Context, _ string) ([]osmv1.AlertRelabelConfig, error) {
	var result []osmv1.AlertRelabelConfig
	for _, arc := range m.arcs {
		result = append(result, *arc)
	}
	return result, nil
}

func (m *mockARCInterface) Get(_ context.Context, ns, name string) (*osmv1.AlertRelabelConfig, bool, error) {
	if arc, ok := m.arcs[ns+"/"+name]; ok {
		return arc, true, nil
	}
	return nil, false, nil
}

func (m *mockARCInterface) Create(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
	return &arc, nil
}

func (m *mockARCInterface) Update(_ context.Context, _ osmv1.AlertRelabelConfig) error { return nil }

func (m *mockARCInterface) Delete(_ context.Context, ns, name string) error {
	m.deleted = append(m.deleted, ns+"/"+name)
	delete(m.arcs, ns+"/"+name)
	return nil
}

func newARC(ns, name, ruleID string, annotations, labels map[string]string) *osmv1.AlertRelabelConfig {
	if annotations == nil {
		annotations = map[string]string{}
	}
	if ruleID != "" {
		annotations[managementlabels.ARCAnnotationAlertRuleIDKey] = ruleID
	}
	return &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   ns,
			Annotations: annotations,
			Labels:      labels,
		},
	}
}

func TestGCOrphanedARCs_DeletesOrphan(t *testing.T) {
	mock := &mockARCInterface{
		arcs: map[string]*osmv1.AlertRelabelConfig{
			"openshift-monitoring/arc-orphan": newARC("openshift-monitoring", "arc-orphan", "rule-gone", nil, nil),
		},
	}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock}

	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})

	if len(mock.deleted) != 1 || mock.deleted[0] != "openshift-monitoring/arc-orphan" {
		t.Fatalf("expected orphan ARC to be deleted, got deleted=%v", mock.deleted)
	}
}

func TestGCOrphanedARCs_KeepsLiveRule(t *testing.T) {
	mock := &mockARCInterface{
		arcs: map[string]*osmv1.AlertRelabelConfig{
			"openshift-monitoring/arc-live": newARC("openshift-monitoring", "arc-live", "rule-alive", nil, nil),
		},
	}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock}

	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{"rule-alive": {}})

	if len(mock.deleted) != 0 {
		t.Fatalf("expected no deletions, got deleted=%v", mock.deleted)
	}
}

func TestGCOrphanedARCs_SkipsGitOpsManaged(t *testing.T) {
	mock := &mockARCInterface{
		arcs: map[string]*osmv1.AlertRelabelConfig{
			"openshift-monitoring/arc-gitops": newARC("openshift-monitoring", "arc-gitops", "rule-gone",
				map[string]string{"argocd.argoproj.io/tracking-id": "some-id"}, nil),
		},
	}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock}

	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})

	if len(mock.deleted) != 0 {
		t.Fatalf("expected GitOps-managed ARC to be preserved, got deleted=%v", mock.deleted)
	}
}

func TestGCOrphanedARCs_SkipsARCWithoutAnnotation(t *testing.T) {
	mock := &mockARCInterface{
		arcs: map[string]*osmv1.AlertRelabelConfig{
			"openshift-monitoring/arc-manual": newARC("openshift-monitoring", "arc-manual", "", nil, nil),
		},
	}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock}

	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})

	if len(mock.deleted) != 0 {
		t.Fatalf("expected ARC without annotation to be preserved, got deleted=%v", mock.deleted)
	}
}

func TestGCOrphanedARCs_MixedScenario(t *testing.T) {
	mock := &mockARCInterface{
		arcs: map[string]*osmv1.AlertRelabelConfig{
			"openshift-monitoring/arc-live":    newARC("openshift-monitoring", "arc-live", "rule-1", nil, nil),
			"openshift-monitoring/arc-orphan1": newARC("openshift-monitoring", "arc-orphan1", "rule-deleted-1", nil, nil),
			"openshift-monitoring/arc-orphan2": newARC("openshift-monitoring", "arc-orphan2", "rule-deleted-2", nil, nil),
			"openshift-monitoring/arc-gitops": newARC("openshift-monitoring", "arc-gitops", "rule-deleted-3",
				map[string]string{"argocd.argoproj.io/tracking-id": "t"}, nil),
			"openshift-monitoring/arc-manual": newARC("openshift-monitoring", "arc-manual", "", nil, nil),
		},
	}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock}

	liveIDs := map[string]struct{}{"rule-1": {}}
	rrm.gcOrphanedARCs(context.Background(), liveIDs)

	deletedSet := map[string]bool{}
	for _, d := range mock.deleted {
		deletedSet[d] = true
	}

	if len(mock.deleted) != 2 {
		t.Fatalf("expected 2 deletions, got %d: %v", len(mock.deleted), mock.deleted)
	}
	if !deletedSet["openshift-monitoring/arc-orphan1"] {
		t.Error("expected arc-orphan1 to be deleted")
	}
	if !deletedSet["openshift-monitoring/arc-orphan2"] {
		t.Error("expected arc-orphan2 to be deleted")
	}
	if deletedSet["openshift-monitoring/arc-live"] {
		t.Error("arc-live should not have been deleted")
	}
	if deletedSet["openshift-monitoring/arc-gitops"] {
		t.Error("arc-gitops should not have been deleted (GitOps-managed)")
	}
	if deletedSet["openshift-monitoring/arc-manual"] {
		t.Error("arc-manual should not have been deleted (no annotation)")
	}
}

func TestGCOrphanedARCs_NilInterface(t *testing.T) {
	rrm := &relabeledRulesManager{alertRelabelConfigs: nil}
	// Should not panic
	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})
}
