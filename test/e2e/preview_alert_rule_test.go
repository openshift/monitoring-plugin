//go:build e2e

package e2e

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

// TestPreviewAlertRule_Create_NoPersistence verifies create preview returns a
// valid plan and does not persist changes to the PrometheusRule.
func TestPreviewAlertRule_Create_NoPersistence(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	ns, cleanup, err := f.CreateUserNamespace(ctx, "test-preview-create")
	if err != nil {
		t.Fatalf("Failed to create namespace: %v", err)
	}
	defer func() { _ = cleanup() }()

	beforeNames, err := alertNamesInPrometheusRule(ctx, f, ns, "e2e-preview-create-pr")
	if err != nil {
		require.True(t, errors.IsNotFound(err), "unexpected error listing PR before preview: %v", err)
		beforeNames = nil
	}

	payload := previewCreatePayload(ns, "PreviewCreateAlert", "e2e-preview-create-pr")
	status, resp, err := tryPreviewAlertRule(ctx, f, f.BearerToken, payload)
	if err != nil {
		t.Fatalf("preview create request failed: %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", status)
	}
	require.NotNil(t, resp)
	require.True(t, resp.Writable)
	require.NotEmpty(t, resp.Resources)
	require.NotNil(t, resp.DesiredRule.Alert)
	require.Equal(t, "PreviewCreateAlert", *resp.DesiredRule.Alert)

	err = framework.Poll(time.Second, 20*time.Second, func() error {
		afterNames, err := alertNamesInPrometheusRule(ctx, f, ns, "e2e-preview-create-pr")
		if err != nil {
			if errors.IsNotFound(err) && len(beforeNames) == 0 {
				return nil
			}
			return err
		}
		if len(afterNames) != len(beforeNames) {
			return fmt.Errorf("expected %d alerts, got %d: before=%v after=%v",
				len(beforeNames), len(afterNames), beforeNames, afterNames)
		}
		for i := range beforeNames {
			if beforeNames[i] != afterNames[i] {
				return fmt.Errorf("alert set changed: before=%v after=%v", beforeNames, afterNames)
			}
		}
		return nil
	})
	require.NoError(t, err)
}

// TestRBAC_PreviewAlertRule_Create verifies create preview enforces Kubernetes
// RBAC when the target PrometheusRule already exists.
func TestRBAC_PreviewAlertRule_Create(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-preview-rbac-create-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-preview-rbac-create-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	anonymousUser, err := f.CreateAnonymousUser(ctx, "e2e-preview-create-anon", "default")
	if err != nil {
		t.Fatalf("Failed to create anonymous user: %v", err)
	}
	defer func() { _ = anonymousUser.Cleanup() }()

	scopedUser, err := f.CreateScopedUser(ctx, "e2e-preview-create-scoped", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch"})
	if err != nil {
		t.Fatalf("Failed to create scoped user: %v", err)
	}
	defer func() { _ = scopedUser.Cleanup() }()

	_ = mustCreateRule(ctx, t, f, nsY, "PreviewRBACSeedY", "e2e-preview-rbac-pr")
	_ = mustCreateRule(ctx, t, f, nsZ, "PreviewRBACSeedZ", "e2e-preview-rbac-pr")

	cases := []struct {
		name       string
		token      string
		namespace  string
		alertName  string
		wantStatus int
	}{
		{"AnonymousUser_DeniedNamespaceY", anonymousUser.Token, nsY, "PreviewRBACAlertA", http.StatusForbidden},
		{"AnonymousUser_DeniedNamespaceZ", anonymousUser.Token, nsZ, "PreviewRBACAlertAZ", http.StatusForbidden},
		{"ScopedUser_SucceedsNamespaceY", scopedUser.Token, nsY, "PreviewRBACAlertBY", http.StatusOK},
		{"ScopedUser_DeniedNamespaceZ", scopedUser.Token, nsZ, "PreviewRBACAlertBZ", http.StatusForbidden},
		{"ClusterAdmin_SucceedsNamespaceZ", f.BearerToken, nsZ, "PreviewRBACAlertCZ", http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status := previewCreateWithToken(ctx, t, f, tc.token, tc.namespace, tc.alertName)
			if status != tc.wantStatus {
				t.Fatalf("Expected status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

// TestPreviewAlertRule_Update_NoPersistence verifies update preview returns a
// valid plan and does not persist label changes.
func TestPreviewAlertRule_Update_NoPersistence(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	ns, cleanup, err := f.CreateUserNamespace(ctx, "test-preview-update")
	if err != nil {
		t.Fatalf("Failed to create namespace: %v", err)
	}
	defer func() { _ = cleanup() }()

	ruleID := mustCreateRule(ctx, t, f, ns, "PreviewUpdateAlert", "e2e-preview-update-pr")
	waitForPreviewUpdateCacheSync(ctx, t, f, f.BearerToken, ruleID)

	labelVal := "preview-only"
	payload := previewUpdateProbeRequest(ruleID)
	payload.Labels = &map[string]*string{"e2e_preview_label": &labelVal}

	status, resp, err := tryPreviewAlertRule(ctx, f, f.BearerToken, payload)
	if err != nil {
		t.Fatalf("preview update request failed: %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", status)
	}
	require.NotNil(t, resp)
	require.True(t, resp.Writable)
	require.NotEmpty(t, resp.Resources)

	err = framework.Poll(time.Second, 20*time.Second, func() error {
		pr, err := f.Monitoringv1clientset.MonitoringV1().PrometheusRules(ns).Get(
			ctx, "e2e-preview-update-pr", metav1.GetOptions{},
		)
		if err != nil {
			return err
		}
		for _, group := range pr.Spec.Groups {
			for _, rule := range group.Rules {
				if rule.Alert != "PreviewUpdateAlert" {
					continue
				}
				if _, ok := rule.Labels["e2e_preview_label"]; ok {
					return fmt.Errorf("preview label was persisted on PrometheusRule")
				}
				return nil
			}
		}
		return fmt.Errorf("alert PreviewUpdateAlert not found")
	})
	require.NoError(t, err)
}

// TestRBAC_PreviewAlertRule_Update verifies update preview enforces Kubernetes
// RBAC across anonymous, namespace-scoped, and cluster-admin personas.
func TestRBAC_PreviewAlertRule_Update(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	ctx := context.Background()

	nsY, cleanupY, err := f.CreateUserNamespace(ctx, "test-preview-rbac-upd-y")
	if err != nil {
		t.Fatalf("Failed to create namespace Y: %v", err)
	}
	defer func() { _ = cleanupY() }()

	nsZ, cleanupZ, err := f.CreateUserNamespace(ctx, "test-preview-rbac-upd-z")
	if err != nil {
		t.Fatalf("Failed to create namespace Z: %v", err)
	}
	defer func() { _ = cleanupZ() }()

	anonymousUser, err := f.CreateAnonymousUser(ctx, "e2e-preview-upd-anon", "default")
	if err != nil {
		t.Fatalf("Failed to create anonymous user: %v", err)
	}
	defer func() { _ = anonymousUser.Cleanup() }()

	scopedUser, err := f.CreateScopedUser(ctx, "e2e-preview-upd-scoped", nsY,
		"monitoring.coreos.com", []string{"prometheusrules"}, []string{"get", "create", "update", "patch"})
	if err != nil {
		t.Fatalf("Failed to create scoped user: %v", err)
	}
	defer func() { _ = scopedUser.Cleanup() }()

	ruleInY := mustCreateRule(ctx, t, f, nsY, "PreviewRBACUpdateY", "e2e-preview-rbac-upd-pr")
	ruleInZ := mustCreateRule(ctx, t, f, nsZ, "PreviewRBACUpdateZ", "e2e-preview-rbac-upd-pr")
	ruleInY2 := mustCreateRule(ctx, t, f, nsY, "PreviewRBACUpdateY2", "e2e-preview-rbac-upd-pr")

	for _, ruleID := range []string{ruleInY, ruleInY2, ruleInZ} {
		waitForPreviewUpdateCacheSync(ctx, t, f, anonymousUser.Token, ruleID)
	}

	cases := []struct {
		name       string
		token      string
		ruleID     string
		wantStatus int
	}{
		{"AnonymousUser_DeniedNamespaceY", anonymousUser.Token, ruleInY, http.StatusForbidden},
		{"AnonymousUser_DeniedNamespaceZ", anonymousUser.Token, ruleInZ, http.StatusForbidden},
		{"ScopedUser_SucceedsNamespaceY", scopedUser.Token, ruleInY, http.StatusOK},
		{"ScopedUser_DeniedNamespaceZ", scopedUser.Token, ruleInZ, http.StatusForbidden},
		{"ClusterAdmin_SucceedsNamespaceZ", f.BearerToken, ruleInZ, http.StatusOK},
		{"ClusterAdmin_SucceedsNamespaceY", f.BearerToken, ruleInY2, http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status := previewUpdateWithToken(ctx, t, f, tc.token, tc.ruleID)
			if status != tc.wantStatus {
				t.Fatalf("Expected HTTP status %d, got %d", tc.wantStatus, status)
			}
		})
	}
}

func previewCreateWithToken(ctx context.Context, t *testing.T, f *framework.Framework, token, namespace, alertName string) int {
	t.Helper()
	payload := previewCreatePayload(namespace, alertName, "e2e-preview-rbac-pr")
	status, _, err := tryPreviewAlertRule(ctx, f, token, payload)
	if err != nil {
		t.Fatalf("preview create for %s in %s failed: %v", alertName, namespace, err)
	}
	return status
}

func previewUpdateWithToken(ctx context.Context, t *testing.T, f *framework.Framework, token, ruleID string) int {
	t.Helper()
	status, _, err := tryPreviewAlertRule(ctx, f, token, previewUpdateProbeRequest(ruleID))
	if err != nil {
		t.Fatalf("preview update for rule %s failed: %v", ruleID, err)
	}
	return status
}

func waitForPreviewUpdateCacheSync(ctx context.Context, t *testing.T, f *framework.Framework, token, ruleID string) {
	t.Helper()
	err := framework.Poll(time.Second, 30*time.Second, func() error {
		status, _, err := tryPreviewAlertRule(ctx, f, token, previewUpdateProbeRequest(ruleID))
		if err != nil {
			return err
		}
		if status == http.StatusForbidden || status == http.StatusOK {
			return nil
		}
		return fmt.Errorf("HTTP status %d, waiting for cache sync", status)
	})
	if err != nil {
		t.Fatalf("preview-update cache sync timed out for %s: %v", ruleID, err)
	}
}
