package k8s

import (
	"testing"

	"k8s.io/client-go/rest"
)

func TestBuildUserScopedConfig(t *testing.T) {
	base := &rest.Config{
		Host:            "https://api.example.com:6443",
		BearerToken:     "sa-token",
		BearerTokenFile: "/var/run/secrets/kubernetes.io/serviceaccount/token",
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true,
			CertData: []byte("admin-cert"),
			KeyData:  []byte("admin-key"),
			CertFile: "/path/to/cert",
			KeyFile:  "/path/to/key",
		},
	}

	cfg := buildUserScopedConfig(base, "user-token")

	// Derived config uses the user token exclusively.
	if cfg.BearerToken != "user-token" {
		t.Errorf("derived BearerToken = %q, want %q", cfg.BearerToken, "user-token")
	}
	if cfg.BearerTokenFile != "" {
		t.Errorf("derived BearerTokenFile = %q, want empty", cfg.BearerTokenFile)
	}
	if cfg.CertData != nil {
		t.Error("derived CertData should be nil")
	}
	if cfg.KeyData != nil {
		t.Error("derived KeyData should be nil")
	}
	if cfg.CertFile != "" {
		t.Errorf("derived CertFile = %q, want empty", cfg.CertFile)
	}
	if cfg.KeyFile != "" {
		t.Errorf("derived KeyFile = %q, want empty", cfg.KeyFile)
	}
	if !cfg.Insecure {
		t.Error("derived Insecure should be preserved as true")
	}
	if cfg.Host != base.Host {
		t.Errorf("derived Host = %q, want %q", cfg.Host, base.Host)
	}

	// Base config must not be mutated.
	if base.CertData == nil {
		t.Error("base CertData was mutated")
	}
	if base.KeyData == nil {
		t.Error("base KeyData was mutated")
	}
	if base.BearerToken != "sa-token" {
		t.Errorf("base BearerToken = %q, want %q", base.BearerToken, "sa-token")
	}
	if base.BearerTokenFile != "/var/run/secrets/kubernetes.io/serviceaccount/token" {
		t.Errorf("base BearerTokenFile = %q, was mutated", base.BearerTokenFile)
	}
}
