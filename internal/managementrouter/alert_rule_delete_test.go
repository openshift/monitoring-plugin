package managementrouter_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func singleDeleteRequest(t *testing.T, router http.Handler, ruleID string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodDelete,
		"/api/v1/alerting/rules/"+ruleID,
		nil,
	)
	req.Header.Set("Authorization", "Bearer test-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestDeleteAlertRule_Succeeds(t *testing.T) {
	tv := newDeleteRuleRouter(t)
	w := singleDeleteRequest(t, tv.router, tv.userRule1Id)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAlertRule_NotFound(t *testing.T) {
	tv := newDeleteRuleRouter(t)
	w := singleDeleteRequest(t, tv.router, "missing-rule-id")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAlertRule_MissingAuth(t *testing.T) {
	tv := newDeleteRuleRouter(t)
	req := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodDelete,
		"/api/v1/alerting/rules/"+tv.userRule1Id,
		nil,
	)
	w := httptest.NewRecorder()
	tv.router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAlertRule_PlatformRule(t *testing.T) {
	tv := newDeleteRuleRouter(t)
	w := singleDeleteRequest(t, tv.router, tv.platformRuleId)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for platform delete, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAlertRule_BlankRuleId(t *testing.T) {
	tv := newDeleteRuleRouter(t)
	w := singleDeleteRequest(t, tv.router, "%20")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAlertRule_NotAllowed(t *testing.T) {
	gitOpsRule := monitoringv1.Rule{
		Alert: "gitops-alert",
		Labels: map[string]string{
			k8s.PrometheusRuleLabelNamespace:    "default",
			k8s.PrometheusRuleLabelName:         "gitops-pr",
			managementlabels.RuleManagedByLabel: managementlabels.ManagedByGitOps,
		},
	}
	gitOpsRuleID := alertrule.GetAlertingRuleId(&gitOpsRule)

	mockK8s := &testutils.MockClient{}
	mockK8s.RelabeledRulesFunc = func() k8s.RelabeledRulesInterface {
		return &testutils.MockRelabeledRulesInterface{
			GetFunc: func(_ context.Context, id string) (monitoringv1.Rule, bool) {
				if id == gitOpsRuleID {
					return gitOpsRule, true
				}
				return monitoringv1.Rule{}, false
			},
		}
	}
	mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
		return &testutils.MockNamespaceInterface{
			IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
		}
	}
	r := managementrouter.New(management.New(context.Background(), mockK8s))

	w := singleDeleteRequest(t, r, gitOpsRuleID)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteAlertRule_ErrorBodyIncludesMessage(t *testing.T) {
	tv := newDeleteRuleRouter(t)
	w := singleDeleteRequest(t, tv.router, "missing-rule-id")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "error") {
		t.Errorf("expected error payload, got %s", w.Body.String())
	}
}
