package management

import (
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	osmv1 "github.com/openshift/api/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// Standardized NotAllowed errors
func notAllowedGitOpsEdit() error {
	return &NotAllowedError{Message: "This alert is managed by GitOps; edit it in Git."}
}
func notAllowedGitOpsRemove() error {
	return &NotAllowedError{Message: "This alert is managed by GitOps; remove it in Git."}
}
func notAllowedOperatorUpdate() error {
	return &NotAllowedError{Message: "This alert is managed by an operator; it can't be updated and can only be silenced."}
}
func notAllowedOperatorDelete() error {
	return &NotAllowedError{Message: "This alert is managed by an operator; it can't be deleted and can only be silenced."}
}

// isRuleManagedByGitOpsLabel returns true if the relabeled rule indicates GitOps management via its managed-by label.
func isRuleManagedByGitOpsLabel(relabeled monitoringv1.Rule) bool {
	if relabeled.Labels == nil {
		return false
	}
	return relabeled.Labels[managementlabels.RuleManagedByLabel] == managementlabels.ManagedByGitOps
}

// isRuleManagedByOperator returns true if the relabeled rule indicates operator management via its managed-by label.
func isRuleManagedByOperator(relabeled monitoringv1.Rule) bool {
	return relabeled.Labels != nil && relabeled.Labels[managementlabels.RuleManagedByLabel] == managementlabels.ManagedByOperator
}

// validateUserDeletePreconditions enforces common label-based constraints for user-source delete.
func validateUserDeletePreconditions(relabeled monitoringv1.Rule) error {
	if isRuleManagedByGitOpsLabel(relabeled) {
		return notAllowedGitOpsRemove()
	}
	if isRuleManagedByOperator(relabeled) {
		return notAllowedOperatorDelete()
	}
	return nil
}

// validateUserUpdatePreconditions enforces common constraints for user-source update.
func validateUserUpdatePreconditions(relabeled monitoringv1.Rule, pr *monitoringv1.PrometheusRule) error {
	if isRuleManagedByGitOpsLabel(relabeled) {
		return notAllowedGitOpsEdit()
	}
	if isRuleManagedByOperator(relabeled) {
		return notAllowedOperatorUpdate()
	}
	// Authoritative operator-managed check on PR owner references if provided
	if pr != nil {
		if _, operatorManaged := k8s.IsExternallyManagedObject(pr); operatorManaged {
			return notAllowedOperatorUpdate()
		}
	}
	return nil
}

// validatePlatformDeletePreconditions enforces constraints before mutating the owning AlertingRule.
func validatePlatformDeletePreconditions(ar *osmv1.AlertingRule) error {
	// Block if owning AR is externally managed (GitOps or operator)
	if ar != nil {
		if gitOpsManaged, operatorManaged := k8s.IsExternallyManagedObject(ar); gitOpsManaged {
			return notAllowedGitOpsRemove()
		} else if operatorManaged {
			return notAllowedOperatorDelete()
		}
	}
	return nil
}

// validatePlatformUpdatePreconditions enforces constraints before ARC-based update.
// pr may be nil if not fetched yet; arc may be nil if absent.
func validatePlatformUpdatePreconditions(relabeled monitoringv1.Rule, pr *monitoringv1.PrometheusRule, arc *osmv1.AlertRelabelConfig) error {
	// Rule-level GitOps block
	if isRuleManagedByGitOpsLabel(relabeled) {
		return notAllowedGitOpsEdit()
	}
	// PR metadata GitOps block
	if pr != nil {
		if gitOpsManaged, _ := k8s.IsExternallyManagedObject(pr); gitOpsManaged {
			return notAllowedGitOpsEdit()
		}
	}
	// ARC metadata GitOps block
	if arc != nil && k8s.IsManagedByGitOps(arc.Annotations, arc.Labels) {
		return notAllowedGitOpsEdit()
	}
	return nil
}
