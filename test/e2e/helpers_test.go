package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func strPtr(s string) *string { return &s }

func createRuleViaAPI(t *testing.T, f *framework.Framework, ctx context.Context, namespace, alertName, prName string) string {
	t.Helper()

	// Each rule needs a unique expression so the spec-equivalence check
	// does not reject it as a duplicate of a rule from another test.
	// absent() returns 1 when the selector matches nothing, which is
	// always the case for a fabricated metric name.
	expr := fmt.Sprintf("absent(nonexistent{e2e_rule=%q})", alertName)

	payload := managementrouter.CreateAlertRuleRequest{
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
	}

	reqBody, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Failed to marshal create request for %s: %v", alertName, err)
	}

	createURL := f.PluginURL + "/api/v1/alerting/rules"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, createURL, bytes.NewBuffer(reqBody))
	if err != nil {
		t.Fatalf("Failed to create HTTP request for %s: %v", alertName, err)
	}
	req.Header.Set("Content-Type", "application/json")
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		t.Fatalf("Failed to make create request for %s: %v", alertName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Create %s: expected 201, got %d. Body: %s", alertName, resp.StatusCode, string(body))
	}

	var createResp managementrouter.CreateAlertRuleResponse
	if err := json.NewDecoder(resp.Body).Decode(&createResp); err != nil {
		t.Fatalf("Failed to decode create response for %s: %v", alertName, err)
	}

	if createResp.Id == "" {
		t.Fatalf("Got empty ID for %s", alertName)
	}
	return createResp.Id
}
