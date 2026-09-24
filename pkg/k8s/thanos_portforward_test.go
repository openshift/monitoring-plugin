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
	"k8s.io/client-go/kubernetes/fake"
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

func TestOutOfClusterServiceCAFromConfigMap(t *testing.T) {
	pemData := "-----BEGIN CERTIFICATE-----\nfrom-api\n-----END CERTIFICATE-----\n"
	client := fake.NewClientset(&corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      openshiftServiceCAConfigMap,
			Namespace: openshiftServiceCANamespace,
		},
		Data: map[string]string{openshiftServiceCABundleKey: pemData},
	})
	pa := &prometheusAlerts{coreClient: client.CoreV1()}

	got, err := pa.outOfClusterServiceCA(context.Background())
	if err != nil {
		t.Fatalf("fetch service CA: %v", err)
	}
	if string(got) != pemData {
		t.Fatalf("got %q", got)
	}

	pa.coreClient = nil
	got, err = pa.outOfClusterServiceCA(context.Background())
	if err != nil {
		t.Fatalf("cached service CA: %v", err)
	}
	if string(got) != pemData {
		t.Fatalf("cached got %q", got)
	}

	pa.coreClient = client.CoreV1()
	configMap, err := client.CoreV1().ConfigMaps(openshiftServiceCANamespace).Get(context.Background(), openshiftServiceCAConfigMap, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get service CA configmap: %v", err)
	}
	configMap.Data[openshiftServiceCABundleKey] = "-----BEGIN CERTIFICATE-----\nrotated\n-----END CERTIFICATE-----\n"
	if _, err := client.CoreV1().ConfigMaps(openshiftServiceCANamespace).Update(context.Background(), configMap, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("rotate service CA: %v", err)
	}
	pa.serviceCAExpiresAt = time.Now().Add(-time.Second)
	got, err = pa.outOfClusterServiceCA(context.Background())
	if err != nil {
		t.Fatalf("refresh service CA: %v", err)
	}
	if string(got) != configMap.Data[openshiftServiceCABundleKey] {
		t.Fatalf("refreshed got %q", got)
	}
}

func TestOutOfClusterTenancyDialsPortForward(t *testing.T) {
	t.Setenv("KUBECONFIG", "kubeconfig")
	t.Setenv(serviceCAFileEnv, "")

	caPEM, serverCert := mustThanosServerCert(t)
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

	pa := &prometheusAlerts{
		config:             &rest.Config{BearerToken: "test-token"},
		serviceCAPEM:       caPEM,
		serviceCAExpiresAt: time.Now().Add(time.Minute),
	}
	pa.tunnel.addr = listener.Addr().String()

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

func TestInClusterTenancyDoesNotUsePortForward(t *testing.T) {
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

	pa := &prometheusAlerts{config: &rest.Config{BearerToken: "test-token"}}
	pa.tunnel.addr = listener.Addr().String()

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

func TestOutOfClusterTenancyTrustsExplicitServiceCAFile(t *testing.T) {
	caPEM, serverCert := mustThanosServerCert(t)
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

	pa := &prometheusAlerts{config: &rest.Config{BearerToken: "test-token"}}
	pa.tunnel.addr = listener.Addr().String()

	if _, err := pa.getThanosTenancyResponse(context.Background(), ThanosQuerierTenancyAlertsPath, "default"); err != nil {
		t.Fatalf("tenancy request with explicit service CA: %v", err)
	}
}

func mustThanosServerCert(t *testing.T) ([]byte, tls.Certificate) {
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
		Subject:      pkix.Name{CommonName: "thanos-querier"},
		DNSNames:     []string{"thanos-querier.openshift-monitoring.svc"},
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
