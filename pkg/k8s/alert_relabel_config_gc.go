package k8s

import (
	"context"
	"os"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

const (
	orphanedSinceAnnotation = "monitoring.openshift.io/orphaned-since"
	// Allow temporarily removed rules to return before deleting their configs.
	// Cleanup schedules its own retry, independently of informer resyncs.
	orphanGracePeriod = 15 * time.Minute
)

// isMetricsLeader reports whether this replica holds the Lease used by the
// alert-management metrics collector. When the Lease does not exist, leader
// election is not running (alert management is disabled) and every replica
// is allowed to run the cleanup.
func (rrm *relabeledRulesManager) isMetricsLeader(ctx context.Context) (bool, error) {
	if rrm.clientset == nil {
		return true, nil
	}

	lease, err := rrm.clientset.CoordinationV1().Leases(ClusterMonitoringNamespace).Get(ctx, MetricsLeaderLeaseName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return true, nil
		}
		return false, err
	}

	holder := ""
	if lease.Spec.HolderIdentity != nil {
		holder = *lease.Spec.HolderIdentity
	}
	if holder == "" {
		// The election has not converged yet; keep the historical behavior
		// of running the cleanup on every replica.
		return true, nil
	}

	hostname, err := os.Hostname()
	if err != nil {
		return false, err
	}
	return holder == hostname, nil
}

// gcOrphanedARCs deletes AlertRelabelConfigs whose associated alert rule no
// longer exists after a grace period. This handles the case where an
// operator (or manual action) removes rules from a PrometheusRule or deletes
// the CR entirely. AlertRelabelConfigs created by the plugin for
// classification/drop/stamp become orphans.
//
// Only AlertRelabelConfigs carrying the plugin's alertRuleId annotation
// are considered. GitOps-managed configs are never deleted automatically;
// a warning is logged so that operators can clean them up manually.
//
// When the alert-management metrics leader election is running, only the
// lease holder performs the cleanup so replicas do not double-count the
// cleanup metrics or race on deletions.
//
// liveRuleIDs must include every alerting-rule ID still present on a
// PrometheusRule, including platform rules dropped by relabel configs.
// IDs are recorded in collectAlerts before the drop continue, so a Drop
// AlertRelabelConfig for a disabled rule is not treated as an orphan.
func (rrm *relabeledRulesManager) gcOrphanedARCs(ctx context.Context, liveRuleIDs map[string]struct{}) {
	leader, err := rrm.isMetricsLeader(ctx)
	if err != nil {
		// Keep cleaning up rather than stalling on a transient Lease read.
		log.Warnf("orphan AlertRelabelConfig cleanup: cannot determine the metrics leader, running on every replica: %v", err)
	} else if !leader {
		log.Debugf("orphan AlertRelabelConfig cleanup: skipped on this replica, only the metrics leader cleans up")
		return
	}

	metrics := rrm.gcMetrics
	metrics.observeList()
	arcs, err := rrm.alertRelabelConfigs.List(ctx, "")
	if err != nil {
		metrics.observeListError()
		log.Errorf("orphan AlertRelabelConfig cleanup: failed to list AlertRelabelConfigs: %v", err)
		return
	}

	gitOpsOrphans := 0
	for i := range arcs {
		arc := &arcs[i]

		ruleID, ok := arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey]
		if !ok || ruleID == "" {
			continue
		}

		if _, alive := liveRuleIDs[ruleID]; alive {
			if _, marked := arc.Annotations[orphanedSinceAnnotation]; marked && !IsManagedByGitOps(arc.Annotations, arc.Labels) {
				updated := arc.DeepCopy()
				delete(updated.Annotations, orphanedSinceAnnotation)
				if err := rrm.alertRelabelConfigs.Update(ctx, *updated); err != nil {
					log.Errorf("orphan AlertRelabelConfig cleanup: failed to clear orphan marker on %s/%s: %v", arc.Namespace, arc.Name, err)
				}
			}
			continue
		}

		if IsManagedByGitOps(arc.Annotations, arc.Labels) {
			gitOpsOrphans++
			log.Warnf("orphan AlertRelabelConfig cleanup: AlertRelabelConfig %s/%s (ruleId=%s) is orphaned but GitOps-managed - skipping deletion, manual cleanup required", arc.Namespace, arc.Name, ruleID)
			continue
		}

		now := time.Now()
		orphanedSince, parseErr := time.Parse(time.RFC3339Nano, arc.Annotations[orphanedSinceAnnotation])
		if parseErr != nil || orphanedSince.After(now) {
			updated := arc.DeepCopy()
			updated.Annotations[orphanedSinceAnnotation] = now.UTC().Format(time.RFC3339Nano)
			if err := rrm.alertRelabelConfigs.Update(ctx, *updated); err != nil {
				log.Errorf("orphan AlertRelabelConfig cleanup: failed to mark orphan %s/%s: %v", arc.Namespace, arc.Name, err)
			}
			orphanedSince = now
		}
		if remaining := orphanGracePeriod - now.Sub(orphanedSince); remaining > 0 {
			rrm.queue.AddAfter(relabeledRulesSyncKeyPrometheusRule, remaining)
			continue
		}

		metrics.observeDelete()
		if err := rrm.alertRelabelConfigs.Delete(ctx, arc.Namespace, arc.Name); err != nil {
			if apierrors.IsNotFound(err) {
				// Already removed, e.g. by another replica or an operator;
				// there is nothing left to clean up and no failure to count.
				log.Infof("orphan AlertRelabelConfig cleanup: AlertRelabelConfig %s/%s was already deleted", arc.Namespace, arc.Name)
				continue
			}
			metrics.observeDeleteError()
			log.Errorf("orphan AlertRelabelConfig cleanup: failed to delete AlertRelabelConfig %s/%s: %v", arc.Namespace, arc.Name, err)
			continue
		}

		log.Infof("orphan AlertRelabelConfig cleanup: deleted orphaned AlertRelabelConfig %s/%s (ruleId=%s)", arc.Namespace, arc.Name, ruleID)
	}
	metrics.setGitOpsOrphans(float64(gitOpsOrphans))
}
