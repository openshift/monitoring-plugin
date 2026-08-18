package managementrouter_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

func (f *buFixture) doSingleUpdate(t *testing.T, ruleID string, body any) *httptest.ResponseRecorder {
	t.Helper()
	buf, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodPatch,
		"/api/v1/alerting/rules/"+ruleID,
		bytes.NewReader(buf),
	)
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	return w
}

func (f *buFixture) doSingleUpdateRaw(t *testing.T, ruleID string, raw []byte) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodPatch,
		"/api/v1/alerting/rules/"+ruleID,
		bytes.NewReader(raw),
	)
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	return w
}

func TestUpdateAlertRule_UpdatesUserRuleLabels(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)

	expectedId := alertrule.GetAlertingRuleId(&monitoringv1.Rule{
		Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
		Labels: map[string]string{"severity": "warning", "component": "api"},
	})

	w := f.doSingleUpdate(t, user1Id, map[string]any{
		"labels": map[string]string{"component": "api"},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}

	var resp managementrouter.UpdateAlertRuleResult
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Id != expectedId {
		t.Errorf("id: got %s want %s", resp.Id, expectedId)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("statusCode: got %d want %d", resp.StatusCode, http.StatusNoContent)
	}
}

func TestUpdateAlertRule_NotFound(t *testing.T) {
	f := newBUFixture(t)
	w := f.doSingleUpdate(t, "missing-rule-id", map[string]any{
		"labels": map[string]string{"severity": "warning"},
	})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body)
	}
}

func TestUpdateAlertRule_RejectsEmptyBody(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)
	w := f.doSingleUpdate(t, user1Id, map[string]any{})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body)
	}
}

func TestUpdateAlertRule_RejectsToggleCombinedWithLabels(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)
	enabled := false
	w := f.doSingleUpdate(t, user1Id, map[string]any{
		"alertingRuleEnabled": enabled,
		"labels":              map[string]string{"severity": "warning"},
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body)
	}
	if !strings.Contains(w.Body.String(), "alertingRuleEnabled cannot be combined") {
		t.Errorf("unexpected body: %s", w.Body.String())
	}
}

func TestUpdateAlertRule_InvalidJSON(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)
	w := f.doSingleUpdateRaw(t, user1Id, []byte("{not-json"))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body)
	}
}

func TestUpdateAlertRule_BodyTooLarge(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)
	large := make([]byte, 1<<20+1)
	for i := range large {
		large[i] = 'a'
	}
	w := f.doSingleUpdateRaw(t, user1Id, large)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d: %s", w.Code, w.Body)
	}
}

func TestUpdateAlertRule_MissingAuth(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)
	buf, _ := json.Marshal(map[string]any{"labels": map[string]string{"component": "api"}})
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodPatch,
		"/api/v1/alerting/rules/"+user1Id,
		bytes.NewReader(buf),
	)
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body)
	}
}

func TestUpdateAlertRule_DropPlatformRule(t *testing.T) {
	_, _, platformId := buFixtureIDs()
	f := newBUFixture(t)
	f.mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{}
	}
	f.rebuild()

	enabled := false
	w := f.doSingleUpdate(t, platformId, map[string]any{
		"alertingRuleEnabled": enabled,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	var resp managementrouter.UpdateAlertRuleResult
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Id != platformId || resp.StatusCode != http.StatusNoContent {
		t.Errorf("got id=%s status=%d", resp.Id, resp.StatusCode)
	}
}

func TestUpdateAlertRule_DropUserRuleNotAllowed(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)
	f.mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{}
	}
	f.rebuild()

	enabled := false
	w := f.doSingleUpdate(t, user1Id, map[string]any{
		"alertingRuleEnabled": enabled,
	})
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d: %s", w.Code, w.Body)
	}
}

func TestUpdateAlertRule_ClassificationUserRulesNotAllowed(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)
	component := "networking"
	w := f.doSingleUpdate(t, user1Id, map[string]any{
		"classification": map[string]any{
			"openshift_io_alert_rule_component": component,
		},
	})
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d: %s", w.Code, w.Body)
	}
}
