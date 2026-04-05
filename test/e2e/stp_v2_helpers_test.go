package e2e

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

// bearerToken caches the OpenShift bearer token for API requests.
var (
	bearerTokenOnce sync.Once
	bearerToken     string
)

// getBearerToken returns the bearer token, resolving it once from BEARER_TOKEN
// env var, then `oc whoami --show-token`, then the kubeconfig token field.
func getBearerToken() string {
	bearerTokenOnce.Do(func() {
		bearerToken = os.Getenv("BEARER_TOKEN")
		if bearerToken != "" {
			return
		}
		// Try oc CLI (works when logged in interactively)
		out, err := exec.Command("oc", "whoami", "--show-token").Output()
		if err == nil {
			bearerToken = strings.TrimSpace(string(out))
			if bearerToken != "" {
				return
			}
		}
		// Fall back to reading token from kubeconfig
		kubeconfig := os.Getenv("KUBECONFIG")
		if kubeconfig == "" {
			return
		}
		raw, err := os.ReadFile(kubeconfig)
		if err != nil {
			return
		}
		// Simple extraction: look for "token: <value>" in kubeconfig
		for _, line := range strings.Split(string(raw), "\n") {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "token:") {
				bearerToken = strings.TrimSpace(strings.TrimPrefix(trimmed, "token:"))
				return
			}
		}
	})
	return bearerToken
}

// seedRuleIDs stores discovered rule IDs for all seed rules.
type seedRuleIDs struct {
	Watchdog            string
	UserRule            string
	PlatformRule        string
	GitOpsRule          string
	OperatorManaged     string
	PendingRule         string
	CreatedUserRule     string
	CreatedPlatformRule string
}

// getRulesGroupsResponse models the GET /rules JSON envelope.
type getRulesGroupsResponse struct {
	Data     getRulesGroupsResponseData `json:"data"`
	Status   string                     `json:"status,omitempty"`
	Warnings []string                   `json:"warnings,omitempty"`
}

type getRulesGroupsResponseData struct {
	Groups []k8s.PrometheusRuleGroup `json:"groups"`
}

// getAlertsFullResponse models the GET /alerts JSON envelope.
type getAlertsFullResponse struct {
	Data     getAlertsFullResponseData `json:"data"`
	Warnings []string                  `json:"warnings"`
}

type getAlertsFullResponseData struct {
	Alerts []k8s.PrometheusAlert `json:"alerts"`
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

func stpHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
		},
	}
}

// doHTTPRequest builds and executes an HTTP request, returning the raw
// response, body bytes and any error.
func doHTTPRequest(ctx context.Context, method, url string, body interface{}) (*http.Response, []byte, error) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, nil, fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, nil, fmt.Errorf("create request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token := getBearerToken(); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := stpHTTPClient().Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp, nil, fmt.Errorf("read response body: %w", err)
	}
	return resp, respBody, nil
}

// doRawGET sends a raw GET and returns status code + body bytes.
func doRawGET(ctx context.Context, url string) (int, []byte, error) {
	resp, body, err := doHTTPRequest(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return resp.StatusCode, body, nil
}

// ---------------------------------------------------------------------------
// GET helpers
// ---------------------------------------------------------------------------

// listRulesAsGroups fetches GET /rules with optional query params and returns
// the parsed groups.
func listRulesAsGroups(ctx context.Context, pluginURL string, queryParams map[string]string) ([]k8s.PrometheusRuleGroup, error) {
	u := pluginURL + "/api/v1/alerting/rules"
	if len(queryParams) > 0 {
		u += "?"
		first := true
		for k, v := range queryParams {
			if !first {
				u += "&"
			}
			u += k + "=" + v
			first = false
		}
	}

	_, body, err := doHTTPRequest(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}

	var parsed getRulesGroupsResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("decode rules response: %w", err)
	}
	return parsed.Data.Groups, nil
}

// getAlertsWithResponse fetches GET /alerts and returns the full response
// including warnings and the HTTP status code.
func getAlertsWithResponse(ctx context.Context, pluginURL string, queryParams map[string]string) (*getAlertsFullResponse, int, error) {
	u := pluginURL + "/api/v1/alerting/alerts"
	if len(queryParams) > 0 {
		u += "?"
		first := true
		for k, v := range queryParams {
			if !first {
				u += "&"
			}
			u += k + "=" + v
			first = false
		}
	}

	resp, body, err := doHTTPRequest(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, 0, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var parsed getAlertsFullResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("decode alerts response: %w", err)
	}
	return &parsed, resp.StatusCode, nil
}

// getHealth fetches GET /health and returns the parsed response.
func getHealth(ctx context.Context, pluginURL string) (*managementrouter.GetHealthResponse, error) {
	_, body, err := doHTTPRequest(ctx, http.MethodGet, pluginURL+"/api/v1/alerting/health", nil)
	if err != nil {
		return nil, err
	}

	var parsed managementrouter.GetHealthResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("decode health response: %w", err)
	}
	return &parsed, nil
}

// getMetrics fetches GET /metrics and returns the raw text body.
func getMetrics(ctx context.Context, pluginURL string) (string, error) {
	_, body, err := doHTTPRequest(ctx, http.MethodGet, pluginURL+"/metrics", nil)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

// postRule sends POST /rules and returns status code + raw response body.
func postRule(ctx context.Context, pluginURL string, body interface{}) (int, []byte, error) {
	resp, respBody, err := doHTTPRequest(ctx, http.MethodPost, pluginURL+"/api/v1/alerting/rules", body)
	if err != nil {
		return 0, nil, err
	}
	return resp.StatusCode, respBody, nil
}

// patchRule sends PATCH /rules/{ruleId} and returns status code + parsed response.
func patchRule(ctx context.Context, pluginURL string, ruleID string, body interface{}) (int, *managementrouter.UpdateAlertRuleResponse, error) {
	u := fmt.Sprintf("%s/api/v1/alerting/rules/%s", pluginURL, ruleID)
	resp, respBody, err := doHTTPRequest(ctx, http.MethodPatch, u, body)
	if err != nil {
		return 0, nil, err
	}

	var parsed managementrouter.UpdateAlertRuleResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return resp.StatusCode, nil, fmt.Errorf("decode patch response: %w (body: %s)", err, string(respBody))
	}
	return resp.StatusCode, &parsed, nil
}

// patchRulesBulk sends PATCH /rules (bulk) and returns status code + parsed response.
func patchRulesBulk(ctx context.Context, pluginURL string, body interface{}) (int, *managementrouter.BulkUpdateAlertRulesResponse, error) {
	resp, respBody, err := doHTTPRequest(ctx, http.MethodPatch, pluginURL+"/api/v1/alerting/rules", body)
	if err != nil {
		return 0, nil, err
	}

	var parsed managementrouter.BulkUpdateAlertRulesResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return resp.StatusCode, nil, fmt.Errorf("decode bulk patch response: %w (body: %s)", err, string(respBody))
	}
	return resp.StatusCode, &parsed, nil
}

// deleteRule sends DELETE /rules/{ruleId} and returns the HTTP status code + body.
func deleteRule(ctx context.Context, pluginURL string, ruleID string) (int, []byte, error) {
	u := fmt.Sprintf("%s/api/v1/alerting/rules/%s", pluginURL, ruleID)
	resp, body, err := doHTTPRequest(ctx, http.MethodDelete, u, nil)
	if err != nil {
		return 0, nil, err
	}
	return resp.StatusCode, body, nil
}

// deleteRulesBulk sends DELETE /rules (bulk) and returns status code + parsed response.
func deleteRulesBulk(ctx context.Context, pluginURL string, body interface{}) (int, *managementrouter.BulkDeleteUserDefinedAlertRulesResponse, error) {
	resp, respBody, err := doHTTPRequest(ctx, http.MethodDelete, pluginURL+"/api/v1/alerting/rules", body)
	if err != nil {
		return 0, nil, err
	}

	var parsed managementrouter.BulkDeleteUserDefinedAlertRulesResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return resp.StatusCode, nil, fmt.Errorf("decode bulk delete response: %w (body: %s)", err, string(respBody))
	}
	return resp.StatusCode, &parsed, nil
}

// ---------------------------------------------------------------------------
// Seed data helpers
// ---------------------------------------------------------------------------

// createNamedPrometheusRule creates a PrometheusRule with a custom name,
// annotations, and ownerReferences.
func createNamedPrometheusRule(
	ctx context.Context,
	f *framework.Framework,
	name string,
	namespace string,
	groupName string,
	annotations map[string]string,
	ownerRefs []metav1.OwnerReference,
	rules ...monitoringv1.Rule,
) (*monitoringv1.PrometheusRule, error) {
	interval := monitoringv1.Duration("30s")
	pr := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:            name,
			Namespace:       namespace,
			Annotations:     annotations,
			OwnerReferences: ownerRefs,
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{
				{
					Name:     groupName,
					Interval: &interval,
					Rules:    rules,
				},
			},
		},
	}

	return f.Monitoringv1clientset.MonitoringV1().PrometheusRules(namespace).Create(
		ctx, pr, metav1.CreateOptions{},
	)
}

// ---------------------------------------------------------------------------
// Rule search helpers
// ---------------------------------------------------------------------------

// findRuleInGroups searches groups for the first rule matching alertName.
func findRuleInGroups(groups []k8s.PrometheusRuleGroup, alertName string) *k8s.PrometheusRule {
	for gi := range groups {
		for ri := range groups[gi].Rules {
			if groups[gi].Rules[ri].Name == alertName {
				return &groups[gi].Rules[ri]
			}
		}
	}
	return nil
}

// findAllRulesInGroups returns all rules from all groups as a flat slice.
func findAllRulesInGroups(groups []k8s.PrometheusRuleGroup) []k8s.PrometheusRule {
	var out []k8s.PrometheusRule
	for _, g := range groups {
		out = append(out, g.Rules...)
	}
	return out
}

// findRuleIDInGroups searches groups for a rule matching alertName and returns
// its openshift_io_alert_rule_id label value.
func findRuleIDInGroups(groups []k8s.PrometheusRuleGroup, alertName string) string {
	rule := findRuleInGroups(groups, alertName)
	if rule == nil {
		return ""
	}
	return rule.Labels[k8s.AlertRuleLabelId]
}

// pollForRuleID polls GET /rules until a rule with the given alertName appears
// and returns its ID.
func pollForRuleID(ctx context.Context, t *testing.T, pluginURL string, alertName string, timeout time.Duration) string {
	t.Helper()
	var ruleID string
	err := wait.PollUntilContextTimeout(ctx, 2*time.Second, timeout, true, func(ctx context.Context) (bool, error) {
		groups, err := listRulesAsGroups(ctx, pluginURL, nil)
		if err != nil {
			t.Logf("pollForRuleID(%s): list error: %v", alertName, err)
			return false, nil
		}
		id := findRuleIDInGroups(groups, alertName)
		if id == "" {
			return false, nil
		}
		ruleID = id
		return true, nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for rule %q to appear: %v", alertName, err)
	}
	return ruleID
}

// pollForRuleAbsent polls GET /rules until a rule with the given alertName is
// no longer present.
func pollForRuleAbsent(ctx context.Context, t *testing.T, pluginURL string, alertName string, timeout time.Duration) {
	t.Helper()
	err := wait.PollUntilContextTimeout(ctx, 2*time.Second, timeout, true, func(ctx context.Context) (bool, error) {
		groups, err := listRulesAsGroups(ctx, pluginURL, nil)
		if err != nil {
			t.Logf("pollForRuleAbsent(%s): list error: %v", alertName, err)
			return false, nil
		}
		id := findRuleIDInGroups(groups, alertName)
		return id == "", nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for rule %q to disappear: %v", alertName, err)
	}
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

// assertPatchSuccess asserts outer HTTP 200 and inner status_code 204.
func assertPatchSuccess(t *testing.T, httpStatus int, resp *managementrouter.UpdateAlertRuleResponse) {
	t.Helper()
	if httpStatus != http.StatusOK {
		t.Fatalf("Expected outer HTTP 200, got %d", httpStatus)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("Expected inner status_code 204, got %d (message: %s)", resp.StatusCode, resp.Message)
	}
}

// assertPatchStatusCode asserts outer HTTP 200 and a specific inner status_code.
func assertPatchStatusCode(t *testing.T, httpStatus int, resp *managementrouter.UpdateAlertRuleResponse, expected int) {
	t.Helper()
	if httpStatus != http.StatusOK {
		t.Fatalf("Expected outer HTTP 200, got %d", httpStatus)
	}
	if resp.StatusCode != expected {
		t.Fatalf("Expected inner status_code %d, got %d (message: %s)", expected, resp.StatusCode, resp.Message)
	}
}

// boolPtr returns a pointer to a bool value.
func boolPtr(b bool) *bool {
	return &b
}

// strPtr returns a pointer to a string value.
func strPtr(s string) *string {
	return &s
}
