package managementrouter_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

// deleteRuleTestVars holds the shared rule fixtures used across delete tests.
type deleteRuleTestVars struct {
	userRule1Id    string
	userRule2Id    string
	platformRuleId string
	router         http.Handler
}

func newDeleteRuleRouter(t *testing.T) deleteRuleTestVars {
	t.Helper()

	userRule1Name := "u1"
	userRule1 := monitoringv1.Rule{Alert: userRule1Name, Labels: map[string]string{k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr"}}
	userRule1Id := alertrule.GetAlertingRuleId(&userRule1)

	userRule2Name := "u2"
	userRule2 := monitoringv1.Rule{Alert: userRule2Name, Labels: map[string]string{k8s.PrometheusRuleLabelNamespace: "default", k8s.PrometheusRuleLabelName: "user-pr"}}
	userRule2Id := alertrule.GetAlertingRuleId(&userRule2)

	platformRuleName := "platform"
	platformRule := monitoringv1.Rule{Alert: platformRuleName, Labels: map[string]string{k8s.PrometheusRuleLabelNamespace: "platform-namespace-1", k8s.PrometheusRuleLabelName: "platform-pr"}}
	platformRuleId := alertrule.GetAlertingRuleId(&platformRule)

	mockK8s := &testutils.MockClient{}
	mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
		return &testutils.MockPrometheusRuleInterface{
			GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
				return &monitoringv1.PrometheusRule{
					ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
					Spec: monitoringv1.PrometheusRuleSpec{
						Groups: []monitoringv1.RuleGroup{
							{Rules: []monitoringv1.Rule{userRule1, userRule2, platformRule}},
						},
					},
				}, true, nil
			},
			DeleteFunc: func(_ context.Context, _, _ string) error { return nil },
			UpdateFunc: func(_ context.Context, _ monitoringv1.PrometheusRule) error { return nil },
		}
	}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				switch id {
				case userRule1Id:
					return userRule1, true
				case userRule2Id:
					return userRule2, true
				case platformRuleId:
					return platformRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
		return &testutils.MockAlertingRuleInterface{
			GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
				if name == "platform-alert-rules" {
					return &osmv1.AlertingRule{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "platform-alert-rules",
							Namespace: k8s.ClusterMonitoringNamespace,
						},
						Spec: osmv1.AlertingRuleSpec{
							Groups: []osmv1.RuleGroup{
								{Name: "test-group", Rules: []osmv1.Rule{{Alert: platformRuleName}}},
							},
						},
					}, true, nil
				}
				return nil, false, nil
			},
			UpdateFunc: func(_ context.Context, _ osmv1.AlertingRule) error { return nil },
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(name string) bool {
				return strings.HasPrefix(name, "platform-namespace-")
			},
		}
	}

	mgmt := management.New(context.Background(), mockK8s)
	r := managementrouter.New(mgmt)

	return deleteRuleTestVars{
		userRule1Id:    userRule1Id,
		userRule2Id:    userRule2Id,
		platformRuleId: platformRuleId,
		router:         r,
	}
}

func deleteRequest(t *testing.T, router http.Handler, body any) *httptest.ResponseRecorder {
	t.Helper()
	buf, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules", bytes.NewReader(buf))
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestBulkDeleteUserDefinedAlertRules_MixedResults(t *testing.T) {
	tv := newDeleteRuleRouter(t)

	w := deleteRequest(t, tv.router, map[string]any{
		"ruleIds": []string{tv.userRule1Id, tv.platformRuleId, ""},
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Rules []struct {
			Id         string `json:"id"`
			StatusCode int    `json:"statusCode"`
			Message    string `json:"message"`
		} `json:"rules"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Rules) != 3 {
		t.Fatalf("expected 3 results, got %d", len(resp.Rules))
	}
	if resp.Rules[0].Id != tv.userRule1Id || resp.Rules[0].StatusCode != http.StatusNoContent {
		t.Errorf("rule[0]: want id=%s status=204, got id=%s status=%d msg=%s", tv.userRule1Id, resp.Rules[0].Id, resp.Rules[0].StatusCode, resp.Rules[0].Message)
	}
	if resp.Rules[1].Id != tv.platformRuleId || resp.Rules[1].StatusCode != http.StatusNoContent {
		t.Errorf("rule[1]: want id=%s status=204, got id=%s status=%d msg=%s", tv.platformRuleId, resp.Rules[1].Id, resp.Rules[1].StatusCode, resp.Rules[1].Message)
	}
	if resp.Rules[2].Id != "" || resp.Rules[2].StatusCode != http.StatusBadRequest {
		t.Errorf("rule[2]: want id='' status=400, got id=%s status=%d", resp.Rules[2].Id, resp.Rules[2].StatusCode)
	}
	if !strings.Contains(resp.Rules[2].Message, "missing ruleId") {
		t.Errorf("rule[2]: want 'missing ruleId' in message, got %q", resp.Rules[2].Message)
	}
}

func TestBulkDeleteUserDefinedAlertRules_AllSucceed(t *testing.T) {
	tv := newDeleteRuleRouter(t)

	w := deleteRequest(t, tv.router, map[string]any{
		"ruleIds": []string{tv.userRule1Id, tv.userRule2Id},
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Rules []struct {
			Id         string `json:"id"`
			StatusCode int    `json:"statusCode"`
			Message    string `json:"message"`
		} `json:"rules"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Rules) != 2 {
		t.Fatalf("expected 2 results, got %d", len(resp.Rules))
	}
	for i, rule := range resp.Rules {
		if rule.StatusCode != http.StatusNoContent {
			t.Errorf("rule[%d]: expected 204, got %d: %s", i, rule.StatusCode, rule.Message)
		}
	}
}

func TestBulkDeleteUserDefinedAlertRules_InvalidBody(t *testing.T) {
	tv := newDeleteRuleRouter(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules", bytes.NewBufferString("{"))
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	tv.router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "invalid request body") {
		t.Errorf("expected 'invalid request body', got: %s", w.Body.String())
	}
}

func TestBulkDeleteUserDefinedAlertRules_EmptyRuleIds(t *testing.T) {
	tv := newDeleteRuleRouter(t)

	w := deleteRequest(t, tv.router, map[string]interface{}{"ruleIds": []string{}})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "ruleIds is required") {
		t.Errorf("expected 'ruleIds is required', got: %s", w.Body.String())
	}
}
