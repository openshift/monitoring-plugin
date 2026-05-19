package management

import (
	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

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

func isRuleManagedByGitOpsLabel(relabeled monitoringv1.Rule) bool {
	if relabeled.Labels == nil {
		return false
	}
	return relabeled.Labels[managementlabels.RuleManagedByLabel] == managementlabels.ManagedByGitOps
}

func isRuleManagedByOperator(relabeled monitoringv1.Rule) bool {
	return relabeled.Labels != nil && relabeled.Labels[managementlabels.RuleManagedByLabel] == managementlabels.ManagedByOperator
}

func validateUserDeletePreconditions(relabeled monitoringv1.Rule) error {
	if isRuleManagedByGitOpsLabel(relabeled) {
		return notAllowedGitOpsRemove()
	}
	if isRuleManagedByOperator(relabeled) {
		return notAllowedOperatorDelete()
	}
	return nil
}

func validateUserUpdatePreconditions(relabeled monitoringv1.Rule, pr *monitoringv1.PrometheusRule) error {
	if isRuleManagedByGitOpsLabel(relabeled) {
		return notAllowedGitOpsEdit()
	}
	if isRuleManagedByOperator(relabeled) {
		return notAllowedOperatorUpdate()
	}
	if pr != nil {
		if _, operatorManaged := k8s.IsExternallyManagedObject(pr); operatorManaged {
			return notAllowedOperatorUpdate()
		}
	}
	return nil
}

func validatePlatformDeletePreconditions(ar *osmv1.AlertingRule) error {
	if ar != nil {
		if gitOpsManaged, operatorManaged := k8s.IsExternallyManagedObject(ar); gitOpsManaged {
			return notAllowedGitOpsRemove()
		} else if operatorManaged {
			return notAllowedOperatorDelete()
		}
	}
	return nil
}

// validateGitOpsPreconditions checks only GitOps-related constraints on the
// rule and its parent PrometheusRule. Used by UpdatePlatformAlertRule before
// the ARC is fetched — operator-managed rules are allowed to proceed because
// the ARC path handles them.
func validateGitOpsPreconditions(relabeled monitoringv1.Rule, pr *monitoringv1.PrometheusRule) error {
	if isRuleManagedByGitOpsLabel(relabeled) {
		return notAllowedGitOpsEdit()
	}
	if pr != nil {
		if gitOpsManaged, _ := k8s.IsExternallyManagedObject(pr); gitOpsManaged {
			return notAllowedGitOpsEdit()
		}
	}
	return nil
}

func validatePlatformUpdatePreconditions(relabeled monitoringv1.Rule, pr *monitoringv1.PrometheusRule, arc *osmv1.AlertRelabelConfig) error {
	if isRuleManagedByGitOpsLabel(relabeled) {
		return notAllowedGitOpsEdit()
	}
	if pr != nil {
		if gitOpsManaged, _ := k8s.IsExternallyManagedObject(pr); gitOpsManaged {
			return notAllowedGitOpsEdit()
		}
	}
	if arc != nil {
		if k8s.IsManagedByGitOps(arc.Annotations, arc.Labels) {
			return notAllowedGitOpsEdit()
		}
	}
	if isRuleManagedByOperator(relabeled) {
		return notAllowedOperatorUpdate()
	}
	if pr != nil {
		if _, operatorManaged := k8s.IsExternallyManagedObject(pr); operatorManaged {
			return notAllowedOperatorUpdate()
		}
	}
	if arc != nil {
		if _, operatorManaged := k8s.IsExternallyManagedObject(arc); operatorManaged {
			return notAllowedOperatorUpdate()
		}
	}
	return nil
}
