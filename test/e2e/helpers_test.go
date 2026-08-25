//go:build e2e

package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func createRuleViaAPIWithRetry(ctx context.Context, f *framework.Framework, createAlertRuleRequest managementrouter.CreateAlertRuleRequest) (string, error) {
	var id string
	err := framework.Poll(time.Second, 20*time.Second, func() error {
		var err error
		id, err = createRuleViaAPI(ctx, f, createAlertRuleRequest)
		if err != nil {
			return fmt.Errorf("failed to create alert rule: %w", err)
		}
		return nil
	})
	return id, err
}

func strPtr(s string) *string { return &s }

// findPlatformAlertRuleId discovers an existing platform alert rule from
// openshift-monitoring and returns its computed alert rule ID.
func findPlatformAlertRuleId(ctx context.Context, t *testing.T, f *framework.Framework) string {
	t.Helper()

	prList, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list PrometheusRules in %s: %v", k8s.ClusterMonitoringNamespace, err)
	}

	for _, pr := range prList.Items {
		for _, group := range pr.Spec.Groups {
			for i := range group.Rules {
				rule := &group.Rules[i]
				if rule.Alert == "" {
					continue
				}
				id := alertrule.GetAlertingRuleId(rule)
				if id != "" {
					return id
				}
			}
		}
	}

	t.Fatal("No platform alert rules found in openshift-monitoring")
	return ""
}

func createRuleViaAPI(ctx context.Context, f *framework.Framework, payload managementrouter.CreateAlertRuleRequest) (string, error) {
	reqBody, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal create request: %w", err)
	}

	createURL, err := url.JoinPath(f.PluginURL, "api/v1/alerting/rules")
	if err != nil {
		return "", fmt.Errorf("build create URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, createURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return "", fmt.Errorf("create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		return "", fmt.Errorf("make create request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", fmt.Errorf("failed to read body: %w", err)
		}
		return "", fmt.Errorf("expected 201, got %d: %s", resp.StatusCode, string(body))
	}

	var createResp managementrouter.CreateAlertRuleResponse
	if err := json.NewDecoder(resp.Body).Decode(&createResp); err != nil {
		return "", fmt.Errorf("decode create response: %w", err)
	}

	if createResp.Id == "" {
		return "", fmt.Errorf("got empty ID")
	}
	return createResp.Id, nil
}

// mustCreateRule is a test convenience wrapper around createRuleViaAPI that
// builds the request from individual parameters and calls t.Fatal on error.
func tryPreviewAlertRule(
	ctx context.Context,
	f *framework.Framework,
	token string,
	payload managementrouter.PreviewAlertRuleRequest,
) (int, *managementrouter.PreviewAlertRuleResponse, error) {
	reqBody, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, fmt.Errorf("marshal preview request: %w", err)
	}

	previewURL, err := url.JoinPath(f.PluginURL, "api/v1/alerting/rules/preview")
	if err != nil {
		return 0, nil, fmt.Errorf("build preview URL: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, previewURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return 0, nil, fmt.Errorf("create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("make preview request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		_, _ = io.ReadAll(resp.Body)
		return resp.StatusCode, nil, nil
	}

	var previewResp managementrouter.PreviewAlertRuleResponse
	if err := json.NewDecoder(resp.Body).Decode(&previewResp); err != nil {
		return resp.StatusCode, nil, fmt.Errorf("decode preview response: %w", err)
	}
	return resp.StatusCode, &previewResp, nil
}

func previewCreatePayload(namespace, alertName, prName string) managementrouter.PreviewAlertRuleRequest {
	expr := fmt.Sprintf("absent(nonexistent{e2e_preview_create=%q})", alertName)
	return managementrouter.PreviewAlertRuleRequest{
		AlertingRule: &managementrouter.AlertRuleSpec{
			Alert: &alertName,
			Expr:  &expr,
			Labels: &map[string]string{
				"severity": "info",
			},
		},
		PrometheusRule: &managementrouter.PrometheusRuleTarget{
			PrometheusRuleName:      prName,
			PrometheusRuleNamespace: namespace,
		},
	}
}

func previewUpdateProbeRequest(ruleID string) managementrouter.PreviewAlertRuleRequest {
	labelVal := "true"
	return managementrouter.PreviewAlertRuleRequest{
		RuleId: &ruleID,
		Labels: &map[string]*string{"e2e_preview_probe": &labelVal},
	}
}

func alertNamesInPrometheusRule(ctx context.Context, f *framework.Framework, namespace, prName string) ([]string, error) {
	pr, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(namespace).Get(ctx, prName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	var names []string
	for _, group := range pr.Spec.Groups {
		for _, rule := range group.Rules {
			if rule.Alert != "" {
				names = append(names, rule.Alert)
			}
		}
	}
	return names, nil
}

func mustCreateRule(ctx context.Context, t *testing.T, f *framework.Framework, namespace, alertName, prName string) string {
	t.Helper()

	expr := fmt.Sprintf("absent(nonexistent{e2e_rule=%q})", alertName)

	id, err := createRuleViaAPI(ctx, f, managementrouter.CreateAlertRuleRequest{
		AlertingRule: &managementrouter.AlertRuleSpec{
			Alert: &alertName,
			Expr:  &expr,
			For:   strPtr("1m"),
			Labels: &map[string]string{
				"severity": "info",
			},
		},
		PrometheusRule: &managementrouter.PrometheusRuleTarget{
			PrometheusRuleName:      prName,
			PrometheusRuleNamespace: namespace,
		},
	})
	if err != nil {
		t.Fatalf("Failed to create rule %s in %s: %v", alertName, namespace, err)
	}
	return id
}
