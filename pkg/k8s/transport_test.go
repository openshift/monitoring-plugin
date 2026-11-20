package k8s

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/rest"
)

func TestTransportAuthentication(t *testing.T) {
	tokenPath := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(tokenPath, []byte(" file-token\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name      string
		config    *rest.Config
		userToken string
		wantToken string
		wantError bool
	}{
		{
			name:      "caller token overrides service account credentials",
			config:    &rest.Config{BearerToken: "plugin-token", BearerTokenFile: tokenPath},
			userToken: "caller-token",
			wantToken: "caller-token",
		},
		{
			name:      "caller token does not require service account credentials",
			config:    &rest.Config{},
			userToken: "caller-token",
			wantToken: "caller-token",
		},
		{
			name:      "configured token overrides token file",
			config:    &rest.Config{BearerToken: "plugin-token", BearerTokenFile: tokenPath},
			wantToken: "plugin-token",
		},
		{
			name:      "configured token file is trimmed",
			config:    &rest.Config{BearerTokenFile: tokenPath},
			wantToken: "file-token",
		},
		{
			name:      "missing credentials fail closed",
			config:    &rest.Config{},
			wantError: true,
		},
		{
			name:      "unreadable token file fails closed",
			config:    &rest.Config{BearerTokenFile: filepath.Join(t.TempDir(), "missing-token")},
			wantError: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			transport := newTransport(nil, tc.config)
			ctx := WithBearerToken(context.Background(), tc.userToken)
			req, err := transport.createAuthenticatedRequest(ctx, "https://monitoring.example/api")
			if (err != nil) != tc.wantError {
				t.Fatalf("error = %v, want error %t", err, tc.wantError)
			}
			if tc.wantError {
				return
			}
			if req.Header.Get("Authorization") != "Bearer "+tc.wantToken {
				t.Fatal("unexpected authorization header")
			}
			if req.Method != http.MethodGet || req.Context() != ctx {
				t.Fatal("request must preserve the context and use GET")
			}
		})
	}
}

func TestTransportPortForwardVerifiesDestinationCertificate(t *testing.T) {
	t.Setenv(serviceCAFileEnv, "")
	caPEM, serverCert := mustServiceServerCert(t, "trusted.monitoring.svc")
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Error("request reached a service with the wrong certificate hostname")
	}))
	server.TLS = &tls.Config{MinVersion: tls.VersionTLS12, Certificates: []tls.Certificate{serverCert}}
	server.StartTLS()
	defer server.Close()

	transport := newTransport(nil, &rest.Config{BearerToken: "plugin-token"})
	transport.serviceCAPEM = caPEM
	transport.serviceCAExpiresAt = time.Now().Add(time.Minute)
	client, err := transport.portForwardHTTPClient(context.Background(), strings.TrimPrefix(server.URL, "https://"))
	if err != nil {
		t.Fatal(err)
	}
	defer client.CloseIdleConnections()

	_, err = transport.executeRequest(context.Background(), client, "https://wrong.monitoring.svc/api")
	var hostnameErr x509.HostnameError
	if !errors.As(err, &hostnameErr) {
		t.Fatalf("expected x509.HostnameError, got %v", err)
	}
}

func TestServiceCAFromConfigMapData(t *testing.T) {
	bundle := "-----BEGIN CERTIFICATE-----\nbundle\n-----END CERTIFICATE-----\n"
	injected := "-----BEGIN CERTIFICATE-----\ninjected\n-----END CERTIFICATE-----\n"

	got, err := serviceCAFromConfigMapData(map[string]string{
		openshiftServiceCABundleKey:   bundle,
		openshiftServiceCAInjectedKey: injected,
	})
	if err != nil {
		t.Fatalf("prefer bundle key: %v", err)
	}
	if string(got) != bundle {
		t.Fatalf("got %q, want bundle key", got)
	}

	got, err = serviceCAFromConfigMapData(map[string]string{
		openshiftServiceCAInjectedKey: injected,
	})
	if err != nil {
		t.Fatalf("injected key: %v", err)
	}
	if string(got) != injected {
		t.Fatalf("got %q, want injected key", got)
	}

	if _, err := serviceCAFromConfigMapData(map[string]string{
		openshiftServiceCABundleKey: "not a certificate",
	}); err == nil {
		t.Fatal("expected error when no certificate is present")
	}
}

func TestLoadOutOfClusterServiceCAFromConfigMap(t *testing.T) {
	pemData := "-----BEGIN CERTIFICATE-----\nfrom-api\n-----END CERTIFICATE-----\n"
	client := fake.NewClientset(&corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      openshiftServiceCAConfigMap,
			Namespace: openshiftServiceCANamespace,
		},
		Data: map[string]string{openshiftServiceCABundleKey: pemData},
	})
	transport := newTransport(client.CoreV1(), nil)

	got, err := transport.loadOutOfClusterServiceCA(context.Background())
	if err != nil {
		t.Fatalf("fetch service CA: %v", err)
	}
	if string(got) != pemData {
		t.Fatalf("got %q", got)
	}

	transport.coreClient = nil
	got, err = transport.loadOutOfClusterServiceCA(context.Background())
	if err != nil {
		t.Fatalf("cached service CA: %v", err)
	}
	if string(got) != pemData {
		t.Fatalf("cached got %q", got)
	}

	transport.coreClient = client.CoreV1()
	configMap, err := client.CoreV1().ConfigMaps(openshiftServiceCANamespace).Get(context.Background(), openshiftServiceCAConfigMap, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get service CA configmap: %v", err)
	}
	configMap.Data[openshiftServiceCABundleKey] = "-----BEGIN CERTIFICATE-----\nrotated\n-----END CERTIFICATE-----\n"
	if _, err := client.CoreV1().ConfigMaps(openshiftServiceCANamespace).Update(context.Background(), configMap, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("rotate service CA: %v", err)
	}
	transport.serviceCAExpiresAt = time.Now().Add(-time.Second)
	got, err = transport.loadOutOfClusterServiceCA(context.Background())
	if err != nil {
		t.Fatalf("refresh service CA: %v", err)
	}
	if string(got) != configMap.Data[openshiftServiceCABundleKey] {
		t.Fatalf("refreshed got %q", got)
	}
}
