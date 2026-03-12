//go:build e2e

package e2e

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

const (
	orphanARCGCPollInterval = time.Second
	orphanARCGCPollTimeout  = 2 * time.Minute
	orphanARCGCOpTimeout    = 20 * time.Second
	orphanARCGCTestTimeout  = 10 * time.Minute
)

// TestOrphanAlertRelabelConfigGC creates plugin-owned AlertRelabelConfigs
// and a PrometheusRule, then waits for a PrometheusRule-driven sync to
// delete the orphan while keeping live, GitOps-managed, and unannotated ARCs.
func TestOrphanAlertRelabelConfigGC(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), orphanARCGCTestTimeout)
	defer cancel()

	// Cluster-monitoring namespace so GET /rules can see the live rule
	// (e2e-management-api does not enable user-workload monitoring).
	testNamespace, cleanup, err := f.CreatePlatformNamespace(ctx, "test-orphan-arc-gc")
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer func() {
		if err := cleanup(); err != nil {
			t.Logf("cleanup failed: %v", err)
		}
	}()

	alertName := "E2EOrphanARCGCLive"
	forDuration := monitoringv1.Duration("5m")
	liveRule := monitoringv1.Rule{
		Alert: alertName,
		Expr:  intstr.FromString(`absent(nonexistent{e2e_test="orphan_arc_gc_live"})`),
		For:   &forDuration,
		Labels: map[string]string{
			"severity": "none",
			"e2e_test": "orphan_arc_gc",
		},
	}

	promRule, err := createPrometheusRule(ctx, f, testNamespace, liveRule)
	if err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	var liveRuleID string
	err = framework.PollWithContext(ctx, orphanARCGCPollInterval, orphanARCGCPollTimeout, func(pollCtx context.Context) error {
		rules, listErr := listRules(pollCtx, f)
		if listErr != nil {
			return fmt.Errorf("list rules: %w", listErr)
		}
		id, found := alertRuleIDByName(rules, alertName)
		if !found {
			return fmt.Errorf("alert %s not in GET /rules yet", alertName)
		}
		liveRuleID = id
		return nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for live rule to appear: %v", err)
	}

	idSuffix := fmt.Sprintf("%d", time.Now().UnixNano())
	orphanName := "e2e-ogc-orphan-" + idSuffix
	liveName := "e2e-ogc-live-" + idSuffix
	gitopsName := "e2e-ogc-gitops-" + idSuffix
	manualName := "e2e-ogc-manual-" + idSuffix
	orphanRuleID := "e2e-orphan-gc-missing-" + idSuffix
	gitopsRuleID := "e2e-orphan-gc-gitops-" + idSuffix

	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), orphanARCGCOpTimeout)
		defer cleanupCancel()
		for _, name := range []string{orphanName, liveName, gitopsName, manualName} {
			if delErr := deleteAlertRelabelConfig(cleanupCtx, f, name); delErr != nil {
				t.Logf("cleanup ARC %s: %v", name, delErr)
			}
		}
	})

	if err := createAlertRelabelConfig(ctx, f, orphanName, map[string]string{
		managementlabels.ARCAnnotationAlertRuleIDKey: orphanRuleID,
	}, nil); err != nil {
		t.Fatalf("Failed to create orphan ARC: %v", err)
	}
	if err := createAlertRelabelConfig(ctx, f, liveName, map[string]string{
		managementlabels.ARCAnnotationAlertRuleIDKey: liveRuleID,
	}, nil); err != nil {
		t.Fatalf("Failed to create live ARC: %v", err)
	}

	var baseline float64
	err = framework.PollWithContext(ctx, orphanARCGCPollInterval, orphanARCGCOpTimeout, func(pollCtx context.Context) error {
		var metricErr error
		baseline, metricErr = gitOpsOrphanCount(pollCtx, f)
		return metricErr
	})
	if err != nil {
		t.Fatalf("Failed to read GitOps orphan baseline: %v", err)
	}

	if err := createAlertRelabelConfig(ctx, f, gitopsName, map[string]string{
		managementlabels.ARCAnnotationAlertRuleIDKey: gitopsRuleID,
		"argocd.argoproj.io/tracking-id":             "e2e-orphan-arc-gc",
	}, nil); err != nil {
		t.Fatalf("Failed to create GitOps ARC: %v", err)
	}
	if err := createAlertRelabelConfig(ctx, f, manualName, nil, nil); err != nil {
		t.Fatalf("Failed to create unannotated ARC: %v", err)
	}

	if err := triggerOrphanARCGC(ctx, f, testNamespace, promRule.Name, idSuffix); err != nil {
		t.Fatalf("Failed to trigger GC: %v", err)
	}
	err = framework.PollWithContext(ctx, orphanARCGCPollInterval, orphanARCGCOpTimeout, func(pollCtx context.Context) error {
		arc, getErr := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Get(pollCtx, orphanName, metav1.GetOptions{})
		if getErr != nil {
			return getErr
		}
		if arc.Annotations["monitoring.openshift.io/orphaned-since"] == "" {
			if err := triggerOrphanARCGC(pollCtx, f, testNamespace, promRule.Name, fmt.Sprintf("%s-mark-%d", idSuffix, time.Now().UnixNano())); err != nil {
				return err
			}
			return fmt.Errorf("orphan has not been marked yet")
		}
		// Preserve the first-pass assertion without waiting 15 minutes in CI.
		arc.Annotations["monitoring.openshift.io/orphaned-since"] = time.Now().Add(-30 * time.Minute).UTC().Format(time.RFC3339Nano)
		_, updateErr := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Update(pollCtx, arc, metav1.UpdateOptions{})
		return updateErr
	})
	if err != nil {
		t.Fatalf("Failed to age the preserved orphan: %v", err)
	}
	if err := triggerOrphanARCGC(ctx, f, testNamespace, promRule.Name, idSuffix+"-expired"); err != nil {
		t.Fatalf("Failed to trigger expired orphan cleanup: %v", err)
	}

	err = framework.PollWithContext(ctx, orphanARCGCPollInterval, orphanARCGCPollTimeout, func(pollCtx context.Context) error {
		exists, existsErr := alertRelabelConfigExists(pollCtx, f, orphanName)
		if existsErr != nil {
			return existsErr
		}
		if exists {
			// Retry the trigger in case the ARC informer had not observed the
			// aged marker when the previous rule update was processed.
			if err := triggerOrphanARCGC(pollCtx, f, testNamespace, promRule.Name, fmt.Sprintf("%s-expired-%d", idSuffix, time.Now().UnixNano())); err != nil {
				return err
			}
			return fmt.Errorf("orphan ARC %s still present", orphanName)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for orphan ARC GC: %v", err)
	}

	for _, keeper := range []string{liveName, gitopsName, manualName} {
		exists, existsErr := alertRelabelConfigExists(ctx, f, keeper)
		if existsErr != nil {
			t.Fatalf("Failed to get keeper ARC %s: %v", keeper, existsErr)
		}
		if !exists {
			t.Errorf("keeper ARC %s was deleted", keeper)
		}
	}
	err = framework.PollWithContext(ctx, orphanARCGCPollInterval, orphanARCGCOpTimeout, func(pollCtx context.Context) error {
		count, metricErr := gitOpsOrphanCount(pollCtx, f)
		if metricErr != nil {
			return metricErr
		}
		if count < baseline+1 {
			return fmt.Errorf("GitOps orphan count %g, want at least %g", count, baseline+1)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("GitOps orphan gauge did not increase: %v", err)
	}
}

func alertRuleIDByName(rules []k8s.PrometheusRule, alertName string) (string, bool) {
	for _, rule := range rules {
		if rule.Name != alertName {
			continue
		}
		id := rule.Labels[k8s.AlertRuleLabelId]
		if id == "" {
			return "", false
		}
		return id, true
	}
	return "", false
}

func createAlertRelabelConfig(ctx context.Context, f *framework.Framework, name string, annotations, labels map[string]string) error {
	arc := &osmv1.AlertRelabelConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   k8s.ClusterMonitoringNamespace,
			Annotations: annotations,
			Labels:      labels,
		},
		Spec: osmv1.AlertRelabelConfigSpec{
			Configs: []osmv1.RelabelConfig{
				{
					SourceLabels: []osmv1.LabelName{"alertname"},
					Regex:        "E2EOrphanARCGCNeverMatch",
					TargetLabel:  "e2e_orphan_gc",
					Replacement:  "test",
					Action:       "Replace",
				},
			},
		},
	}

	return framework.PollWithContext(ctx, time.Second, orphanARCGCOpTimeout, func(pollCtx context.Context) error {
		_, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Create(
			pollCtx, arc, metav1.CreateOptions{},
		)
		if err == nil || apierrors.IsAlreadyExists(err) {
			return nil
		}
		return err
	})
}

func deleteAlertRelabelConfig(ctx context.Context, f *framework.Framework, name string) error {
	err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Delete(
		ctx, name, metav1.DeleteOptions{},
	)
	if err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	return nil
}

func alertRelabelConfigExists(ctx context.Context, f *framework.Framework, name string) (bool, error) {
	_, err := f.Osmv1clientset.MonitoringV1().AlertRelabelConfigs(k8s.ClusterMonitoringNamespace).Get(
		ctx, name, metav1.GetOptions{},
	)
	if apierrors.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func triggerOrphanARCGC(ctx context.Context, f *framework.Framework, namespace, name, marker string) error {
	return framework.PollWithContext(ctx, orphanARCGCPollInterval, orphanARCGCOpTimeout, func(pollCtx context.Context) error {
		current, getErr := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(namespace).Get(
			pollCtx, name, metav1.GetOptions{},
		)
		if getErr != nil {
			return getErr
		}
		if current.Annotations == nil {
			current.Annotations = map[string]string{}
		}
		current.Annotations["e2e.monitoring.openshift.io/gc-sync"] = marker
		_, updateErr := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(namespace).Update(
			pollCtx, current, metav1.UpdateOptions{},
		)
		return updateErr
	})
}

func gitOpsOrphanCount(ctx context.Context, f *framework.Framework) (float64, error) {
	body, err := fetchMetrics(ctx, f)
	if err != nil {
		return 0, err
	}
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, k8s.MetricAlertRelabelConfigGitOpsOrphans+" ") {
			return parseGaugeValue(line)
		}
	}
	return 0, fmt.Errorf("GitOps orphan gauge is missing")
}
