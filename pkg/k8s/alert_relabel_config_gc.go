package k8s

import (
	"context"

	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// gcOrphanedARCs deletes AlertRelabelConfigs whose associated alert rule no
// longer exists. This handles the case where an operator (or manual action)
// removes rules from a PrometheusRule or deletes the CR entirely — the ARCs
// that were created by the plugin for classification/drop/stamp become orphans.
//
// Only ARCs carrying the plugin's alertRuleId annotation are considered.
// GitOps-managed ARCs are never deleted automatically; a warning is logged
// so that operators can clean them up manually.
//
// liveRuleIDs must include every alerting-rule ID still present on a
// PrometheusRule, including platform rules dropped by relabel configs.
// IDs are recorded in collectAlerts before the drop continue, so a Drop
// ARC for a disabled rule is not treated as an orphan.
func (rrm *relabeledRulesManager) gcOrphanedARCs(ctx context.Context, liveRuleIDs map[string]struct{}) {
	if rrm.alertRelabelConfigs == nil {
		return
	}

	arcs, err := rrm.alertRelabelConfigs.List(ctx, "")
	if err != nil {
		log.Errorf("orphan AlertRelabelConfig cleanup: failed to list AlertRelabelConfigs: %v", err)
		return
	}

	for i := range arcs {
		arc := &arcs[i]

		ruleID, ok := arc.Annotations[managementlabels.ARCAnnotationAlertRuleIDKey]
		if !ok || ruleID == "" {
			continue
		}

		if _, alive := liveRuleIDs[ruleID]; alive {
			continue
		}

		if IsManagedByGitOps(arc.Annotations, arc.Labels) {
			log.Warnf("orphan AlertRelabelConfig cleanup: AlertRelabelConfig %s/%s (ruleId=%s) is orphaned but GitOps-managed — skipping deletion, manual cleanup required", arc.Namespace, arc.Name, ruleID)
			continue
		}

		if err := rrm.alertRelabelConfigs.Delete(ctx, arc.Namespace, arc.Name); err != nil {
			log.Errorf("orphan AlertRelabelConfig cleanup: failed to delete AlertRelabelConfig %s/%s: %v", arc.Namespace, arc.Name, err)
			continue
		}

		log.Infof("orphan AlertRelabelConfig cleanup: deleted orphaned AlertRelabelConfig %s/%s (ruleId=%s)", arc.Namespace, arc.Name, ruleID)
	}
}
