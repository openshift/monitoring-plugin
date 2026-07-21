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
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

// poll calls the given function f() every given interval
// until it returns no error or the given timeout occurs.
// When a timeout occurs, the last observed error is returned
// wrapped in a wait.ErrWaitTimeout.
func poll(interval, timeout time.Duration, f func() error) error {
	var lastErr error
	err := wait.PollUntilContextTimeout(context.Background(), interval, timeout, true, func(context.Context) (bool, error) {
		if lastErr = f(); lastErr != nil {
			return false, nil
		}

		return true, nil
	})
	if err != nil && lastErr != nil {
		return fmt.Errorf("%w: %w", err, lastErr)
	}

	return err
}

func createRuleViaAPIWithRetry(ctx context.Context, f *framework.Framework, createAlertRuleRequest managementrouter.CreateAlertRuleRequest) (string, error) {
	var id string
	err := poll(time.Second, 20*time.Second, func() error {
		var err error
		id, err = createRuleViaAPI(ctx, f, createAlertRuleRequest)
		if err != nil {
			return fmt.Errorf("failed to create alert rule: %w", err)
		}
		return nil
	})
	return id, err
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
