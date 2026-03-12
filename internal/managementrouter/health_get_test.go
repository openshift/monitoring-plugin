package managementrouter_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/client-go/rest"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
)

// stubClient is a configurable stub implementing management.Client.
// Fields are set per-test; all methods default to no-op returns.
type stubClient struct {
	getRules       func(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error)
	alertingHealth func(ctx context.Context) (k8s.AlertingHealth, error)
}

func (s *stubClient) ListRules(_ context.Context, _ management.PrometheusRuleOptions, _ management.AlertRuleOptions, _ management.PaginationOptions) (management.ListRulesResult, error) {
	return management.ListRulesResult{}, nil
}
func (s *stubClient) GetRuleById(_ context.Context, _ string) (monitoringv1.Rule, error) {
	return monitoringv1.Rule{}, nil
}
func (s *stubClient) CreateUserDefinedAlertRule(_ context.Context, _ monitoringv1.Rule, _ management.PrometheusRuleOptions) (string, error) {
	return "", nil
}
func (s *stubClient) CreatePlatformAlertRule(_ context.Context, _ monitoringv1.Rule) (string, error) {
	return "", nil
}
func (s *stubClient) UpdateUserDefinedAlertRule(_ context.Context, _ string, _ monitoringv1.Rule) (string, error) {
	return "", nil
}
func (s *stubClient) DeleteUserDefinedAlertRuleById(_ context.Context, _ string) error { return nil }
func (s *stubClient) UpdatePlatformAlertRule(_ context.Context, _ string, _ monitoringv1.Rule) error {
	return nil
}
func (s *stubClient) DropPlatformAlertRule(_ context.Context, _ string) error    { return nil }
func (s *stubClient) RestorePlatformAlertRule(_ context.Context, _ string) error { return nil }
func (s *stubClient) GetAlerts(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
	return nil, nil
}
func (s *stubClient) GetRules(ctx context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
	if s.getRules != nil {
		return s.getRules(ctx, req)
	}
	return []k8s.PrometheusRuleGroup{}, nil
}
func (s *stubClient) GetAlertingHealth(ctx context.Context) (k8s.AlertingHealth, error) {
	if s.alertingHealth != nil {
		return s.alertingHealth(ctx)
	}
	return k8s.AlertingHealth{}, nil
}
func (s *stubClient) UpdateAlertRuleClassification(_ context.Context, _ management.UpdateRuleClassificationRequest) error {
	return nil
}
func (s *stubClient) BulkUpdateAlertRuleClassification(_ context.Context, _ []management.UpdateRuleClassificationRequest) []error {
	return nil
}
func (s *stubClient) MetricsHandler(_ context.Context, _ *rest.Config) (http.Handler, error) {
	return nil, nil
}

// newStubRouter builds a router backed by stub and adds a Bearer token header
// to requests via the helper get/getNoAuth methods.
func newStubRouter(stub *stubClient) http.Handler {
	return managementrouter.New(stub)
}

func stubGet(router http.Handler, url string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// --- health_get tests ---

func healthStub() *stubClient {
	return &stubClient{
		alertingHealth: func(_ context.Context) (k8s.AlertingHealth, error) {
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
			}, nil
		},
	}
}

func TestGetHealth_Returns200(t *testing.T) {
	router := newStubRouter(healthStub())
	w := stubGet(router, "/api/v1/alerting/health")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
}

func TestGetHealth_ReturnsAlertingStructure(t *testing.T) {
	router := newStubRouter(healthStub())
	w := stubGet(router, "/api/v1/alerting/health")

	var response managementrouter.GetHealthResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if response.Alerting == nil {
		t.Error("expected non-nil Alerting in response")
	}
}

func TestGetHealth_Returns500OnError(t *testing.T) {
	stub := &stubClient{
		alertingHealth: func(_ context.Context) (k8s.AlertingHealth, error) {
			return k8s.AlertingHealth{}, fmt.Errorf("connection refused")
		},
	}
	router := newStubRouter(stub)
	w := stubGet(router, "/api/v1/alerting/health")

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body)
	}
	var errResp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if errResp["error"] != "An unexpected error occurred" {
		t.Errorf("unexpected error message: %q", errResp["error"])
	}
}

// --- rules_get tests ---

func TestGetRules_ParsesFlatQueryParams(t *testing.T) {
	stub := &stubClient{}
	var captured k8s.GetRulesRequest
	stub.getRules = func(_ context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
		captured = req
		return []k8s.PrometheusRuleGroup{}, nil
	}
	router := newStubRouter(stub)
	w := stubGet(router, "/api/v1/alerting/rules?namespace=ns1&severity=critical&state=firing&team=sre")

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	if captured.State != "firing" {
		t.Errorf("expected state=firing, got %q", captured.State)
	}
	for k, want := range map[string]string{"namespace": "ns1", "severity": "critical", "team": "sre"} {
		if got := captured.Labels[k]; got != want {
			t.Errorf("label[%s]: want %q, got %q", k, want, got)
		}
	}
}

func TestGetRules_ReturnsGroupsInResponse(t *testing.T) {
	stub := &stubClient{
		getRules: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
			return []k8s.PrometheusRuleGroup{{Name: "group-a"}}, nil
		},
	}
	router := newStubRouter(stub)
	w := stubGet(router, "/api/v1/alerting/rules")

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json, got %q", ct)
	}
	var response managementrouter.GetRulesResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(response.Data.Groups) != 1 || response.Data.Groups[0].Name != "group-a" {
		t.Errorf("unexpected groups: %v", response.Data.Groups)
	}
}

func TestGetRules_WarningWhenUserWorkloadPromRouteMissing(t *testing.T) {
	stub := &stubClient{
		alertingHealth: func(_ context.Context) (k8s.AlertingHealth, error) {
			return k8s.AlertingHealth{
				UserWorkloadEnabled: true,
				UserWorkload: &k8s.AlertingStackHealth{
					Prometheus: k8s.AlertingRouteHealth{Status: k8s.RouteNotFound},
				},
			}, nil
		},
	}
	router := newStubRouter(stub)
	w := stubGet(router, "/api/v1/alerting/rules")

	var response managementrouter.GetRulesResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	found := false
	for _, warn := range response.Warnings {
		if warn == "user workload Prometheus route is missing" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected Prometheus route warning, got: %v", response.Warnings)
	}
}

func TestGetRules_SuppressesWarningWhenFallbackHealthy(t *testing.T) {
	stub := &stubClient{
		alertingHealth: func(_ context.Context) (k8s.AlertingHealth, error) {
			return k8s.AlertingHealth{
				UserWorkloadEnabled: true,
				UserWorkload: &k8s.AlertingStackHealth{
					Prometheus: k8s.AlertingRouteHealth{Status: k8s.RouteUnreachable, FallbackReachable: true},
				},
			}, nil
		},
	}
	router := newStubRouter(stub)
	w := stubGet(router, "/api/v1/alerting/rules")

	var response managementrouter.GetRulesResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(response.Warnings) != 0 {
		t.Errorf("expected no warnings, got: %v", response.Warnings)
	}
}

func TestGetRules_Returns500OnError(t *testing.T) {
	stub := &stubClient{
		getRules: func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, error) {
			return nil, fmt.Errorf("connection error")
		},
	}
	router := newStubRouter(stub)
	w := stubGet(router, "/api/v1/alerting/rules")

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body)
	}
	if body := w.Body.String(); !containsStr(body, "An unexpected error occurred") {
		t.Errorf("expected error message in body, got: %s", body)
	}
}
