package k8s

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"sync"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestPortForwardTunnelConcurrentAccess(t *testing.T) {
	var tunnel portForwardTunnel
	var callers sync.WaitGroup
	opens := 0
	open := func(func(error)) (string, error) {
		opens++
		return "127.0.0.1:1234", nil
	}
	for range 10 {
		callers.Go(func() {
			addr, err := tunnel.address("test-service", open)
			if err != nil || addr != "127.0.0.1:1234" {
				t.Errorf("address = %q, error = %v", addr, err)
			}
		})
	}
	callers.Wait()
	if opens != 1 {
		t.Fatalf("opened %d tunnels concurrently, want 1", opens)
	}
}

func TestReadyPodName(t *testing.T) {
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

	name, err := readyPodName([]corev1.Pod{deleting, pending, notReady, ready})
	if err != nil {
		t.Fatalf("ready pod: %v", err)
	}
	if name != ready.Name {
		t.Fatalf("pod %q, want %q", name, ready.Name)
	}

	if _, err := readyPodName(nil); err == nil {
		t.Fatal("expected error when no pod is ready")
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
