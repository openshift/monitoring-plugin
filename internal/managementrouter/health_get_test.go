package managementrouter_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func sampleAlertingHealth() k8s.AlertingHealth {
	return k8s.AlertingHealth{
		Platform: &k8s.AlertingStackHealth{
			Prometheus:   k8s.AlertingRouteHealth{Name: "prometheus-k8s", Namespace: "openshift-monitoring", Status: k8s.RouteReachable},
			Alertmanager: k8s.AlertingRouteHealth{Name: "alertmanager-main", Namespace: "openshift-monitoring", Status: k8s.RouteReachable},
		},
		UserWorkloadEnabled: true,
		UserWorkload: &k8s.AlertingStackHealth{
			Prometheus:   k8s.AlertingRouteHealth{Name: "prometheus-user-workload", Namespace: "openshift-user-workload-monitoring", Status: k8s.RouteReachable},
			Alertmanager: k8s.AlertingRouteHealth{Name: "alertmanager-user-workload", Namespace: "openshift-user-workload-monitoring", Status: k8s.RouteReachable},
		},
	}
}

func TestGetHealth_Returns200(t *testing.T) {
	f := newAGFixture(t)
	f.mockK8s.AlertingHealthFunc = func(_ context.Context) (k8s.AlertingHealth, error) {
		return sampleAlertingHealth(), nil
	}

	w := f.get(t, "/api/v1/alerting/health")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}

func TestGetHealth_ReturnsAlertingStructure(t *testing.T) {
	f := newAGFixture(t)
	f.mockK8s.AlertingHealthFunc = func(_ context.Context) (k8s.AlertingHealth, error) {
		return sampleAlertingHealth(), nil
	}

	w := f.get(t, "/api/v1/alerting/health")
	var response managementrouter.GetHealthResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if response.Alerting == nil {
		t.Fatal("expected non-nil Alerting in response")
	}
	if response.Alerting.Platform == nil || response.Alerting.Platform.Prometheus.Name != "prometheus-k8s" {
		t.Errorf("expected platform prometheus-k8s, got %+v", response.Alerting.Platform)
	}
	if !response.Alerting.UserWorkloadEnabled {
		t.Error("expected UserWorkloadEnabled=true")
	}
	if response.Alerting.UserWorkload == nil || response.Alerting.UserWorkload.Prometheus.Name != "prometheus-user-workload" {
		t.Errorf("expected user workload prometheus-user-workload, got %+v", response.Alerting.UserWorkload)
	}
}

func TestGetHealth_Returns500OnError(t *testing.T) {
	f := newAGFixture(t)
	f.mockK8s.AlertingHealthFunc = func(_ context.Context) (k8s.AlertingHealth, error) {
		return k8s.AlertingHealth{}, fmt.Errorf("connection refused")
	}

	w := f.get(t, "/api/v1/alerting/health")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body)
	}
	if body := w.Body.String(); !strings.Contains(body, "An unexpected error occurred") {
		t.Errorf("expected error message, got: %s", body)
	}
}

func TestGetHealth_MissingAuthHeaderReturns401(t *testing.T) {
	f := newAGFixture(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/health", nil)
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body)
	}
}
