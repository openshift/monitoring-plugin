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
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
)

func TestReadyThanosPodName(t *testing.T) {
	now := metav1.Now()
	ready := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "thanos-querier-ready"},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			Conditions: []corev1.PodCondition{{
				Type:   corev1.PodReady,
				Status: corev1.ConditionTrue,
			}},
		},
	}
	deleting := ready
	deleting.Name = "thanos-querier-deleting"
	deleting.DeletionTimestamp = &now
	pending := ready
	pending.Name = "thanos-querier-pending"
	pending.Status.Phase = corev1.PodPending
	notReady := ready
	notReady.Name = "thanos-querier-not-ready"
	notReady.Status.Conditions = []corev1.PodCondition{{
		Type:   corev1.PodReady,
		Status: corev1.ConditionFalse,
	}}

	name, err := readyThanosPodName([]corev1.Pod{deleting, pending, notReady, ready})
	if err != nil {
		t.Fatalf("ready pod: %v", err)
	}
	if name != ready.Name {
		t.Fatalf("pod %q, want %q", name, ready.Name)
	}

	if _, err := readyThanosPodName(nil); err == nil {
		t.Fatal("expected error when no pod is ready")
	}
}

func TestOutOfClusterThanosTenancyDialsPortForward(t *testing.T) {
	t.Setenv("KUBECONFIG", "kubeconfig")
	t.Setenv(serviceCAFileEnv, "")

	caPEM, serverCert := mustServiceServerCert(t, "thanos-querier.openshift-monitoring.svc")
	listener, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		MinVersion:   tls.VersionTLS12,
	})
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	seen := make(chan string, 1)
	server := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			name := ""
			if r.TLS != nil {
				name = r.TLS.ServerName
			}
			seen <- name
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"success","data":{"alerts":[]}}`))
		}),
		ReadHeaderTimeout: time.Second,
	}
	go func() { _ = server.Serve(listener) }()
	defer server.Close()

	pa := newPrometheusAlerts(nil, nil, &rest.Config{BearerToken: "test-token"}, nil)
	pa.transport.serviceCAPEM = caPEM
	pa.transport.serviceCAExpiresAt = time.Now().Add(time.Minute)
	pa.thanosTunnel.addr = listener.Addr().String()

	body, err := pa.getThanosTenancyResponse(context.Background(), ThanosQuerierTenancyAlertsPath, "default")
	if err != nil {
		t.Fatalf("tenancy request: %v", err)
	}
	if len(body) == 0 {
		t.Fatal("expected a response body")
	}
	select {
	case serverName := <-seen:
		if serverName != "thanos-querier.openshift-monitoring.svc" {
			t.Fatalf("server name %q", serverName)
		}
	default:
		t.Fatal("port-forward listener was not dialed")
	}
}

func TestInClusterThanosTenancyDoesNotUsePortForward(t *testing.T) {
	t.Setenv("KUBECONFIG", "")
	t.Setenv(serviceCAFileEnv, "")

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	hit := make(chan struct{}, 1)
	server := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			hit <- struct{}{}
			w.WriteHeader(http.StatusOK)
		}),
		ReadHeaderTimeout: time.Second,
	}
	go func() { _ = server.Serve(listener) }()
	defer server.Close()

	pa := newPrometheusAlerts(nil, nil, &rest.Config{BearerToken: "test-token"}, nil)
	pa.thanosTunnel.addr = listener.Addr().String()

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	if _, err := pa.getThanosTenancyResponse(ctx, ThanosQuerierTenancyAlertsPath, "default"); err == nil {
		t.Fatal("expected in-cluster dial to fail closed")
	}
	select {
	case <-hit:
		t.Fatal("in-cluster tenancy dialed the port-forward address")
	default:
	}
}

func TestOutOfClusterThanosTenancyTrustsExplicitServiceCAFile(t *testing.T) {
	caPEM, serverCert := mustServiceServerCert(t, "thanos-querier.openshift-monitoring.svc")
	caPath := filepath.Join(t.TempDir(), "service-ca.crt")
	if err := os.WriteFile(caPath, caPEM, 0o600); err != nil {
		t.Fatalf("write service CA: %v", err)
	}
	t.Setenv("KUBECONFIG", "kubeconfig")
	t.Setenv(serviceCAFileEnv, caPath)

	listener, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		MinVersion:   tls.VersionTLS12,
	})
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	server := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(`{"status":"success","data":{"alerts":[]}}`))
		}),
		ReadHeaderTimeout: time.Second,
	}
	go func() { _ = server.Serve(listener) }()
	defer server.Close()

	pa := newPrometheusAlerts(nil, nil, &rest.Config{BearerToken: "test-token"}, nil)
	pa.thanosTunnel.addr = listener.Addr().String()

	if _, err := pa.getThanosTenancyResponse(context.Background(), ThanosQuerierTenancyAlertsPath, "default"); err != nil {
		t.Fatalf("tenancy request with explicit service CA: %v", err)
	}
}

func mustServiceServerCert(t *testing.T, dnsNames ...string) ([]byte, tls.Certificate) {
	t.Helper()

	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate CA key: %v", err)
	}
	caTemplate := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "service-ca"},
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

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate leaf key: %v", err)
	}
	leafTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: "test-service"},
		DNSNames:     dnsNames,
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	leafDER, err := x509.CreateCertificate(rand.Reader, leafTemplate, caTemplate, &leafKey.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create leaf certificate: %v", err)
	}

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}), tls.Certificate{
		Certificate: [][]byte{leafDER},
		PrivateKey:  leafKey,
	}
}
