package e2e

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func TestGetHealth(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	healthURL := f.PluginURL + "/api/v1/alerting/health"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, nil)
	if err != nil {
		t.Fatalf("Failed to create HTTP request: %v", err)
	}
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}

	resp, err := f.HTTPClient().Do(req)
	if err != nil {
		t.Fatalf("Failed to make health request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}

	var healthResp struct {
		Alerting *k8s.AlertingHealth `json:"alerting"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&healthResp); err != nil {
		t.Fatalf("Failed to decode health response: %v", err)
	}

	if healthResp.Alerting == nil {
		t.Fatal("Expected 'alerting' field in health response")
	}

	if healthResp.Alerting.Platform == nil {
		t.Error("Expected 'platform' field in alerting health")
	}

	t.Logf("Health response: userWorkloadEnabled=%v", healthResp.Alerting.UserWorkloadEnabled)
	t.Log("GET /health e2e test passed successfully")
}
