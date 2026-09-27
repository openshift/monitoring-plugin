package management

import (
	osmv1 "github.com/openshift/api/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type platformLabelRoute int

const (
	platformLabelRouteAlertRelabelConfig platformLabelRoute = iota
	platformLabelRouteAlertingRule
)

// resolvePlatformLabelRoute mirrors UpdatePlatformAlertRule label routing.
func resolvePlatformLabelRoute(ar *osmv1.AlertingRule, arFound bool) platformLabelRoute {
	if arFound && ar != nil {
		_, operatorManaged := k8s.IsExternallyManagedObject(ar)
		if operatorManaged {
			return platformLabelRouteAlertRelabelConfig
		}
		return platformLabelRouteAlertingRule
	}
	return platformLabelRouteAlertRelabelConfig
}
