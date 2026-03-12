package k8s

import (
	"context"
	"time"

	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

const (
	orphanedSinceAnnotation = "monitoring.openshift.io/orphaned-since"
	orphanGracePeriod       = resyncPeriod
)

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
// liveRuleIDs must include every alerting-rule ID still present on a
// PrometheusRule, including platform rules dropped by relabel configs.
// IDs are recorded in collectAlerts before the drop continue, so a Drop
// AlertRelabelConfig for a disabled rule is not treated as an orphan.
func (rrm *relabeledRulesManager) gcOrphanedARCs(ctx context.Context, liveRuleIDs map[string]struct{}) {
	if rrm.alertRelabelConfigs == nil {
		return
	}

	metrics := rrm.gcMetrics
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
			log.Warnf("orphan AlertRelabelConfig cleanup: AlertRelabelConfig %s/%s (ruleId=%s) is orphaned but GitOps-managed — skipping deletion, manual cleanup required", arc.Namespace, arc.Name, ruleID)
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
			if rrm.queue != nil {
				rrm.queue.AddAfter(relabeledRulesSyncKeyPrometheusRule, remaining)
			}
			continue
		}

		if err := rrm.alertRelabelConfigs.Delete(ctx, arc.Namespace, arc.Name); err != nil {
			metrics.observeDeleteError()
			log.Errorf("orphan AlertRelabelConfig cleanup: failed to delete AlertRelabelConfig %s/%s: %v", arc.Namespace, arc.Name, err)
			continue
		}

		log.Infof("orphan AlertRelabelConfig cleanup: deleted orphaned AlertRelabelConfig %s/%s (ruleId=%s)", arc.Namespace, arc.Name, ruleID)
	}
	metrics.setGitOpsOrphans(float64(gitOpsOrphans))
}
