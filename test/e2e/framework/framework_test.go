//go:build e2e

package framework

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
	clientcmd "k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

func TestLoadE2EConfigMergesKubeconfigFiles(t *testing.T) {
	dir := t.TempDir()
	contextPath := filepath.Join(dir, "context")
	credentialsPath := filepath.Join(dir, "credentials")
	if err := clientcmd.WriteToFile(clientcmdapi.Config{
		CurrentContext: "e2e",
		Contexts: map[string]*clientcmdapi.Context{
			"e2e": {Cluster: "cluster", AuthInfo: "user"},
		},
	}, contextPath); err != nil {
		t.Fatalf("write context kubeconfig: %v", err)
	}
	if err := clientcmd.WriteToFile(clientcmdapi.Config{
		Clusters: map[string]*clientcmdapi.Cluster{
			"cluster": {Server: "https://api.example.test:6443"},
		},
		AuthInfos: map[string]*clientcmdapi.AuthInfo{
			"user": {Token: "token"},
		},
	}, credentialsPath); err != nil {
		t.Fatalf("write credentials kubeconfig: %v", err)
	}
	t.Setenv("KUBECONFIG", strings.Join([]string{contextPath, credentialsPath}, string(filepath.ListSeparator)))

	config, err := loadE2EConfig()
	if err != nil {
		t.Fatalf("load e2e config: %v", err)
	}
	if config.Host != "https://api.example.test:6443" {
		t.Fatalf("host = %q", config.Host)
	}
	if config.BearerToken != "token" {
		t.Fatalf("token = %q", config.BearerToken)
	}
}

func TestCreateAnonymousUserCleanupReturnsDeleteError(t *testing.T) {
	client := fake.NewClientset()
	f := &Framework{Clientset: client}
	user, err := f.CreateAnonymousUser(context.Background(), "anonymous", "default")
	if err != nil {
		t.Fatalf("create anonymous user: %v", err)
	}
	client.PrependReactor("delete", "serviceaccounts", func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("delete failed")
	})
	if err := user.Cleanup(); err == nil || !strings.Contains(err.Error(), "delete failed") {
		t.Fatalf("cleanup error = %v, want delete failure", err)
	}
}

func TestRetry_SucceedsOnFirstAttempt(t *testing.T) {
	calls := 0
	err := retry(3, func() error {
		calls++
		return nil
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if calls != 1 {
		t.Errorf("expected 1 call, got %d", calls)
	}
}

func TestRetry_SucceedsAfterTransientFailures(t *testing.T) {
	calls := 0
	err := retry(3, func() error {
		calls++
		if calls < 3 {
			return errors.New("transient")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("expected no error after retry, got %v", err)
	}
	if calls != 3 {
		t.Errorf("expected 3 calls, got %d", calls)
	}
}

func TestRetry_ExhaustsAttempts(t *testing.T) {
	calls := 0
	err := retry(3, func() error {
		calls++
		return errors.New("persistent")
	})
	if err == nil {
		t.Fatal("expected error after exhausting retries")
	}
	if calls != 3 {
		t.Errorf("expected 3 calls, got %d", calls)
	}
}

func TestRetry_ZeroAttempts(t *testing.T) {
	calls := 0
	err := retry(0, func() error {
		calls++
		return errors.New("should not be called")
	})
	if err != nil {
		t.Fatalf("expected nil with 0 attempts, got %v", err)
	}
	if calls != 0 {
		t.Errorf("expected 0 calls with n=0, got %d", calls)
	}
}

func TestPoll_SucceedsImmediately(t *testing.T) {
	err := Poll(time.Millisecond, 50*time.Millisecond, func() error {
		return nil
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestPoll_FailsOnTimeout(t *testing.T) {
	calls := 0
	err := Poll(time.Millisecond, 50*time.Millisecond, func() error {
		calls++
		return errors.New("still failing")
	})
	if err == nil {
		t.Fatal("expected error on timeout")
	}
}
