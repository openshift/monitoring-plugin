package management

import (
	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func notAllowedGitOpsRemove() error {
	return &NotAllowedError{Message: "This alert is managed by GitOps; remove it in Git."}
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
