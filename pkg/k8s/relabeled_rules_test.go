package k8s

import (
	"context"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// arcGetPanicInterface implements AlertRelabelConfigInterface and panics if
// Get is called. It is used to verify that the sync path never calls Get.
type arcGetPanicInterface struct {
	arcs []osmv1.AlertRelabelConfig
}

func (m *arcGetPanicInterface) List(_ context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
	if namespace == "" {
		return m.arcs, nil
	}
	var filtered []osmv1.AlertRelabelConfig
	for _, a := range m.arcs {
		if a.Namespace == namespace {
			filtered = append(filtered, a)
		}
	}
	return filtered, nil
}

func (m *arcGetPanicInterface) Get(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
	panic("Get must not be called during sync; use the arcByName cache map instead")
}

func (m *arcGetPanicInterface) Create(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
	return &arc, nil
}

func (m *arcGetPanicInterface) Update(_ context.Context, _ osmv1.AlertRelabelConfig) error {
	return nil
}

func (m *arcGetPanicInterface) Delete(_ context.Context, _, _ string) error {
	return nil
}

// stubNamespaceManager implements NamespaceInterface for tests.
type stubNamespaceManager struct {
	platformNamespaces map[string]bool
}

func (s *stubNamespaceManager) IsClusterMonitoringNamespace(name string) bool {
	return s.platformNamespaces[name]
}

// TestDetermineManagedBy_NeverCallsGet verifies that determineManagedBy
// uses the pre-fetched arcByName map and never issues a live Get call,
// even for platform-namespace rules with a matching ARC.
func TestDetermineManagedBy_NeverCallsGet(t *testing.T) {
	const (
		namespace    = "openshift-monitoring"
		promRuleName = "test-rule"
		alertRuleID  = "abc123"
	)

	arcName := GetAlertRelabelConfigName(promRuleName, alertRuleID)
	arc := osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      arcName,
			Annotations: map[string]string{
				"argocd.argoproj.io/managed-by": "some-app",
			},
		},
	}

	rrm := &relabeledRulesManager{
		// arcGetPanicInterface panics if Get is called — this is the guard.
		alertRelabelConfigs: &arcGetPanicInterface{arcs: []osmv1.AlertRelabelConfig{arc}},
		namespaceManager: &stubNamespaceManager{
			platformNamespaces: map[string]bool{namespace: true},
		},
	}

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      promRuleName,
		},
	}

	// Build arcByName from List (no Get call).
	arcByName := rrm.arcsByName(context.Background())

	// This must not panic (i.e. must not call Get).
	ruleManagedBy, relabelConfigManagedBy := rrm.determineManagedBy(promRule, alertRuleID, arcByName)

	if ruleManagedBy != "" {
		t.Errorf("expected empty ruleManagedBy, got %q", ruleManagedBy)
	}
	if relabelConfigManagedBy != managementlabels.ManagedByGitOps {
		t.Errorf("expected relabelConfigManagedBy=%q, got %q", managementlabels.ManagedByGitOps, relabelConfigManagedBy)
	}
}

// TestDetermineManagedBy_NoARCMatch verifies that a platform rule with no
// matching ARC in the cache produces empty relabelConfigManagedBy.
func TestDetermineManagedBy_NoARCMatch(t *testing.T) {
	const namespace = "openshift-monitoring"

	rrm := &relabeledRulesManager{
		alertRelabelConfigs: &arcGetPanicInterface{arcs: nil},
		namespaceManager: &stubNamespaceManager{
			platformNamespaces: map[string]bool{namespace: true},
		},
	}

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      "some-rule",
		},
	}

	arcByName := rrm.arcsByName(context.Background())
	_, relabelConfigManagedBy := rrm.determineManagedBy(promRule, "no-match-id", arcByName)

	if relabelConfigManagedBy != "" {
		t.Errorf("expected empty relabelConfigManagedBy for no ARC match, got %q", relabelConfigManagedBy)
	}
}

// TestDetermineManagedBy_NonPlatformRuleSkipsARCLookup verifies that a
// user-workload rule (non-platform namespace) does not consult ARCs at all.
func TestDetermineManagedBy_NonPlatformRuleSkipsARCLookup(t *testing.T) {
	rrm := &relabeledRulesManager{
		// Non-nil but panics on Get — confirms no lookup occurs.
		alertRelabelConfigs: &arcGetPanicInterface{arcs: nil},
		namespaceManager:    &stubNamespaceManager{platformNamespaces: map[string]bool{}},
	}

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "user-namespace",
			Name:      "user-rule",
		},
	}

	arcByName := rrm.arcsByName(context.Background())
	_, relabelConfigManagedBy := rrm.determineManagedBy(promRule, "some-id", arcByName)

	if relabelConfigManagedBy != "" {
		t.Errorf("expected empty relabelConfigManagedBy for non-platform rule, got %q", relabelConfigManagedBy)
	}
}
