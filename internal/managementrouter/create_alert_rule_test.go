package managementrouter_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

// bearerRequest builds a POST request with an Authorization header so the
// authMiddleware in the router is satisfied.
func bearerRequest(t *testing.T, url string, body []byte) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")
	return req
}

func newTestRouter(mockK8s *testutils.MockClient) http.Handler {
	mgmt := management.New(context.Background(), mockK8s)
	return managementrouter.New(mgmt)
}

func TestCreateAlertRule_CreateNewUserDefinedRule(t *testing.T) {
	mockK8sRules := &testutils.MockPrometheusRuleInterface{}
	mockARules := &testutils.MockAlertingRuleInterface{}
	mockK8s := &testutils.MockClient{
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface { return mockK8sRules },
		AlertingRulesFunc:   func() k8s.AlertingRuleInterface { return mockARules },
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]interface{}{
		"alertingRule": map[string]interface{}{
			"alert":       "cpuHigh",
			"expr":        "vector(1)",
			"for":         "5m",
			"labels":      map[string]string{"severity": "warning"},
			"annotations": map[string]string{"summary": "cpu high"},
		},
		"prometheusRule": map[string]interface{}{
			"prometheusRuleName":      "user-pr",
			"prometheusRuleNamespace": "default",
		},
	}
	buf, _ := json.Marshal(body)

	req := bearerRequest(t, "/api/v1/alerting/rules", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Id string `json:"id"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Id == "" {
		t.Fatal("expected non-empty id")
	}

	pr, found, err := mockK8sRules.Get(context.Background(), "default", "user-pr")
	if err != nil {
		t.Fatalf("Get PrometheusRule: %v", err)
	}
	if !found {
		t.Fatal("expected PrometheusRule to be found")
	}
	var allAlerts []string
	for _, g := range pr.Spec.Groups {
		for _, r := range g.Rules {
			allAlerts = append(allAlerts, r.Alert)
		}
	}
	if !contains(allAlerts, "cpuHigh") {
		t.Errorf("expected cpuHigh in alerts, got %v", allAlerts)
	}
}

func TestCreateAlertRule_CustomGroupName(t *testing.T) {
	mockK8sRules := &testutils.MockPrometheusRuleInterface{}
	mockARules := &testutils.MockAlertingRuleInterface{}
	mockK8s := &testutils.MockClient{
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface { return mockK8sRules },
		AlertingRulesFunc:   func() k8s.AlertingRuleInterface { return mockARules },
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]interface{}{
		"alertingRule": map[string]interface{}{
			"alert": "cpuCustomGroup",
			"expr":  "vector(1)",
		},
		"prometheusRule": map[string]interface{}{
			"prometheusRuleName":      "user-pr",
			"prometheusRuleNamespace": "default",
			"groupName":               "custom-group",
		},
	}
	buf, _ := json.Marshal(body)

	req := bearerRequest(t, "/api/v1/alerting/rules", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	pr, found, err := mockK8sRules.Get(context.Background(), "default", "user-pr")
	if err != nil || !found {
		t.Fatalf("PrometheusRule not found: %v", err)
	}

	var grp *monitoringv1.RuleGroup
	for i := range pr.Spec.Groups {
		if pr.Spec.Groups[i].Name == "custom-group" {
			grp = &pr.Spec.Groups[i]
			break
		}
	}
	if grp == nil {
		t.Fatal("custom-group not found")
	}
	var alerts []string
	for _, r := range grp.Rules {
		alerts = append(alerts, r.Alert)
	}
	if !contains(alerts, "cpuCustomGroup") {
		t.Errorf("expected cpuCustomGroup, got %v", alerts)
	}
}

func TestCreateAlertRule_InvalidJSON(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/alerting/rules", bytes.NewBufferString("{"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if body := w.Body.String(); !jsonContains(body, "invalid request body") {
		t.Errorf("expected 'invalid request body' in %q", body)
	}
}

func TestCreateAlertRule_MissingAlertingRule(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]interface{}{
		"prometheusRule": map[string]interface{}{
			"prometheusRuleName":      "user-pr",
			"prometheusRuleNamespace": "default",
		},
	}
	buf, _ := json.Marshal(body)

	req := bearerRequest(t, "/api/v1/alerting/rules", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if body := w.Body.String(); !jsonContains(body, "alertingRule is required") {
		t.Errorf("expected 'alertingRule is required' in %q", body)
	}
}

func TestCreateAlertRule_MissingPRNameNamespace(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]interface{}{
		"alertingRule": map[string]interface{}{
			"alert": "x",
			"expr":  "vector(1)",
		},
		"prometheusRule": map[string]interface{}{},
	}
	buf, _ := json.Marshal(body)

	req := bearerRequest(t, "/api/v1/alerting/rules", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if body := w.Body.String(); !jsonContains(body, "PrometheusRule Name and Namespace must be specified") {
		t.Errorf("unexpected body: %q", body)
	}
}

func TestCreateAlertRule_PlatformManagedPR(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool {
					return name == "openshift-monitoring"
				},
			}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]interface{}{
		"alertingRule": map[string]interface{}{
			"alert": "x",
			"expr":  "vector(1)",
		},
		"prometheusRule": map[string]interface{}{
			"prometheusRuleName":      "platform-pr",
			"prometheusRuleNamespace": "openshift-monitoring",
		},
	}
	buf, _ := json.Marshal(body)

	req := bearerRequest(t, "/api/v1/alerting/rules", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
	if body := w.Body.String(); !jsonContains(body, "cannot add user-defined alert rule to a platform-managed PrometheusRule") {
		t.Errorf("unexpected body: %q", body)
	}
}

func TestCreateAlertRule_MissingAuthToken(t *testing.T) {
	mockK8s := &testutils.MockClient{}
	mgmt := management.New(context.Background(), mockK8s)
	router := managementrouter.New(mgmt)

	body := map[string]interface{}{
		"alertingRule": map[string]interface{}{
			"alert": "x",
			"expr":  "vector(1)",
		},
	}
	buf, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/alerting/rules", bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	// No Authorization header
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestCreateAlertRule_BodyTooLarge(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	// Build a payload that exceeds the 1 MB limit.
	oversized := make([]byte, 2<<20) // 2 MB
	for i := range oversized {
		oversized[i] = 'x'
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/alerting/rules", bytes.NewReader(oversized))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for oversized body, got %d", w.Code)
	}
}

func TestCreateAlertRule_PlatformRuleCreated(t *testing.T) {
	mockARules := &testutils.MockAlertingRuleInterface{}
	mockK8s := &testutils.MockClient{
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{}
		},
		AlertingRulesFunc: func() k8s.AlertingRuleInterface { return mockARules },
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	// No prometheusRule field → platform path.
	body := map[string]interface{}{
		"alertingRule": map[string]interface{}{
			"alert":  "PlatformAlert",
			"expr":   "up == 0",
			"labels": map[string]string{"severity": "critical"},
		},
	}
	buf, _ := json.Marshal(body)

	req := bearerRequest(t, "/api/v1/alerting/rules", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Id string `json:"id"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Id == "" {
		t.Fatal("expected non-empty id for platform rule")
	}

	ar, found, err := mockARules.Get(context.Background(), "platform-alert-rules")
	if err != nil {
		t.Fatalf("Get AlertingRule: %v", err)
	}
	if !found {
		t.Fatal("expected AlertingRule platform-alert-rules to exist")
	}
	var allAlerts []string
	for _, g := range ar.Spec.Groups {
		for _, r := range g.Rules {
			allAlerts = append(allAlerts, r.Alert)
		}
	}
	if !contains(allAlerts, "PlatformAlert") {
		t.Errorf("expected PlatformAlert in AlertingRule, got %v", allAlerts)
	}
}

func TestCreateAlertRule_GenericErrorNotLeaked(t *testing.T) {
	mockK8s := &testutils.MockClient{
		AlertingRulesFunc: func() k8s.AlertingRuleInterface {
			return &testutils.MockAlertingRuleInterface{
				// Inject an unexpected error at the Get step so the management
				// layer bubbles it up as a generic 500 (not a typed error).
				GetFunc: func(_ context.Context, _ string) (*osmv1.AlertingRule, bool, error) {
					return nil, false, errors.New("internal db connection failed: secret details")
				},
			}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{}
		},
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]interface{}{
		"alertingRule": map[string]interface{}{
			"alert": "SomeAlert",
			"expr":  "up == 0",
		},
	}
	buf, _ := json.Marshal(body)

	req := bearerRequest(t, "/api/v1/alerting/rules", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
	body500 := w.Body.String()
	// Internal error message must NOT appear in the response.
	if containsStr(body500, "internal db connection failed") || containsStr(body500, "secret details") {
		t.Errorf("internal error detail leaked to client: %s", body500)
	}
	if !jsonContains(body500, "unexpected error") {
		t.Errorf("expected generic error message, got: %s", body500)
	}
}

func TestCreateAlertRule_AllFieldsMapped(t *testing.T) {
	mockK8sRules := &testutils.MockPrometheusRuleInterface{}
	mockK8s := &testutils.MockClient{
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface { return mockK8sRules },
		AlertingRulesFunc:   func() k8s.AlertingRuleInterface { return &testutils.MockAlertingRuleInterface{} },
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool { return false },
			}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]interface{}{
		"alertingRule": map[string]interface{}{
			"alert":         "FullAlert",
			"expr":          "up == 0",
			"for":           "5m",
			"keepFiringFor": "10m",
			"labels":        map[string]string{"severity": "warning", "team": "sre"},
			"annotations":   map[string]string{"summary": "Instance down", "runbook": "http://wiki/runbook"},
		},
		"prometheusRule": map[string]interface{}{
			"prometheusRuleName":      "full-pr",
			"prometheusRuleNamespace": "default",
		},
	}
	buf, _ := json.Marshal(body)

	req := bearerRequest(t, "/api/v1/alerting/rules", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	pr, found, err := mockK8sRules.Get(context.Background(), "default", "full-pr")
	if err != nil || !found {
		t.Fatalf("PrometheusRule not found: %v", err)
	}

	var rule *monitoringv1.Rule
	for _, g := range pr.Spec.Groups {
		for i := range g.Rules {
			if g.Rules[i].Alert == "FullAlert" {
				rule = &g.Rules[i]
			}
		}
	}
	if rule == nil {
		t.Fatal("FullAlert rule not found in PrometheusRule")
	}
	if rule.Expr.String() != "up == 0" {
		t.Errorf("expr: want 'up == 0', got %q", rule.Expr.String())
	}
	if rule.For == nil || string(*rule.For) != "5m" {
		t.Errorf("for: want '5m', got %v", rule.For)
	}
	if rule.KeepFiringFor == nil || string(*rule.KeepFiringFor) != "10m" {
		t.Errorf("keepFiringFor: want '10m', got %v", rule.KeepFiringFor)
	}
	if rule.Labels["severity"] != "warning" || rule.Labels["team"] != "sre" {
		t.Errorf("labels mismatch: %v", rule.Labels)
	}
	if rule.Annotations["summary"] != "Instance down" {
		t.Errorf("annotations mismatch: %v", rule.Annotations)
	}
}

// contains reports whether s is in ss.
func contains(ss []string, s string) bool {
	for _, v := range ss {
		if v == s {
			return true
		}
	}
	return false
}

// jsonContains checks whether the JSON body's "error" field contains substr,
// or the raw string contains substr as a fallback.
func jsonContains(body, substr string) bool {
	var m map[string]string
	if err := json.Unmarshal([]byte(body), &m); err == nil {
		return contains([]string{m["error"]}, substr) || len(m["error"]) > 0 && containsStr(m["error"], substr)
	}
	return containsStr(body, substr)
}

func containsStr(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || func() bool {
		for i := 0; i <= len(s)-len(sub); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
		return false
	}())
}
