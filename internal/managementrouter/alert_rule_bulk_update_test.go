package managementrouter_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

// buFixture holds all mocks and the router under test for bulk-update tests.
// Mutate mockK8s fields, then call rebuild() before the next request.
type buFixture struct {
	router             http.Handler
	mockK8sRules       *testutils.MockPrometheusRuleInterface
	mockK8s            *testutils.MockClient
	mockRelabeledRules *testutils.MockRelabeledRulesInterface
}

func (f *buFixture) rebuild() {
	mgmt := management.New(context.Background(), f.mockK8s)
	f.router = managementrouter.New(mgmt)
}

func newBUFixture(t *testing.T) *buFixture {
	t.Helper()

	userRule1 := monitoringv1.Rule{
		Alert:  "user-alert-1",
		Expr:   intstr.FromString("up == 0"),
		Labels: map[string]string{"severity": "warning"},
	}
	userRule1Id := alertrule.GetAlertingRuleId(&userRule1)

	userRule2 := monitoringv1.Rule{
		Alert:  "user-alert-2",
		Expr:   intstr.FromString("cpu > 80"),
		Labels: map[string]string{"severity": "info"},
	}
	userRule2Id := alertrule.GetAlertingRuleId(&userRule2)

	platformRule := monitoringv1.Rule{
		Alert:  "platform-alert",
		Expr:   intstr.FromString("memory > 90"),
		Labels: map[string]string{"severity": "critical"},
	}
	platformRuleId := alertrule.GetAlertingRuleId(&platformRule)

	mockK8sRules := &testutils.MockPrometheusRuleInterface{}

	userPR := monitoringv1.PrometheusRule{}
	userPR.Name = "user-pr"
	userPR.Namespace = "default"
	userPR.Spec.Groups = []monitoringv1.RuleGroup{{
		Name: "g1",
		Rules: []monitoringv1.Rule{
			{Alert: userRule1.Alert, Expr: userRule1.Expr, Labels: map[string]string{"severity": "warning", k8s.AlertRuleLabelId: userRule1Id}},
			{Alert: userRule2.Alert, Expr: userRule2.Expr, Labels: map[string]string{"severity": "info", k8s.AlertRuleLabelId: userRule2Id}},
		},
	}}

	platformPR := monitoringv1.PrometheusRule{}
	platformPR.Name = "platform-pr"
	platformPR.Namespace = "platform-namespace-1"
	platformPR.Spec.Groups = []monitoringv1.RuleGroup{{
		Name: "pg1",
		Rules: []monitoringv1.Rule{
			{Alert: "platform-alert", Expr: intstr.FromString("memory > 90"), Labels: map[string]string{"severity": "critical"}},
		},
	}}

	mockK8sRules.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
		"default/user-pr":                  &userPR,
		"platform-namespace-1/platform-pr": &platformPR,
	})

	mockRelabeledRules := &testutils.MockRelabeledRulesInterface{
		GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
			switch id {
			case userRule1Id:
				return monitoringv1.Rule{
					Alert: userRule1.Alert, Expr: userRule1.Expr,
					Labels: map[string]string{
						"severity": "warning", k8s.AlertRuleLabelId: userRule1Id,
						k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr",
					},
				}, true
			case userRule2Id:
				return monitoringv1.Rule{
					Alert: userRule2.Alert, Expr: userRule2.Expr,
					Labels: map[string]string{
						"severity": "info", k8s.AlertRuleLabelId: userRule2Id,
						k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr",
					},
				}, true
			case platformRuleId:
				return monitoringv1.Rule{
					Alert: "platform-alert", Expr: intstr.FromString("memory > 90"),
					Labels: map[string]string{
						"severity": "critical", k8s.AlertRuleLabelId: platformRuleId,
						k8s.PrometheusRuleLabelNamespace: "platform-namespace-1", k8s.PrometheusRuleLabelName: "platform-pr",
					},
				}, true
			}
			return monitoringv1.Rule{}, false
		},
	}

	mockK8s := &testutils.MockClient{
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface { return mockK8sRules },
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(name string) bool {
					return name == "platform-namespace-1" || name == "platform-namespace-2"
				},
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface { return mockRelabeledRules },
	}

	f := &buFixture{
		mockK8sRules:       mockK8sRules,
		mockK8s:            mockK8s,
		mockRelabeledRules: mockRelabeledRules,
	}
	f.rebuild()
	return f
}

// ids returns stable rule IDs for the three default fixture rules in order:
// user1, user2, platform.
func buFixtureIDs() (user1, user2, platform string) {
	r1 := monitoringv1.Rule{Alert: "user-alert-1", Expr: intstr.FromString("up == 0"), Labels: map[string]string{"severity": "warning"}}
	r2 := monitoringv1.Rule{Alert: "user-alert-2", Expr: intstr.FromString("cpu > 80"), Labels: map[string]string{"severity": "info"}}
	rp := monitoringv1.Rule{Alert: "platform-alert", Expr: intstr.FromString("memory > 90"), Labels: map[string]string{"severity": "critical"}}
	return alertrule.GetAlertingRuleId(&r1), alertrule.GetAlertingRuleId(&r2), alertrule.GetAlertingRuleId(&rp)
}

func (f *buFixture) do(t *testing.T, body any) *httptest.ResponseRecorder {
	t.Helper()
	buf, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(buf))
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	return w
}

func (f *buFixture) decodeResp(t *testing.T, w *httptest.ResponseRecorder) managementrouter.BulkUpdateAlertRulesResponse {
	t.Helper()
	var resp managementrouter.BulkUpdateAlertRulesResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

// --- Tests ---

func TestBulkUpdateAlertRules_UpdatesAllUserRules(t *testing.T) {
	user1Id, user2Id, _ := buFixtureIDs()
	f := newBUFixture(t)

	expectedId1 := alertrule.GetAlertingRuleId(&monitoringv1.Rule{
		Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
		Labels: map[string]string{"severity": "warning", "component": "api", "team": "backend"},
	})
	expectedId2 := alertrule.GetAlertingRuleId(&monitoringv1.Rule{
		Alert: "user-alert-2", Expr: intstr.FromString("cpu > 80"),
		Labels: map[string]string{"severity": "info", "component": "api", "team": "backend"},
	})

	w := f.do(t, map[string]any{
		"ruleIds": []string{user1Id, user2Id},
		"labels":  map[string]string{"component": "api", "team": "backend"},
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(resp.Rules))
	}
	if resp.Rules[0].Id != expectedId1 || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("rule[0]: id=%s status=%d", resp.Rules[0].Id, resp.Rules[0].StatusCode)
	}
	if resp.Rules[1].Id != expectedId2 || resp.Rules[1].StatusCode != http.StatusNoContent {
		t.Errorf("rule[1]: id=%s status=%d", resp.Rules[1].Id, resp.Rules[1].StatusCode)
	}
}

func TestBulkUpdateAlertRules_DropsLabelWithEmptyString(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)

	expectedId := alertrule.GetAlertingRuleId(&monitoringv1.Rule{
		Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
		Labels: map[string]string{"severity": "critical"},
	})

	f.mockRelabeledRules.GetFunc = func(_ context.Context, id string) (monitoringv1.Rule, bool) {
		if id == user1Id {
			return monitoringv1.Rule{
				Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning", "team": "backend",
					k8s.AlertRuleLabelId: user1Id, k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr",
				},
			}, true
		}
		return monitoringv1.Rule{}, false
	}
	f.rebuild()

	w := f.do(t, map[string]any{
		"ruleIds": []string{user1Id},
		"labels":  map[string]string{"team": "", "severity": "critical"},
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 1 || resp.Rules[0].Id != expectedId || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("unexpected result: %+v", resp.Rules)
	}
}

func TestBulkUpdateAlertRules_DropsLabelWithNull(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)

	// JSON null for a label key means "drop", same as empty string.
	expectedId := alertrule.GetAlertingRuleId(&monitoringv1.Rule{
		Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
		Labels: map[string]string{"severity": "critical"},
	})

	f.mockRelabeledRules.GetFunc = func(_ context.Context, id string) (monitoringv1.Rule, bool) {
		if id == user1Id {
			return monitoringv1.Rule{
				Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning", "team": "backend",
					k8s.AlertRuleLabelId: user1Id, k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr",
				},
			}, true
		}
		return monitoringv1.Rule{}, false
	}
	f.rebuild()

	// Send {"team": null, "severity": "critical"} — null drops the label.
	body := map[string]any{
		"ruleIds": []string{user1Id},
		"labels":  map[string]any{"team": nil, "severity": "critical"},
	}
	w := f.do(t, body)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 1 || resp.Rules[0].Id != expectedId || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("unexpected result: %+v", resp.Rules)
	}
}

func TestBulkUpdateAlertRules_MixedPlatformAndUserRules(t *testing.T) {
	user1Id, _, platformId := buFixtureIDs()
	f := newBUFixture(t)

	expectedId1 := alertrule.GetAlertingRuleId(&monitoringv1.Rule{
		Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
		Labels: map[string]string{"severity": "warning", "component": "api"},
	})

	f.mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{}
	}
	f.rebuild()

	w := f.do(t, map[string]any{
		"ruleIds": []string{user1Id, platformId},
		"labels":  map[string]string{"component": "api"},
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(resp.Rules))
	}
	if resp.Rules[0].Id != expectedId1 || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("rule[0]: id=%s status=%d", resp.Rules[0].Id, resp.Rules[0].StatusCode)
	}
	if resp.Rules[1].Id != platformId || resp.Rules[1].StatusCode != http.StatusNoContent {
		t.Errorf("rule[1]: id=%s status=%d", resp.Rules[1].Id, resp.Rules[1].StatusCode)
	}
}

func TestBulkUpdateAlertRules_InvalidBody(t *testing.T) {
	f := newBUFixture(t)
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewBufferString("{"))
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "invalid request body") {
		t.Errorf("expected 'invalid request body', got: %s", w.Body)
	}
}

func TestBulkUpdateAlertRules_BodyTooLarge(t *testing.T) {
	f := newBUFixture(t)
	// Build a body larger than maxRequestBodyBytes (1 MB).
	large := make([]byte, 1<<20+1)
	for i := range large {
		large[i] = 'a'
	}
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerting/rules", bytes.NewReader(large))
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d: %s", w.Code, w.Body)
	}
	if !strings.Contains(w.Body.String(), "request body too large") {
		t.Errorf("expected 'request body too large', got: %s", w.Body)
	}
}

func TestBulkUpdateAlertRules_EmptyRuleIds(t *testing.T) {
	f := newBUFixture(t)
	w := f.do(t, map[string]any{
		"ruleIds": []string{},
		"labels":  map[string]string{"component": "api"},
	})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "ruleIds is required") {
		t.Errorf("expected 'ruleIds is required', got: %s", w.Body)
	}
}

func TestBulkUpdateAlertRules_MissingAllUpdateFields(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)
	w := f.do(t, map[string]any{"ruleIds": []string{user1Id}})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "alertingRuleEnabled") {
		t.Errorf("expected 'alertingRuleEnabled' in message, got: %s", w.Body)
	}
}

func TestBulkUpdateAlertRules_EnabledToggle(t *testing.T) {
	user1Id, _, platformId := buFixtureIDs()
	f := newBUFixture(t)

	f.mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{}
	}
	f.rebuild()

	w := f.do(t, map[string]any{
		"ruleIds":             []string{platformId, user1Id, "rid_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
		"alertingRuleEnabled": false,
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 3 {
		t.Fatalf("expected 3 rules, got %d", len(resp.Rules))
	}
	if resp.Rules[0].Id != platformId || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("platform[0]: id=%s status=%d", resp.Rules[0].Id, resp.Rules[0].StatusCode)
	}
	if resp.Rules[1].Id != user1Id || resp.Rules[1].StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("user[1]: expected 405, got id=%s status=%d", resp.Rules[1].Id, resp.Rules[1].StatusCode)
	}
	if resp.Rules[2].StatusCode != http.StatusNotFound {
		t.Errorf("missing[2]: expected 404, got status=%d", resp.Rules[2].StatusCode)
	}
}

func TestBulkUpdateAlertRules_MixedNotFound(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)

	expectedId := alertrule.GetAlertingRuleId(&monitoringv1.Rule{
		Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
		Labels: map[string]string{"severity": "warning", "component": "api"},
	})

	f.mockRelabeledRules.GetFunc = func(_ context.Context, id string) (monitoringv1.Rule, bool) {
		if id == user1Id {
			return monitoringv1.Rule{
				Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning", k8s.AlertRuleLabelId: user1Id,
					k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr",
				},
			}, true
		}
		return monitoringv1.Rule{}, false
	}
	f.rebuild()

	w := f.do(t, map[string]any{
		"ruleIds": []string{user1Id, "rid_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
		"labels":  map[string]string{"component": "api"},
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(resp.Rules))
	}
	if resp.Rules[0].Id != expectedId || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("rule[0]: id=%s status=%d", resp.Rules[0].Id, resp.Rules[0].StatusCode)
	}
	if resp.Rules[1].StatusCode != http.StatusNotFound {
		t.Errorf("rule[1]: expected 404, got %d", resp.Rules[1].StatusCode)
	}
}

func TestBulkUpdateAlertRules_InvalidRuleId(t *testing.T) {
	user1Id, _, _ := buFixtureIDs()
	f := newBUFixture(t)

	expectedId := alertrule.GetAlertingRuleId(&monitoringv1.Rule{
		Alert: "user-alert-1", Expr: intstr.FromString("up == 0"),
		Labels: map[string]string{"severity": "warning", "component": "api"},
	})

	w := f.do(t, map[string]any{
		"ruleIds": []string{user1Id, ""},
		"labels":  map[string]string{"component": "api"},
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(resp.Rules))
	}
	if resp.Rules[0].Id != expectedId || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("rule[0]: id=%s status=%d", resp.Rules[0].Id, resp.Rules[0].StatusCode)
	}
	if resp.Rules[1].StatusCode != http.StatusBadRequest {
		t.Errorf("rule[1]: expected 400, got %d", resp.Rules[1].StatusCode)
	}
	if resp.Rules[1].Message == nil || !strings.Contains(*resp.Rules[1].Message, "missing ruleId") {
		t.Errorf("rule[1]: expected 'missing ruleId', got %v", resp.Rules[1].Message)
	}
}

func TestBulkUpdateAlertRules_RestoreToggle(t *testing.T) {
	_, _, platformId := buFixtureIDs()
	f := newBUFixture(t)

	// Simulate an existing ARC that holds a Drop config for the platform rule.
	// RestorePlatformAlertRule will call AlertRelabelConfigs().Get() and then
	// Delete() the ARC once the Drop entry is removed (stamp-only ARC gets deleted).
	mockARC := &testutils.MockAlertRelabelConfigInterface{}
	mockARC.GetFunc = func(_ context.Context, namespace, name string) (*osmv1.AlertRelabelConfig, bool, error) {
		arc := &osmv1.AlertRelabelConfig{}
		arc.Namespace = namespace
		arc.Name = name
		arc.Spec.Configs = []osmv1.RelabelConfig{
			{
				SourceLabels: []osmv1.LabelName{"openshift_io_alert_rule_id"},
				Regex:        regexp.QuoteMeta(platformId),
				Action:       "Drop",
			},
		}
		return arc, true, nil
	}
	f.mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface { return mockARC }
	f.rebuild()

	w := f.do(t, map[string]any{
		"ruleIds":             []string{platformId},
		"alertingRuleEnabled": true,
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 1 {
		t.Fatalf("expected 1 rule, got %d", len(resp.Rules))
	}
	if resp.Rules[0].Id != platformId || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("restore: id=%s status=%d", resp.Rules[0].Id, resp.Rules[0].StatusCode)
	}
}

func TestBulkUpdateAlertRules_ClassificationOnly(t *testing.T) {
	t.Setenv("ENABLE_USER_WORKLOAD_ARCS", "true")
	user1Id, user2Id, _ := buFixtureIDs()

	// Build fixture after Setenv so management.New captures the env flag.
	f := newBUFixture(t)
	f.mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
		return &testutils.MockAlertRelabelConfigInterface{}
	}
	f.rebuild()

	w := f.do(t, map[string]any{
		"ruleIds": []string{user1Id, user2Id},
		"classification": map[string]any{
			"openshift_io_alert_rule_component": "team-x",
			"openshift_io_alert_rule_layer":     "namespace",
		},
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	resp := f.decodeResp(t, w)
	if len(resp.Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(resp.Rules))
	}
	if resp.Rules[0].StatusCode != http.StatusNoContent || resp.Rules[1].StatusCode != http.StatusNoContent {
		t.Errorf("expected both rules 204, got %d / %d", resp.Rules[0].StatusCode, resp.Rules[1].StatusCode)
	}
}
