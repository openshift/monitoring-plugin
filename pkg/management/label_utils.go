package management

import (
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

var protectedLabels = map[string]bool{
	managementlabels.AlertNameLabel: true,
	k8s.AlertRuleLabelId:            true,
}

func isProtectedLabel(label string) bool {
	return protectedLabels[label]
}

var validSeverities = map[string]bool{
	"critical": true,
	"warning":  true,
	"info":     true,
	"none":     true,
}

func isValidSeverity(s string) bool {
	return validSeverities[s]
}
