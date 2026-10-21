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
	"time"

	"github.com/prometheus/prometheus/model/labels"
	v1 "github.com/prometheus/prometheus/web/api/v1"
	"github.com/stretchr/testify/require"

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

func newRuleGroups(evaluatedAt time.Time, alerts []*v1.Alert) ([]v1.RuleGroup, *v1.AlertingRule) {
	alerting := &v1.AlertingRule{
		State: "firing", Name: "HighCPUUsage", Query: "node_cpu_usage > 0.9",
		Duration: 300, KeepFiringFor: 60,
		Labels:      labels.FromStrings("severity", "warning"),
		Annotations: labels.FromStrings("summary", "CPU usage is high"),
		Alerts:      alerts, Health: "err", LastError: "previous evaluation failed",
		EvaluationTime: 0.125, LastEvaluation: evaluatedAt, Type: "alerting",
	}
	groups := []v1.RuleGroup{
		{
			Name: "group-a", File: "/etc/prometheus/rules/cpu.yaml", Interval: 30, Limit: 100,
			EvaluationTime: 0.25, LastEvaluation: evaluatedAt,
			Rules: []v1.Rule{
				&v1.RecordingRule{
					Name: "node:cpu:ratio", Query: "avg(node_cpu_usage)", Labels: labels.EmptyLabels(),
					Health: "ok", EvaluationTime: 0.025, LastEvaluation: evaluatedAt, Type: "recording",
				},
				alerting,
			},
		},
		{
			Rules: []v1.Rule{
				&v1.AlertingRule{Labels: labels.EmptyLabels(), Annotations: labels.EmptyLabels(), Alerts: []*v1.Alert{}, Type: "alerting"},
				&v1.RecordingRule{Labels: labels.EmptyLabels(), Type: "recording"},
			},
		},
	}
	return groups, alerting
}

func convertGroupToK8sGroup(t *testing.T, group v1.RuleGroup) k8s.PrometheusRuleGroup {
	t.Helper()
	converted := k8s.PrometheusRuleGroup{
		Name: group.Name, File: group.File, Interval: group.Interval, Limit: group.Limit,
		EvaluationTime: group.EvaluationTime, LastEvaluation: group.LastEvaluation,
		Rules: make([]k8s.Rule, 0, len(group.Rules)),
	}
	for _, upstreamRule := range group.Rules {
		var rule k8s.Rule
		switch upstreamRule.(type) {
		case *v1.AlertingRule:
			rule = &k8s.AlertingRule{}
		case *v1.RecordingRule:
			rule = &k8s.RecordingRule{}
		default:
			t.Fatalf("unsupported upstream rule type %T", upstreamRule)
		}
		input, err := json.Marshal(upstreamRule)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(input, rule))
		if alerting, ok := rule.(*k8s.AlertingRule); ok && alerting.Alerts == nil {
			alerting.Alerts = []k8s.PrometheusRuleAlert{}
		}
		converted.Rules = append(converted.Rules, rule)
	}
	return converted
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

func TestGetRules_ParsesInactiveAlertState(t *testing.T) {
	f := newAGFixture(t)
	var captured k8s.GetRulesRequest
	f.mockPrometheusAlerts.FetchRulesFunc = func(_ context.Context, req k8s.GetRulesRequest) ([]k8s.PrometheusRuleGroup, []string, error) {
		captured = req
		return []k8s.PrometheusRuleGroup{}, nil, nil
	}

	w := f.get(t, "/api/v1/alerting/rules?state=inactive")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	if captured.State != "inactive" {
		t.Errorf("expected state=inactive, got %q", captured.State)
	}
}

func TestGetRules_SilencedStateRejected(t *testing.T) {
	f := newAGFixture(t)
	w := f.get(t, "/api/v1/alerting/rules?state=silenced")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body)
	}
}

func TestGetRules_ReturnsGroups(t *testing.T) {
	evaluatedAt := time.Date(2026, time.October, 19, 12, 0, 0, 123000000, time.UTC)
	activeAt := evaluatedAt.Add(-10 * time.Minute)
	keepFiringSince := evaluatedAt.Add(-time.Minute)
	activeAlerts := []*v1.Alert{
		{
			Labels:      labels.FromStrings("alertname", "HighCPUUsage", "severity", "warning"),
			Annotations: labels.FromStrings("summary", "CPU usage is high"),
			State:       "firing", ActiveAt: &activeAt, KeepFiringSince: &keepFiringSince, Value: "9.5e-01",
		},
		{Labels: labels.EmptyLabels(), Annotations: labels.EmptyLabels(), State: "pending", Value: "0"},
	}
	for _, tc := range []struct {
		name   string
		alerts []*v1.Alert
	}{
		{name: "nil alerts"},
		{name: "empty alerts", alerts: []*v1.Alert{}},
		{name: "active alerts", alerts: activeAlerts},
	} {
		t.Run(tc.name, func(t *testing.T) {
			groups, alerting := newRuleGroups(evaluatedAt, tc.alerts)
			localGroups := make([]k8s.PrometheusRuleGroup, 0, len(groups))
			for _, group := range groups {
				localGroups = append(localGroups, convertGroupToK8sGroup(t, group))
			}

			f := newAGFixture(t)
			f.mockPrometheusAlerts.SetRuleGroups(localGroups)
			if tc.alerts == nil {
				alerting.Alerts = []*v1.Alert{}
			}
			expected, err := json.Marshal(struct {
				Data v1.RuleDiscovery `json:"data"`
			}{Data: v1.RuleDiscovery{RuleGroups: []*v1.RuleGroup{&groups[0], &groups[1]}}})
			require.NoError(t, err)

			w := f.get(t, "/api/v1/alerting/rules")
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			require.Equal(t, "application/json", w.Header().Get("Content-Type"))
			require.JSONEq(t, string(expected), w.Body.String())
		})
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
	if resp.Warnings == nil || len(*resp.Warnings) != 1 {
		t.Fatalf("expected 1 warning, got %v", resp.Warnings)
	}
	if (*resp.Warnings)[0] != "failed to get user workload rules: connection refused" {
		t.Errorf("unexpected warning: %s", (*resp.Warnings)[0])
	}
}

func TestGetRules_NoWarningsWhenAllEndpointsSucceed(t *testing.T) {
	f := newAGFixture(t)
	f.mockPrometheusAlerts.SetRuleGroups([]k8s.PrometheusRuleGroup{})
	f.rebuild()

	w := f.get(t, "/api/v1/alerting/rules")
	resp := decodeRulesResp(t, w)
	if resp.Warnings != nil {
		t.Errorf("expected no warnings, got: %v", *resp.Warnings)
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
