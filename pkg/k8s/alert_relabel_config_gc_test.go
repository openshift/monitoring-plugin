package k8s

import (
	"context"
	"errors"
	"testing"
	"time"

	osmv1 "github.com/openshift/api/monitoring/v1"
	"github.com/sirupsen/logrus"
	"github.com/sirupsen/logrus/hooks/test"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/workqueue"

	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

type mockARCInterface struct {
	arcs      map[string]*osmv1.AlertRelabelConfig
	deleted   []string
	listErr   error
	deleteErr error
	updateErr error
}

func (m *mockARCInterface) List(_ context.Context, _ string) ([]osmv1.AlertRelabelConfig, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
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

func (m *mockARCInterface) Update(_ context.Context, arc osmv1.AlertRelabelConfig) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.arcs[arc.Namespace+"/"+arc.Name] = arc.DeepCopy()
	return nil
}

func (m *mockARCInterface) Delete(_ context.Context, ns, name string) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
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
			"openshift-monitoring/arc-orphan": newARC("openshift-monitoring", "arc-orphan", "rule-gone", expiredOrphanMarker(), nil),
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
			"openshift-monitoring/arc-orphan1": newARC("openshift-monitoring", "arc-orphan1", "rule-deleted-1", expiredOrphanMarker(), nil),
			"openshift-monitoring/arc-orphan2": newARC("openshift-monitoring", "arc-orphan2", "rule-deleted-2", expiredOrphanMarker(), nil),
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

func TestGCOrphanedARCs_NilAnnotations(t *testing.T) {
	mock := &mockARCInterface{
		arcs: map[string]*osmv1.AlertRelabelConfig{
			"openshift-monitoring/arc-nil": {
				ObjectMeta: metav1.ObjectMeta{
					Name:      "arc-nil",
					Namespace: "openshift-monitoring",
				},
			},
		},
	}
	rrm := &relabeledRulesManager{alertRelabelConfigs: mock}

	rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})

	if len(mock.deleted) != 0 {
		t.Fatalf("expected ARC with nil annotations to be preserved, got deleted=%v", mock.deleted)
	}
}

func TestGCOrphanedARCs_LogsFailuresAndGitOpsOrphans(t *testing.T) {
	for _, tc := range []struct {
		name    string
		mock    *mockARCInterface
		level   logrus.Level
		message string
	}{
		{
			name:    "list error",
			mock:    &mockARCInterface{listErr: errors.New("list failed")},
			level:   logrus.ErrorLevel,
			message: "orphan AlertRelabelConfig cleanup: failed to list AlertRelabelConfigs: list failed",
		},
		{
			name: "delete error",
			mock: &mockARCInterface{
				arcs: map[string]*osmv1.AlertRelabelConfig{
					"openshift-monitoring/arc-orphan": newARC("openshift-monitoring", "arc-orphan", "rule-gone", expiredOrphanMarker(), nil),
				},
				deleteErr: errors.New("delete failed"),
			},
			level:   logrus.ErrorLevel,
			message: "orphan AlertRelabelConfig cleanup: failed to delete AlertRelabelConfig openshift-monitoring/arc-orphan: delete failed",
		},
		{
			name: "GitOps orphan",
			mock: &mockARCInterface{
				arcs: map[string]*osmv1.AlertRelabelConfig{
					"openshift-monitoring/arc-gitops": newARC("openshift-monitoring", "arc-gitops", "rule-gone",
						map[string]string{"argocd.argoproj.io/tracking-id": "some-id"}, nil),
				},
			},
			level:   logrus.WarnLevel,
			message: "orphan AlertRelabelConfig cleanup: AlertRelabelConfig openshift-monitoring/arc-gitops (ruleId=rule-gone) is orphaned but GitOps-managed — skipping deletion, manual cleanup required",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			logger, hook := test.NewNullLogger()
			previousLog := log
			log = logrus.NewEntry(logger)
			t.Cleanup(func() { log = previousLog })

			rrm := &relabeledRulesManager{alertRelabelConfigs: tc.mock}
			rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})

			entries := hook.AllEntries()
			if len(entries) != 1 {
				t.Fatalf("expected one log entry, got %d: %v", len(entries), entries)
			}
			if entries[0].Level != tc.level || entries[0].Message != tc.message {
				t.Errorf("got %s log %q, want %s log %q", entries[0].Level, entries[0].Message, tc.level, tc.message)
			}
			if len(tc.mock.deleted) != 0 {
				t.Errorf("expected no deletions, got %v", tc.mock.deleted)
			}
		})
	}
}

func expiredOrphanMarker() map[string]string {
	return map[string]string{orphanedSinceAnnotation: time.Now().Add(-2 * orphanGracePeriod).UTC().Format(time.RFC3339Nano)}
}

func TestGCOrphanedARCs_GracePeriod(t *testing.T) {
	for _, marker := range []string{"", "invalid", time.Now().Add(time.Hour).UTC().Format(time.RFC3339Nano), time.Now().UTC().Format(time.RFC3339Nano)} {
		t.Run(marker, func(t *testing.T) {
			arc := newARC("openshift-monitoring", "arc-orphan", "rule-gone", map[string]string{orphanedSinceAnnotation: marker}, nil)
			mock := &mockARCInterface{arcs: map[string]*osmv1.AlertRelabelConfig{"openshift-monitoring/arc-orphan": arc}}
			rrm := &relabeledRulesManager{alertRelabelConfigs: mock}
			rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})
			if len(mock.deleted) != 0 {
				t.Fatal("deleted orphan before its grace period elapsed")
			}
			marked := mock.arcs["openshift-monitoring/arc-orphan"]
			if _, err := time.Parse(time.RFC3339Nano, marked.Annotations[orphanedSinceAnnotation]); err != nil {
				t.Fatalf("invalid orphan marker: %v", err)
			}
			rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{"rule-gone": {}})
			if _, exists := mock.arcs["openshift-monitoring/arc-orphan"].Annotations[orphanedSinceAnnotation]; exists {
				t.Fatal("orphan marker remained after rule returned")
			}
			if len(mock.deleted) != 0 {
				t.Fatal("deleted restored rule's configuration")
			}
		})
	}
}

type orphanGCQueue struct {
	workqueue.TypedRateLimitingInterface[string]
	keys   []string
	delays []time.Duration
}

func (q *orphanGCQueue) AddAfter(key string, delay time.Duration) {
	q.keys = append(q.keys, key)
	q.delays = append(q.delays, delay)
}

func TestGCOrphanedARCs_RequeuesGracePeriod(t *testing.T) {
	for _, updateErr := range []error{nil, errors.New("update failed")} {
		mock := &mockARCInterface{
			arcs:      map[string]*osmv1.AlertRelabelConfig{"openshift-monitoring/orphan": newARC("openshift-monitoring", "orphan", "gone", nil, nil)},
			updateErr: updateErr,
		}
		queue := &orphanGCQueue{}
		rrm := &relabeledRulesManager{alertRelabelConfigs: mock, queue: queue}
		rrm.gcOrphanedARCs(context.Background(), map[string]struct{}{})
		if len(queue.keys) != 1 || queue.keys[0] != relabeledRulesSyncKeyPrometheusRule || queue.delays[0] != orphanGracePeriod {
			t.Fatalf("expected a cleanup retry after the grace period, got %v %v", queue.keys, queue.delays)
		}
		if len(mock.deleted) != 0 {
			t.Fatal("deleted a newly orphaned configuration")
		}
	}
}
