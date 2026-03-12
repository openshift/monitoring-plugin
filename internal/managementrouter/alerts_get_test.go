package managementrouter_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/prometheus/model/relabel"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// agFixture holds mocks and the router for GetAlerts handler tests.
type agFixture struct {
	router               http.Handler
	mockK8s              *testutils.MockClient
	mockPrometheusAlerts *testutils.MockPrometheusAlertsInterface
}

func newAGFixture(t *testing.T) *agFixture {
	t.Helper()
	f := &agFixture{
		mockPrometheusAlerts: &testutils.MockPrometheusAlertsInterface{},
	}
	f.mockK8s = &testutils.MockClient{
		PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
			return f.mockPrometheusAlerts
		},
	}
	f.rebuild()
	return f
}

func (f *agFixture) rebuild() {
	mgmt := management.New(context.Background(), f.mockK8s)
	f.router = managementrouter.New(mgmt)
}

func (f *agFixture) get(t *testing.T, url string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	return w
}

func decodeAlertsResp(t *testing.T, w *httptest.ResponseRecorder) managementrouter.GetAlertsResponse {
	t.Helper()
	var resp managementrouter.GetAlertsResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

func TestGetAlerts_ParsesFlatQueryParams(t *testing.T) {
	f := newAGFixture(t)
	var captured k8s.GetAlertsRequest
	f.mockPrometheusAlerts.GetAlertsFunc = func(_ context.Context, req k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
		captured = req
		return []k8s.PrometheusAlert{}, nil
	}

	w := f.get(t, "/api/v1/alerting/alerts?namespace=ns1&severity=critical&state=firing&team=sre")

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
	if captured.Labels["team"] != "sre" {
		t.Errorf("expected team=sre, got %q", captured.Labels["team"])
	}
}

func TestGetAlerts_ReturnsAllAlerts(t *testing.T) {
	f := newAGFixture(t)
	testAlerts := []k8s.PrometheusAlert{
		{
			Labels:      map[string]string{managementlabels.AlertNameLabel: "HighCPUUsage", "severity": "warning", "namespace": "default"},
			Annotations: map[string]string{"description": "CPU usage is high"},
			State:       "firing",
			ActiveAt:    time.Now(),
		},
		{
			Labels:      map[string]string{managementlabels.AlertNameLabel: "LowMemory", "severity": "critical", "namespace": "monitoring"},
			Annotations: map[string]string{"description": "Memory is running low"},
			State:       "firing",
			ActiveAt:    time.Now(),
		},
	}
	f.mockPrometheusAlerts.SetActiveAlerts(testAlerts)

	w := f.get(t, "/api/v1/alerting/alerts")

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
	resp := decodeAlertsResp(t, w)
	if len(resp.Data.Alerts) != 2 {
		t.Fatalf("expected 2 alerts, got %d", len(resp.Data.Alerts))
	}
	if resp.Data.Alerts[0].Labels[managementlabels.AlertNameLabel] != "HighCPUUsage" {
		t.Errorf("alert[0] name mismatch: %s", resp.Data.Alerts[0].Labels[managementlabels.AlertNameLabel])
	}
	if resp.Data.Alerts[1].Labels[managementlabels.AlertNameLabel] != "LowMemory" {
		t.Errorf("alert[1] name mismatch: %s", resp.Data.Alerts[1].Labels[managementlabels.AlertNameLabel])
	}
}

func TestGetAlerts_WarningsWhenUserWorkloadRoutesMissing(t *testing.T) {
	f := newAGFixture(t)
	f.mockK8s.AlertingHealthFunc = func(_ context.Context) (k8s.AlertingHealth, error) {
		return k8s.AlertingHealth{
			UserWorkloadEnabled: true,
			UserWorkload: &k8s.AlertingStackHealth{
				Prometheus:   k8s.AlertingRouteHealth{Status: k8s.RouteNotFound},
				Alertmanager: k8s.AlertingRouteHealth{Status: k8s.RouteNotFound},
			},
		}, nil
	}
	f.rebuild()

	w := f.get(t, "/api/v1/alerting/alerts")
	resp := decodeAlertsResp(t, w)

	warnSet := make(map[string]bool)
	for _, w := range resp.Warnings {
		warnSet[w] = true
	}
	if !warnSet["user workload Prometheus route is missing"] {
		t.Errorf("expected Prometheus route warning, got: %v", resp.Warnings)
	}
	if !warnSet["user workload Alertmanager route is missing"] {
		t.Errorf("expected Alertmanager route warning, got: %v", resp.Warnings)
	}
}

func TestGetAlerts_SuppressesWarningsWhenFallbacksHealthy(t *testing.T) {
	f := newAGFixture(t)
	f.mockK8s.AlertingHealthFunc = func(_ context.Context) (k8s.AlertingHealth, error) {
		return k8s.AlertingHealth{
			UserWorkloadEnabled: true,
			UserWorkload: &k8s.AlertingStackHealth{
				Prometheus:   k8s.AlertingRouteHealth{Status: k8s.RouteUnreachable, FallbackReachable: true},
				Alertmanager: k8s.AlertingRouteHealth{Status: k8s.RouteUnreachable, FallbackReachable: true},
			},
		}, nil
	}
	f.rebuild()

	w := f.get(t, "/api/v1/alerting/alerts")
	resp := decodeAlertsResp(t, w)
	if len(resp.Warnings) != 0 {
		t.Errorf("expected no warnings, got: %v", resp.Warnings)
	}
}

func TestGetAlerts_ReturnsEmptyWhenNoAlerts(t *testing.T) {
	f := newAGFixture(t)
	f.mockPrometheusAlerts.SetActiveAlerts([]k8s.PrometheusAlert{})

	w := f.get(t, "/api/v1/alerting/alerts")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := decodeAlertsResp(t, w)
	if len(resp.Data.Alerts) != 0 {
		t.Errorf("expected empty alerts, got %d", len(resp.Data.Alerts))
	}
}

func TestGetAlerts_Returns500OnError(t *testing.T) {
	f := newAGFixture(t)
	f.mockPrometheusAlerts.GetAlertsFunc = func(_ context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
		return nil, fmt.Errorf("connection error")
	}

	w := f.get(t, "/api/v1/alerting/alerts")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body)
	}
	if body := w.Body.String(); !strings.Contains(body, "An unexpected error occurred") {
		t.Errorf("expected error message, got: %s", body)
	}
}

func TestGetAlerts_ForwardsBearerToken(t *testing.T) {
	f := newAGFixture(t)
	var capturedCtx context.Context
	f.mockPrometheusAlerts.GetAlertsFunc = func(ctx context.Context, _ k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
		capturedCtx = ctx
		return []k8s.PrometheusAlert{}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
	req.Header.Set("Authorization", "Bearer test-token-abc123")
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	if token := k8s.BearerTokenFromContext(capturedCtx); token != "test-token-abc123" {
		t.Errorf("expected token test-token-abc123, got %q", token)
	}
}

func TestGetAlerts_MissingAuthHeaderReturns401(t *testing.T) {
	f := newAGFixture(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerting/alerts", nil)
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body)
	}
}

func TestGetAlerts_EnrichesAlertWithRuleId(t *testing.T) {
	f := newAGFixture(t)
	baseRule := monitoringv1.Rule{
		Alert:  "HighCPU",
		Expr:   intstr.FromString("node_cpu > 0.9"),
		Labels: map[string]string{"severity": "critical"},
	}
	ruleId := alertrule.GetAlertingRuleId(&baseRule)

	relabeledRule := monitoringv1.Rule{
		Alert: "HighCPU",
		Expr:  intstr.FromString("node_cpu > 0.9"),
		Labels: map[string]string{
			managementlabels.AlertNameLabel:        "HighCPU",
			"severity":                             "critical",
			k8s.AlertRuleLabelId:                   ruleId,
			k8s.PrometheusRuleLabelNamespace:       "openshift-monitoring",
			k8s.PrometheusRuleLabelName:            "cluster-cpu-rules",
			managementlabels.AlertingRuleLabelName: "my-alerting-rule",
		},
	}

	f.mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			ListFunc: func(_ context.Context) []monitoringv1.Rule { return []monitoringv1.Rule{relabeledRule} },
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == ruleId {
					return relabeledRule, true
				}
				return monitoringv1.Rule{}, false
			},
			ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
		}
	}
	f.mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool { return name == "openshift-monitoring" },
		}
	}
	f.mockPrometheusAlerts.SetActiveAlerts([]k8s.PrometheusAlert{
		{
			Labels: map[string]string{
				managementlabels.AlertNameLabel: "HighCPU",
				"severity":                      "critical",
				k8s.AlertSourceLabel:            k8s.AlertSourcePlatform,
				k8s.AlertBackendLabel:           "alertmanager",
			},
			Annotations: map[string]string{"summary": "CPU is high"},
			State:       "firing",
			ActiveAt:    time.Now(),
		},
	})
	f.rebuild()

	w := f.get(t, "/api/v1/alerting/alerts")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := decodeAlertsResp(t, w)
	if len(resp.Data.Alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(resp.Data.Alerts))
	}
	alert := resp.Data.Alerts[0]
	if alert.AlertRuleId != ruleId {
		t.Errorf("expected ruleId %s, got %s", ruleId, alert.AlertRuleId)
	}
	if alert.AlertComponent == "" {
		t.Error("expected non-empty AlertComponent")
	}
	if alert.AlertLayer == "" {
		t.Error("expected non-empty AlertLayer")
	}
}

func TestGetAlerts_EnrichesWithoutAlertingRuleCR(t *testing.T) {
	f := newAGFixture(t)
	baseRule := monitoringv1.Rule{
		Alert:  "KubePodCrashLooping",
		Expr:   intstr.FromString("rate(kube_pod_restart_total[5m]) > 0"),
		Labels: map[string]string{"severity": "warning"},
	}
	ruleId := alertrule.GetAlertingRuleId(&baseRule)

	relabeledRule := monitoringv1.Rule{
		Alert: "KubePodCrashLooping",
		Expr:  intstr.FromString("rate(kube_pod_restart_total[5m]) > 0"),
		Labels: map[string]string{
			managementlabels.AlertNameLabel:  "KubePodCrashLooping",
			"severity":                       "warning",
			k8s.AlertRuleLabelId:             ruleId,
			k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
			k8s.PrometheusRuleLabelName:      "kube-state-metrics",
		},
	}

	f.mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			ListFunc: func(_ context.Context) []monitoringv1.Rule { return []monitoringv1.Rule{relabeledRule} },
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == ruleId {
					return relabeledRule, true
				}
				return monitoringv1.Rule{}, false
			},
			ConfigFunc: func() []*relabel.Config { return []*relabel.Config{} },
		}
	}
	f.mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool { return name == "openshift-monitoring" },
		}
	}
	f.mockPrometheusAlerts.SetActiveAlerts([]k8s.PrometheusAlert{
		{
			Labels: map[string]string{
				managementlabels.AlertNameLabel: "KubePodCrashLooping",
				"severity":                      "warning",
				k8s.AlertSourceLabel:            k8s.AlertSourcePlatform,
				k8s.AlertBackendLabel:           "alertmanager",
			},
			State:    "firing",
			ActiveAt: time.Now(),
		},
	})
	f.rebuild()

	w := f.get(t, "/api/v1/alerting/alerts")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := decodeAlertsResp(t, w)
	if len(resp.Data.Alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(resp.Data.Alerts))
	}
	if resp.Data.Alerts[0].AlertRuleId != ruleId {
		t.Errorf("expected ruleId %s, got %s", ruleId, resp.Data.Alerts[0].AlertRuleId)
	}
}
