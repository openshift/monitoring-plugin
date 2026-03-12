package managementrouter_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func decodeRulesResp(t *testing.T, w *httptest.ResponseRecorder) managementrouter.GetRulesResponse {
	t.Helper()
	var resp managementrouter.GetRulesResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

func TestGetRules_ParsesQueryParams(t *testing.T) {
	f := newAGFixture(t)
	var captured k8s.GetRulesRequest
	f.mockPrometheusAlerts.FetchRulesFunc = func(_ context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
		captured = req
		return []k8s.PrometheusRuleGroup{}, nil, nil
	}

	q := url.Values{}
	q.Set("namespace", "ns1")
	q.Set("severity", "critical")
	q.Set("state", "firing")
	q.Add("match[]", `alertname=~"Kube.*"`)
	w := f.get(t, "/api/v1/alerting/rules?"+q.Encode())

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	if captured.State != "firing" {
		t.Errorf("expected state=firing, got %q", captured.State)
	}
	if captured.Labels["namespace"] != "ns1" {
		t.Errorf("expected namespace=ns1, got %q", captured.Labels["namespace"])
	}
	if captured.Labels["severity"] != "critical" {
		t.Errorf("expected severity=critical, got %q", captured.Labels["severity"])
	}
	if len(captured.Matchers) != 1 || captured.Matchers[0] != `alertname=~"Kube.*"` {
		t.Errorf("expected matchers [alertname=~\"Kube.*\"], got %v", captured.Matchers)
	}
}

func TestGetRules_ReturnsGroups(t *testing.T) {
	f := newAGFixture(t)
	f.mockPrometheusAlerts.SetRuleGroups([]k8s.PrometheusRuleGroup{
		{
			Name: "group-a",
			Rules: []k8s.PrometheusRule{
				{Name: "HighCPUUsage", Type: k8s.RuleTypeAlerting},
			},
		},
	})

	w := f.get(t, "/api/v1/alerting/rules")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
	resp := decodeRulesResp(t, w)
	if len(resp.Data.Groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(resp.Data.Groups))
	}
	if resp.Data.Groups[0].Name != "group-a" {
		t.Errorf("expected group-a, got %q", resp.Data.Groups[0].Name)
	}
	if len(resp.Data.Groups[0].Rules) != 1 || resp.Data.Groups[0].Rules[0].Name != "HighCPUUsage" {
		t.Errorf("expected rule HighCPUUsage, got %+v", resp.Data.Groups[0].Rules)
	}
}

func TestGetRules_WarningsSurfacedFromFetchRules(t *testing.T) {
	f := newAGFixture(t)
	f.mockPrometheusAlerts.FetchRulesFunc = func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
		return []k8s.PrometheusRuleGroup{}, []string{
			"failed to get user workload rules: connection refused",
		}, nil
	}
	f.rebuild()

	w := f.get(t, "/api/v1/alerting/rules")
	resp := decodeRulesResp(t, w)
	if len(resp.Warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d: %v", len(resp.Warnings), resp.Warnings)
	}
	if resp.Warnings[0] != "failed to get user workload rules: connection refused" {
		t.Errorf("unexpected warning: %s", resp.Warnings[0])
	}
}

func TestGetRules_NoWarningsWhenAllEndpointsSucceed(t *testing.T) {
	f := newAGFixture(t)
	f.mockPrometheusAlerts.SetRuleGroups([]k8s.PrometheusRuleGroup{})
	f.rebuild()

	w := f.get(t, "/api/v1/alerting/rules")
	resp := decodeRulesResp(t, w)
	if len(resp.Warnings) != 0 {
		t.Errorf("expected no warnings, got: %v", resp.Warnings)
	}
}

func TestGetRules_Returns500OnError(t *testing.T) {
	f := newAGFixture(t)
	f.mockPrometheusAlerts.FetchRulesFunc = func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
		return nil, nil, fmt.Errorf("connection error")
	}

	w := f.get(t, "/api/v1/alerting/rules")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body)
	}
	if body := w.Body.String(); !strings.Contains(body, "An unexpected error occurred") {
		t.Errorf("expected error message, got: %s", body)
	}
}

func TestGetRules_RepeatedStateRejected(t *testing.T) {
	f := newAGFixture(t)
	w := f.get(t, "/api/v1/alerting/rules?state=&state=firing")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body)
	}
}

func TestGetRules_MissingAuthHeaderReturns401(t *testing.T) {
	f := newAGFixture(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/rules", nil)
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body)
	}
}

func TestGetRules_InvalidMatcherReturns400WithoutFetch(t *testing.T) {
	f := newAGFixture(t)
	called := false
	f.mockPrometheusAlerts.FetchRulesFunc = func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
		called = true
		return nil, nil, nil
	}

	q := url.Values{}
	q.Add("match[]", "severity=")
	w := f.get(t, "/api/v1/alerting/rules?"+q.Encode())
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body)
	}
	if called {
		t.Error("FetchRules should not be called for invalid match[]")
	}
}

func TestGetRules_RepeatedEmptyNamespaceReturns400WithoutFetch(t *testing.T) {
	f := newAGFixture(t)
	called := false
	f.mockPrometheusAlerts.FetchRulesFunc = func(_ context.Context, _ k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
		called = true
		return nil, nil, nil
	}

	w := f.get(t, "/api/v1/alerting/rules?namespace=&namespace=ns1")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body)
	}
	if called {
		t.Error("FetchRules should not be called for repeated namespace")
	}
}
