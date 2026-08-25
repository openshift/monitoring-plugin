package management

import (
	"strings"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

// PlatformUpdateTarget identifies which resource receives a platform label mutation.
type PlatformUpdateTarget int

const (
	PlatformUpdateTargetAlertRelabelConfig PlatformUpdateTarget = iota
	PlatformUpdateTargetAlertingRule
)

type platformMutationKind int

const (
	platformMutationLabel platformMutationKind = iota
	platformMutationClassification
)

// platformUpdateAllowance describes whether execute would permit a platform update.
type platformUpdateAllowance struct {
	Writable  bool
	ManagedBy ManagementSource
	Err       error
}

// evaluatePlatformUpdateAllowed mirrors execute-path ownership checks for one
// platform mutation target. Preview and UpdatePlatformAlertRule must use this
// helper so writable stays aligned with real writes.
func evaluatePlatformUpdateAllowed(
	relabeled monitoringv1.Rule,
	pr *monitoringv1.PrometheusRule,
	ar *osmv1.AlertingRule,
	arFound bool,
	arc *osmv1.AlertRelabelConfig,
	target PlatformUpdateTarget,
	kind platformMutationKind,
) platformUpdateAllowance {
	switch target {
	case PlatformUpdateTargetAlertingRule:
		if err := validateGitOpsPreconditions(relabeled, pr); err != nil {
			return allowanceFromPreconditionError(err)
		}
		if arFound && ar != nil {
			if gitOpsManaged, _ := k8s.IsExternallyManagedObject(ar); gitOpsManaged {
				return platformUpdateAllowance{
					Writable:  false,
					ManagedBy: ManagedByGitOps,
					Err:       notAllowedGitOpsEdit(),
				}
			}
		}
		return platformUpdateAllowance{Writable: true}

	case PlatformUpdateTargetAlertRelabelConfig:
		if kind == platformMutationClassification {
			// applyClassificationViaARC does not run ownership preconditions today.
			return platformUpdateAllowance{Writable: true}
		}
		if err := validatePlatformUpdatePreconditions(relabeled, nil, arc); err != nil {
			return allowanceFromPreconditionError(err)
		}
		return platformUpdateAllowance{Writable: true}

	default:
		return platformUpdateAllowance{Writable: true}
	}
}

func evaluatePlatformPreviewAllowance(
	relabeled monitoringv1.Rule,
	pr *monitoringv1.PrometheusRule,
	ar *osmv1.AlertingRule,
	arFound bool,
	arc *osmv1.AlertRelabelConfig,
	arcFound bool,
	route platformLabelRoute,
	classLabels map[string]string,
	filteredUser map[string]string,
) platformUpdateAllowance {
	result := platformUpdateAllowance{Writable: true}
	mergeAllowance := func(part platformUpdateAllowance) {
		if !part.Writable {
			result.Writable = false
		}
		if part.ManagedBy != "" && result.ManagedBy == "" {
			result.ManagedBy = part.ManagedBy
		}
		if part.Err != nil && result.Err == nil {
			result.Err = part.Err
		}
	}

	hasClass := len(classLabels) > 0
	hasUser := len(filteredUser) > 0
	arcRef := relabelConfigIfFound(arcFound, arc)

	if hasClass {
		mergeAllowance(evaluatePlatformUpdateAllowed(
			relabeled, pr, ar, arFound, arcRef,
			PlatformUpdateTargetAlertRelabelConfig, platformMutationClassification,
		))
	}
	if hasUser && route == platformLabelRouteAlertRelabelConfig {
		mergeAllowance(evaluatePlatformUpdateAllowed(
			relabeled, pr, ar, arFound, arcRef,
			PlatformUpdateTargetAlertRelabelConfig, platformMutationLabel,
		))
	}
	if hasUser && route == platformLabelRouteAlertingRule {
		mergeAllowance(evaluatePlatformUpdateAllowed(
			relabeled, pr, ar, arFound, nil,
			PlatformUpdateTargetAlertingRule, platformMutationLabel,
		))
	}
	if !hasClass && !hasUser {
		mergeAllowance(evaluatePlatformUpdateAllowed(
			relabeled, pr, ar, arFound, arcRef,
			PlatformUpdateTargetAlertRelabelConfig, platformMutationLabel,
		))
	}
	return result
}

func allowanceFromPreconditionError(err error) platformUpdateAllowance {
	if err == nil {
		return platformUpdateAllowance{Writable: true}
	}
	allowance := platformUpdateAllowance{Writable: false, Err: err}
	if na, ok := err.(*NotAllowedError); ok {
		switch {
		case strings.Contains(na.Message, "GitOps"):
			allowance.ManagedBy = ManagedByGitOps
		case strings.Contains(na.Message, "operator"):
			allowance.ManagedBy = ManagedByOperator
		}
	}
	return allowance
}
