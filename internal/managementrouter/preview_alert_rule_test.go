package managementrouter_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

func TestPreviewAlertRule_CreateUserDefined(t *testing.T) {
	mockK8sRules := &testutils.MockPrometheusRuleInterface{}
	mockK8s := &testutils.MockClient{
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface { return mockK8sRules },
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]any{
		"alertingRule": map[string]any{
			"alert":  "cpuHigh",
			"expr":   "vector(1)",
			"labels": map[string]string{"severity": "warning"},
		},
		"prometheusRule": map[string]any{
			"prometheusRuleName":      "user-pr",
			"prometheusRuleNamespace": "default",
		},
	}
	buf, _ := json.Marshal(body)
	req := bearerRequest(t, "/api/v1/alerting/rules/preview", buf)
	req.Method = http.MethodPost
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Writable    bool `json:"writable"`
		DesiredRule struct {
			Alert  string            `json:"alert"`
			Labels map[string]string `json:"labels"`
		} `json:"desiredRule"`
		Resources []struct {
			Resource struct {
				Kind string `json:"kind"`
				Name string `json:"name"`
			} `json:"resource"`
			Changes []struct {
				Field     string `json:"field"`
				Operation string `json:"operation"`
			} `json:"changes"`
		} `json:"resources"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !resp.Writable {
		t.Fatal("expected writable=true")
	}
	if len(resp.Resources) != 1 || resp.Resources[0].Resource.Kind != "PrometheusRule" {
		t.Fatalf("unexpected resources: %+v", resp.Resources)
	}
	if len(resp.Resources[0].Changes) != 1 || resp.Resources[0].Changes[0].Field != "rule" {
		t.Fatalf("expected one rule add change, got %+v", resp.Resources[0].Changes)
	}
	if resp.DesiredRule.Alert != "cpuHigh" {
		t.Fatalf("expected desiredRule.alert=cpuHigh, got %q", resp.DesiredRule.Alert)
	}

	pr, found, _ := mockK8sRules.Get(context.Background(), "default", "user-pr")
	if found && pr != nil {
		for _, g := range pr.Spec.Groups {
			for _, r := range g.Rules {
				if r.Alert == "cpuHigh" {
					t.Fatal("preview must not persist create")
				}
			}
		}
	}
}

func TestPreviewAlertRule_CreateGitOpsManaged(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{
				IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
			}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{}
		},
		PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
			return &testutils.MockPrometheusRuleInterface{
				GetFunc: func(_ context.Context, namespace, name string) (*monitoringv1.PrometheusRule, bool, error) {
					return &monitoringv1.PrometheusRule{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:   namespace,
							Name:        name,
							Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "gitops"},
						},
					}, true, nil
				},
			}
		},
	}
	router := newTestRouter(mockK8s)

	body := map[string]any{
		"alertingRule": map[string]any{"alert": "cpuHigh", "expr": "vector(1)"},
		"prometheusRule": map[string]any{
			"prometheusRuleName":      "user-pr",
			"prometheusRuleNamespace": "default",
		},
	}
	buf, _ := json.Marshal(body)
	req := bearerRequest(t, "/api/v1/alerting/rules/preview", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Writable  bool   `json:"writable"`
		ManagedBy string `json:"managedBy"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Writable {
		t.Fatal("expected writable=false")
	}
	if resp.ManagedBy != "gitops" {
		t.Fatalf("expected managedBy=gitops, got %q", resp.ManagedBy)
	}
}

func TestPreviewAlertRule_InvalidCreateBody(t *testing.T) {
	router := newTestRouter(&testutils.MockClient{})
	req := bearerRequest(t, "/api/v1/alerting/rules/preview", []byte(`{}`))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestPreviewAlertRule_UpdateMissingRule(t *testing.T) {
	mockK8s := &testutils.MockClient{
		NamespaceFunc: func() k8s.NamespaceInterface {
			return &testutils.MockNamespaceInterface{}
		},
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{}
		},
	}
	router := newTestRouter(mockK8s)
	body := map[string]any{
		"ruleId": "missing",
		"labels": map[string]string{"severity": "critical"},
	}
	buf, _ := json.Marshal(body)
	req := bearerRequest(t, "/api/v1/alerting/rules/preview", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPreviewAlertRule_UpdateNoMutationFields(t *testing.T) {
	router := newTestRouter(&testutils.MockClient{})
	body := map[string]any{"ruleId": "some-id"}
	buf, _ := json.Marshal(body)
	req := bearerRequest(t, "/api/v1/alerting/rules/preview", buf)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
