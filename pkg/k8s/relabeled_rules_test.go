package k8s

import (
	"context"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/relabel"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/tools/cache"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
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

// TestCollectAlerts_DroppedPlatformRuleRetainedWithID verifies that a
// platform rule dropped by the relabel configs is retained in the cache
// with its computed rule ID and a dropped marker, and that List() keeps
// hiding it from alert-facing consumers while ListIncludingDropped()
// exposes it to the rules API.
func TestCollectAlerts_DroppedPlatformRuleRetainedWithID(t *testing.T) {
	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "openshift-monitoring",
			Name:      "platform-rules",
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{{
				Name: "group-a",
				Rules: []monitoringv1.Rule{{
					Alert: "DroppedAlert",
					Expr:  intstr.FromString("up == 0"),
					Labels: map[string]string{
						"severity": "warning",
					},
				}},
			}},
		},
	}

	// Seed the informer store directly; the list/watch funcs must never run.
	panicListWatch := &cache.ListWatch{
		ListFunc: func(_ metav1.ListOptions) (runtime.Object, error) {
			panic("list must not be called; the store is seeded directly")
		},
		WatchFunc: func(_ metav1.ListOptions) (watch.Interface, error) {
			panic("watch must not be called; the store is seeded directly")
		},
	}
	prometheusRulesInformer := cache.NewSharedIndexInformer(
		panicListWatch, &monitoringv1.PrometheusRule{}, resyncPeriod, cache.Indexers{},
	)
	if err := prometheusRulesInformer.GetStore().Add(promRule); err != nil {
		t.Fatalf("failed to seed informer store: %v", err)
	}

	dropByAlertName := []*relabel.Config{{
		SourceLabels:         model.LabelNames{managementlabels.AlertNameLabel},
		Regex:                relabel.MustNewRegexp("DroppedAlert"),
		Action:               relabel.Drop,
		NameValidationScheme: model.UTF8Validation,
	}}

	rrm := &relabeledRulesManager{
		namespaceManager: &stubNamespaceManager{
			platformNamespaces: map[string]bool{"openshift-monitoring": true},
		},
		alertRelabelConfigs:     &arcGetPanicInterface{},
		prometheusRulesInformer: prometheusRulesInformer,
		relabeledRules:          map[string]monitoringv1.Rule{},
	}

	alerts, _ := rrm.collectAlerts(context.Background(), dropByAlertName)

	expectedID := alertrule.GetAlertingRuleId(&promRule.Spec.Groups[0].Rules[0])
	cached, ok := alerts[expectedID]
	if !ok {
		t.Fatalf("expected dropped rule %q to be retained in the cache", expectedID)
	}

	if !IsDroppedRule(cached.Labels) {
		t.Errorf("expected retained rule to carry the dropped marker, labels: %v", cached.Labels)
	}
	if got := cached.Labels[AlertRuleLabelId]; got != expectedID {
		t.Errorf("label[%s]: want %q, got %q", AlertRuleLabelId, expectedID, got)
	}
	if got := cached.Labels[PrometheusRuleLabelNamespace]; got != "openshift-monitoring" {
		t.Errorf("label[%s]: want %q, got %q", PrometheusRuleLabelNamespace, "openshift-monitoring", got)
	}
	if got := cached.Labels[PrometheusRuleLabelName]; got != "platform-rules" {
		t.Errorf("label[%s]: want %q, got %q", PrometheusRuleLabelName, "platform-rules", got)
	}
	if got := cached.Labels["severity"]; got != "warning" {
		t.Errorf("label[severity]: want %q, got %q", "warning", got)
	}

	// Alert-facing consumers (get_alerts.go) must not see the dropped rule.
	rrm.relabeledRules = alerts
	if got := rrm.List(context.Background()); len(got) != 0 {
		t.Errorf("expected List() to exclude the dropped rule, got %d entries", len(got))
	}
	// The rules API must still resolve the dropped rule's identity.
	if got := rrm.ListIncludingDropped(context.Background()); len(got) != 1 {
		t.Errorf("expected ListIncludingDropped() to return the dropped rule, got %d entries", len(got))
	}
}
