package management

import (
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// isProtectedLabel returns true for labels we will not modify via ARC for platform rules.
// These carry provenance or rule identity and must remain intact.
var protectedLabels = map[string]bool{
	managementlabels.AlertNameLabel: true,
	k8s.AlertRuleLabelId:   true,
}

func isProtectedLabel(label string) bool {
	return protectedLabels[label]
}

// isValidSeverity validates allowed severity values.
var validSeverities = map[string]bool{
	"critical": true,
	"warning":  true,
	"info":     true,
	"none":     true,
}

func isValidSeverity(s string) bool {
	return validSeverities[s]
}
