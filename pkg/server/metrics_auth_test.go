package server

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
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/server/dynamiccertificates"
)

func TestMetricsCertificateAuthorization(t *testing.T) {
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	caTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(1), IsCA: true, BasicConstraintsValid: true,
		KeyUsage:  x509.KeyUsageCertSign,
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &caKey.PublicKey, caKey)
	require.NoError(t, err)
	caCert, err := x509.ParseCertificate(caDER)
	require.NoError(t, err)
	ca, err := dynamiccertificates.NewStaticCAContent("metrics-test", pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}))
	require.NoError(t, err)

	issueCertificate := func(identity string, usage x509.ExtKeyUsage, expired, untrusted bool) tls.Certificate {
		t.Helper()
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)
		template := &x509.Certificate{
			SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: identity},
			NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
			KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{usage},
		}
		if expired {
			template.NotAfter = time.Now().Add(-time.Minute)
		}
		signer, parent := caKey, caCert
		if untrusted {
			signer, parent = key, template
		}
		der, err := x509.CreateCertificate(rand.Reader, template, parent, &key.PublicKey, signer)
		require.NoError(t, err)
		return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
	}

	for _, tc := range []struct {
		name        string
		certificate tls.Certificate
		status      int
	}{
		{name: "no certificate", status: http.StatusUnauthorized},
		{name: "prometheus", certificate: issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, false), status: http.StatusOK},
		{name: "other authenticated identity", certificate: issueCertificate("system:serviceaccount:default:other", x509.ExtKeyUsageClientAuth, false, false), status: http.StatusForbidden},
		{name: "forged prometheus", certificate: issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, true), status: http.StatusUnauthorized},
		{name: "expired certificate", certificate: issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, true, false), status: http.StatusUnauthorized},
		{name: "server certificate", certificate: issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageServerAuth, false, false), status: http.StatusUnauthorized},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mux := http.NewServeMux()
			mux.Handle("/metrics", authorizeMetrics(ca, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })))
			mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
			server := httptest.NewUnstartedServer(mux)
			// Dynamic serving configurations inherit the base client certificate policy.
			server.TLS = &tls.Config{MinVersion: tls.VersionTLS12, ClientAuth: tls.RequestClientCert}
			server.StartTLS()
			t.Cleanup(server.Close)
			servingConfig := server.TLS.Clone()
			server.TLS.GetConfigForClient = func(*tls.ClientHelloInfo) (*tls.Config, error) { return servingConfig, nil }
			client := server.Client()
			transport := client.Transport.(*http.Transport).Clone()
			transport.TLSClientConfig = transport.TLSClientConfig.Clone()
			if len(tc.certificate.Certificate) > 0 {
				transport.TLSClientConfig.Certificates = []tls.Certificate{tc.certificate}
			}
			client.Transport = transport
			t.Cleanup(transport.CloseIdleConnections)
			for path, status := range map[string]int{"/metrics": tc.status, "/health": http.StatusOK} {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				request, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+path, nil)
				require.NoError(t, err)
				resp, err := client.Do(request)
				require.NoError(t, err)
				require.Equal(t, status, resp.StatusCode, path)
				require.NoError(t, resp.Body.Close())
			}
		})
	}
	t.Run("metrics without alert management", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		dir := t.TempDir()
		caFile := filepath.Join(dir, "client-ca.crt")
		require.NoError(t, os.WriteFile(caFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}), 0600))
		// Metrics authentication must not need Kubernetes credentials.
		t.Setenv("KUBECONFIG", filepath.Join(dir, "missing-kubeconfig"))
		certFile, keyFile := filepath.Join(dir, "tls.crt"), filepath.Join(dir, "tls.key")
		require.NoError(t, generateCertificate(t, certFile, keyFile, testHostname))
		server, err := createHTTPServer(ctx, &Config{
			CertFile: certFile, PrivateKeyFile: keyFile, ClientCAFile: caFile,
			Features: map[Feature]bool{Alerting: true},
		})
		require.NoError(t, err)
		certificate := issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, false)
		leaf, err := x509.ParseCertificate(certificate.Certificate[0])
		require.NoError(t, err)
		request := httptest.NewRequest(http.MethodGet, "https://plugin/metrics", nil)
		request.TLS.PeerCertificates = []*x509.Certificate{leaf}
		var recorder *httptest.ResponseRecorder
		require.NoError(t, wait.PollUntilContextCancel(ctx, time.Millisecond, true, func(context.Context) (bool, error) {
			recorder = httptest.NewRecorder()
			server.Handler.ServeHTTP(recorder, request)
			return recorder.Code == http.StatusOK, nil
		}))
		require.Contains(t, recorder.Header().Get("Content-Type"), "text/plain")
		for _, name := range []string{"go_goroutines", "process_start_time_seconds"} {
			require.Contains(t, recorder.Body.String(), name)
		}
	})
	t.Run("CA rotation and cached authentication", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		caFile := filepath.Join(t.TempDir(), "client-ca.crt")
		writeBundle := func(der []byte) {
			t.Helper()
			// Replace the file atomically, as projected ConfigMap updates do.
			require.NoError(t, os.WriteFile(caFile+".tmp", pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600))
			require.NoError(t, os.Rename(caFile+".tmp", caFile))
		}
		writeBundle(caDER)
		provider, err := metricsClientCA(ctx, caFile)
		require.NoError(t, err)
		handler := authorizeMetrics(provider, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))
		certificate := issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, false)
		leaf, err := x509.ParseCertificate(certificate.Certificate[0])
		require.NoError(t, err)
		request := httptest.NewRequest(http.MethodGet, "https://plugin/metrics", nil)
		request.TLS.PeerCertificates = []*x509.Certificate{leaf}
		scrape := func() int {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			return recorder.Code
		}
		require.NoError(t, wait.PollUntilContextTimeout(ctx, time.Millisecond, 5*time.Second, true, func(context.Context) (bool, error) { return scrape() == http.StatusOK, nil }))
		// Rotate to a different signing key. The previously accepted leaf must be rejected.
		newKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)
		newDER, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &newKey.PublicKey, newKey)
		require.NoError(t, err)
		writeBundle(newDER)
		require.NoError(t, wait.PollUntilContextTimeout(ctx, time.Millisecond, 5*time.Second, true, func(context.Context) (bool, error) { return scrape() == http.StatusUnauthorized, nil }))
		newCA, err := x509.ParseCertificate(newDER)
		require.NoError(t, err)
		leafTemplate := &x509.Certificate{SerialNumber: big.NewInt(3), Subject: pkix.Name{CommonName: metricsScraperIdentity}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}, KeyUsage: x509.KeyUsageDigitalSignature}
		leafDER, err := x509.CreateCertificate(rand.Reader, leafTemplate, newCA, &caKey.PublicKey, newKey)
		require.NoError(t, err)
		leaf, err = x509.ParseCertificate(leafDER)
		require.NoError(t, err)
		request.TLS.PeerCertificates = []*x509.Certificate{leaf}
		require.Equal(t, http.StatusOK, scrape())
		cancel()
		// Scrapes use cached CA data even when the mounted file is unavailable.
		require.NoError(t, os.Remove(caFile))
		require.Equal(t, http.StatusOK, scrape())
	})
}

func TestMetricsAuthenticationFailsClosedWithoutCA(t *testing.T) {
	handler := authorizeMetrics(nil, http.HandlerFunc(func(http.ResponseWriter, *http.Request) { t.Fatal("untrusted scrape reached metrics") }))
	for _, request := range []*http.Request{
		httptest.NewRequest(http.MethodGet, "http://plugin/metrics", nil),
		httptest.NewRequest(http.MethodGet, "https://plugin/metrics", nil),
	} {
		request.Header.Set("X-Remote-User", metricsScraperIdentity)
		request.Header.Set("Authorization", "Bearer ignored")
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusUnauthorized, recorder.Code)
	}
	request := httptest.NewRequest(http.MethodGet, "https://plugin/metrics", nil)
	request.TLS.PeerCertificates = []*x509.Certificate{{Subject: pkix.Name{CommonName: metricsScraperIdentity}}}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
}

func TestMetricsClientCAConfiguration(t *testing.T) {
	ctx := context.Background()
	provider, err := metricsClientCA(ctx, "")
	require.NoError(t, err)
	require.Nil(t, provider)

	dir := t.TempDir()
	for _, name := range []string{"missing", "invalid"} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(dir, name)
			if name == "invalid" {
				require.NoError(t, os.WriteFile(path, []byte("not a CA bundle"), 0600))
			}
			_, err := metricsClientCA(ctx, path)
			require.ErrorContains(t, err, "load metrics client CA bundle")
		})
	}
}
