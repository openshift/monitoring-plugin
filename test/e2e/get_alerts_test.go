package e2e

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func TestGetAlerts(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	testNamespace, cleanup, err := f.CreateNamespace(ctx, "test-get-alerts", false)
	if err != nil {
		t.Fatalf("Failed to create test namespace: %v", err)
	}
	defer cleanup()

	forDuration := monitoringv1.Duration("1s")
	alertName := "E2EGetAlertsTest"

	promRule := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "e2e-get-alerts-rule",
			Namespace: testNamespace,
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{
				{
					Name: "e2e-test-group",
					Rules: []monitoringv1.Rule{
						{
							Alert: alertName,
							Expr:  intstr.FromString("vector(1)"),
							For:   &forDuration,
							Labels: map[string]string{
								"severity": "none",
								"team":     "e2e",
							},
							Annotations: map[string]string{
								"summary": "E2E test alert for GET /alerts",
							},
						},
					},
				},
			},
		},
	}

	_, err = f.Monitoringv1clientset.MonitoringV1().PrometheusRules(testNamespace).Create(
		ctx, promRule, metav1.CreateOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to create PrometheusRule: %v", err)
	}

	httpClient := f.HTTPClient()
	err = wait.PollUntilContextTimeout(ctx, 5*time.Second, 3*time.Minute, true, func(ctx context.Context) (bool, error) {
		alertsURL := f.PluginURL + "/api/v1/alerting/alerts"
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, alertsURL, nil)
		if err != nil {
			return false, err
		}
		if f.BearerToken != "" {
			req.Header.Set("Authorization", "Bearer "+f.BearerToken)
		}

		resp, err := httpClient.Do(req)
		if err != nil {
			t.Logf("Failed to query alerts: %v", err)
			return false, nil
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Logf("GET /alerts returned status %d, retrying", resp.StatusCode)
			return false, nil
		}

		var alertsResp struct {
			Data struct {
				Alerts []k8s.PrometheusAlert `json:"alerts"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&alertsResp); err != nil {
			t.Logf("Failed to decode alerts response: %v", err)
			return false, nil
		}

		for _, alert := range alertsResp.Data.Alerts {
			if alert.Labels["alertname"] == alertName {
				if alert.State != "firing" && alert.State != "pending" {
					t.Logf("Found alert %s but state is %q, waiting for firing/pending", alertName, alert.State)
					return false, nil
				}
				if alert.Labels["severity"] != "none" {
					t.Errorf("Expected severity=none, got %q", alert.Labels["severity"])
				}
				t.Logf("Found alert %s in state %q", alertName, alert.State)
				return true, nil
			}
		}

		t.Logf("Alert %s not found yet (got %d alerts total)", alertName, len(alertsResp.Data.Alerts))
		return false, nil
	})

	if err != nil {
		t.Fatalf("Timeout waiting for alert to appear: %v", err)
	}

	t.Log("GET /alerts e2e test passed successfully")
}
