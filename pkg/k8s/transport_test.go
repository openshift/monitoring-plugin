package k8s

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"math/big"
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

func TestForbiddenUpstreamResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/denied" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		http.Error(w, "Unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	for _, tc := range []struct {
		path      string
		forbidden bool
	}{
		{path: "/denied", forbidden: true},
		{path: "/unavailable", forbidden: false},
	} {
		req, err := http.NewRequest(http.MethodGet, server.URL+tc.path, nil)
		if err != nil {
			t.Fatal(err)
		}
		_, err = (&transport{}).performRequest(server.Client(), req)
		if err == nil || isForbiddenResponse(err) != tc.forbidden {
			t.Fatalf("request %s: error = %v, forbidden = %t, want %t", tc.path, err, isForbiddenResponse(err), tc.forbidden)
		}
	}
}

func TestLoadCACertPool_TrustsServiceCAAlongsideKubeconfigCA(t *testing.T) {
	kubeLeaf := mustLeafSignedBy(t, "kube")
	serviceLeaf := mustLeafSignedBy(t, "service")

	servicePath := filepath.Join(t.TempDir(), "service-ca.crt")
	if err := os.WriteFile(servicePath, serviceLeaf.caPEM, 0o600); err != nil {
		t.Fatalf("write service CA: %v", err)
	}
	t.Setenv(serviceCAFileEnv, servicePath)

	transport := newTransport(nil, &rest.Config{
		TLSClientConfig: rest.TLSClientConfig{CAData: kubeLeaf.caPEM},
	})
	pool, err := transport.loadCACertPool()
	if err != nil {
		t.Fatalf("load CA pool: %v", err)
	}
	if _, err := kubeLeaf.leaf.Verify(x509.VerifyOptions{Roots: pool}); err != nil {
		t.Fatalf("kube API CA not trusted: %v", err)
	}
	if _, err := serviceLeaf.leaf.Verify(x509.VerifyOptions{Roots: pool}); err != nil {
		t.Fatalf("service CA not trusted: %v", err)
	}
}

func TestLoadCACertPool_ExplicitServiceCAMustExist(t *testing.T) {
	t.Setenv(serviceCAFileEnv, filepath.Join(t.TempDir(), "missing.crt"))
	transport := newTransport(nil, &rest.Config{})
	if _, err := transport.loadCACertPool(); err == nil {
		t.Fatal("expected error when MONITORING_PLUGIN_SERVICE_CA_FILE is missing")
	}
}

func TestLoadCACertPool_MissingDefaultServiceCAIsOptional(t *testing.T) {
	t.Setenv(serviceCAFileEnv, "")
	transport := newTransport(nil, &rest.Config{})
	pool, err := transport.loadCACertPool()
	if err != nil {
		t.Fatalf("missing default service CA should be ignored: %v", err)
	}
	if pool == nil {
		t.Fatal("expected cert pool")
	}
}

func TestLoadCACertPool_ConfiguredCA(t *testing.T) {
	t.Setenv(serviceCAFileEnv, "")
	leaf := mustLeafSignedBy(t, "kubeconfig")
	validPath := filepath.Join(t.TempDir(), "valid-ca.crt")
	invalidPath := filepath.Join(t.TempDir(), "invalid-ca.crt")
	emptyPath := filepath.Join(t.TempDir(), "empty-ca.crt")
	for path, data := range map[string][]byte{
		validPath:   leaf.caPEM,
		invalidPath: []byte("not a certificate"),
		emptyPath:   {},
	} {
		if err := os.WriteFile(path, data, 0o600); err != nil {
			t.Fatal(err)
		}
	}

	for _, tc := range []struct {
		name      string
		tlsConfig rest.TLSClientConfig
		wantError string
	}{
		{
			name:      "valid CAData",
			tlsConfig: rest.TLSClientConfig{CAData: leaf.caPEM},
		},
		{
			name:      "valid CAFile",
			tlsConfig: rest.TLSClientConfig{CAFile: validPath},
		},
		{
			name:      "invalid CAData does not fall back to CAFile",
			tlsConfig: rest.TLSClientConfig{CAData: []byte("not a certificate"), CAFile: validPath},
			wantError: "parse kubeconfig CAData",
		},
		{
			name:      "invalid CAFile",
			tlsConfig: rest.TLSClientConfig{CAFile: invalidPath},
			wantError: "parse kubeconfig CAFile " + invalidPath,
		},
		{
			name:      "empty CAFile",
			tlsConfig: rest.TLSClientConfig{CAFile: emptyPath},
			wantError: "parse kubeconfig CAFile " + emptyPath,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			transport := newTransport(nil, &rest.Config{TLSClientConfig: tc.tlsConfig})
			pool, err := transport.loadCACertPool()
			if tc.wantError != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantError) {
					t.Fatalf("expected error containing %q, got %v", tc.wantError, err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, err := leaf.leaf.Verify(x509.VerifyOptions{Roots: pool}); err != nil {
				t.Fatalf("configured CA not trusted: %v", err)
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

type signedLeaf struct {
	caPEM []byte
	leaf  *x509.Certificate
}

func mustLeafSignedBy(t *testing.T, commonName string) signedLeaf {
	t.Helper()
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate CA key: %v", err)
	}
	caTemplate := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: commonName + "-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create CA certificate: %v", err)
	}
	caCert, err := x509.ParseCertificate(caDER)
	if err != nil {
		t.Fatalf("parse CA certificate: %v", err)
	}

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate leaf key: %v", err)
	}
	leafTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: commonName + "-leaf"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	leafDER, err := x509.CreateCertificate(rand.Reader, leafTemplate, caCert, &leafKey.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create leaf certificate: %v", err)
	}
	leaf, err := x509.ParseCertificate(leafDER)
	if err != nil {
		t.Fatalf("parse leaf certificate: %v", err)
	}
	return signedLeaf{
		caPEM: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}),
		leaf:  leaf,
	}
}
