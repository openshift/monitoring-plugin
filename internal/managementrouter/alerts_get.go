package managementrouter

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type GetAlertsResponse struct {
	Data     GetAlertsResponseData `json:"data"`
	Warnings []string              `json:"warnings,omitempty"`
}

type GetAlertsResponseData struct {
	Alerts []k8s.PrometheusAlert `json:"alerts"`
}

func (hr *httpRouter) GetAlerts(w http.ResponseWriter, req *http.Request) {
	state, labels, err := parseStateAndLabels(req.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := req.Context()

	alerts, err := hr.managementClient.GetAlerts(ctx, k8s.GetAlertsRequest{
		Labels: labels,
		State:  state,
	})
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(GetAlertsResponse{
		Data: GetAlertsResponseData{
			Alerts: alerts,
		},
		Warnings: hr.alertWarnings(ctx),
	}); err != nil {
		log.WithError(err).Warn("failed to encode alerts response")
	}
}

func (hr *httpRouter) alertWarnings(ctx context.Context) []string {
	health, ok := hr.alertingHealth(ctx)
	if !ok {
		return nil
	}

	warnings := []string{}
	if health.UserWorkloadEnabled && health.UserWorkload != nil {
		warnings = append(warnings, buildRouteWarnings(health.UserWorkload.Prometheus, k8s.UserWorkloadRouteName, "user workload Prometheus")...)
		warnings = append(warnings, buildRouteWarnings(health.UserWorkload.Alertmanager, k8s.UserWorkloadAlertmanagerRouteName, "user workload Alertmanager")...)
	}

	return warnings
}

//nolint:unused // used by the rules listing handler in a subsequent branch
func (hr *httpRouter) rulesWarnings(ctx context.Context) []string {
	health, ok := hr.alertingHealth(ctx)
	if !ok {
		return nil
	}

	if health.UserWorkloadEnabled && health.UserWorkload != nil {
		return buildRouteWarnings(health.UserWorkload.Prometheus, k8s.UserWorkloadRouteName, "user workload Prometheus")
	}

	return nil
}

func (hr *httpRouter) alertingHealth(ctx context.Context) (k8s.AlertingHealth, bool) {
	if hr.managementClient == nil {
		return k8s.AlertingHealth{}, false
	}

	health, err := hr.managementClient.GetAlertingHealth(ctx)
	if err != nil {
		log.WithError(err).Warn("alerting health unavailable")
		return k8s.AlertingHealth{}, false
	}

	return health, true
}

func buildRouteWarnings(route k8s.AlertingRouteHealth, expectedName string, friendlyName string) []string {
	if route.Name != "" && route.Name != expectedName {
		return nil
	}
	if route.FallbackReachable {
		return nil
	}

	switch route.Status {
	case k8s.RouteNotFound:
		return []string{friendlyName + " route is missing"}
	case k8s.RouteUnreachable:
		return []string{friendlyName + " route is unreachable"}
	default:
		return nil
	}
}
