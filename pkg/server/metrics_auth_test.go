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
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"
)

// TestMetricsCertificateAuthorization verifies that /metrics scrapes are
// authorized with a client certificate signed by the configured CA and
// identifying the in-cluster Prometheus service account, and that CA rotation
// takes effect without restarting the server.
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

	// Untrusted, expired or wrongly-typed client certificates are rejected
	// during the TLS handshake, before any route sees the request.
	for _, tc := range []struct {
		name          string
		certificate   tls.Certificate
		metricsStatus int
	}{
		{name: "no certificate", metricsStatus: http.StatusUnauthorized},
		{name: "prometheus", certificate: issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, false), metricsStatus: http.StatusOK},
		{name: "other authenticated identity", certificate: issueCertificate("system:serviceaccount:default:other", x509.ExtKeyUsageClientAuth, false, false), metricsStatus: http.StatusForbidden},
		{name: "forged prometheus", certificate: issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, true)},
		{name: "expired certificate", certificate: issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, true, false)},
		{name: "server certificate", certificate: issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageServerAuth, false, false)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mux := http.NewServeMux()
			mux.Handle("/metrics", authorizeMetrics(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })))
			mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
			server := httptest.NewUnstartedServer(mux)
			// Mirror the serving configuration built by createHTTPServer:
			// certificates are verified against the CA bundle at handshake
			// time, /metrics additionally checks the scraper identity.
			clientCAs := x509.NewCertPool()
			clientCAs.AddCert(caCert)
			server.TLS = &tls.Config{MinVersion: tls.VersionTLS12, ClientAuth: tls.VerifyClientCertIfGiven, ClientCAs: clientCAs}
			server.StartTLS()
			t.Cleanup(server.Close)
			client := server.Client()
			transport := client.Transport.(*http.Transport).Clone()
			transport.TLSClientConfig = transport.TLSClientConfig.Clone()
			// Present the certificate even when it is not issued by an
			// acceptable CA: the server must reject it at the handshake.
			if len(tc.certificate.Certificate) > 0 {
				certificate := tc.certificate
				transport.TLSClientConfig.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
					return &certificate, nil
				}
			}
			client.Transport = transport
			t.Cleanup(transport.CloseIdleConnections)
			scrape := func(path string) (int, error) {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				request, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+path, nil)
				require.NoError(t, err)
				resp, err := client.Do(request)
				if err != nil {
					return 0, err
				}
				defer resp.Body.Close()
				return resp.StatusCode, nil
			}
			if tc.metricsStatus == 0 {
				for _, path := range []string{"/metrics", "/health"} {
					_, err := scrape(path)
					require.Error(t, err, "untrusted client certificate must fail the TLS handshake")
				}
				return
			}
			status, err := scrape("/metrics")
			require.NoError(t, err)
			require.Equal(t, tc.metricsStatus, status)
			status, err = scrape("/health")
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, status)
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
		server, _, err := createHTTPServer(ctx, &Config{
			CertFile: certFile, PrivateKeyFile: keyFile, ClientCAFile: caFile,
			Features: map[Feature]bool{Alerting: true},
		})
		require.NoError(t, err)
		certificate := issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, false)
		leaf, err := x509.ParseCertificate(certificate.Certificate[0])
		require.NoError(t, err)
		// A scrape accepted at handshake time is identified by the verified
		// chain the TLS layer attaches to the request.
		request := httptest.NewRequest(http.MethodGet, "https://plugin/metrics", nil)
		request.TLS.PeerCertificates = []*x509.Certificate{leaf}
		request.TLS.VerifiedChains = [][]*x509.Certificate{{leaf, caCert}}
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
		require.NotContains(t, recorder.Body.String(), "alerts_effective_active_at_timestamp_seconds")
		require.NotContains(t, recorder.Body.String(), "alerts_dropped_active_at_timestamp_seconds")
		// The production router must reject scrapes without a client certificate.
		unauthenticated := httptest.NewRequest(http.MethodGet, "https://plugin/metrics", nil)
		recorder = httptest.NewRecorder()
		server.Handler.ServeHTTP(recorder, unauthenticated)
		require.Equal(t, http.StatusUnauthorized, recorder.Code)
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
		// Verify client certificates at handshake time against the bundle the
		// provider currently caches, as the serving controller does.
		server := httptest.NewUnstartedServer(authorizeMetrics(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })))
		server.TLS = &tls.Config{MinVersion: tls.VersionTLS12, ClientAuth: tls.VerifyClientCertIfGiven}
		server.StartTLS()
		t.Cleanup(server.Close)
		baseConfig := server.TLS.Clone()
		server.TLS.GetConfigForClient = func(*tls.ClientHelloInfo) (*tls.Config, error) {
			config := baseConfig.Clone()
			clientCAs := x509.NewCertPool()
			if !clientCAs.AppendCertsFromPEM(provider.CurrentCABundleContent()) {
				return nil, fmt.Errorf("no certificates in metrics client CA bundle")
			}
			config.ClientCAs = clientCAs
			return config, nil
		}
		client := server.Client()
		transport := client.Transport.(*http.Transport).Clone()
		transport.TLSClientConfig = transport.TLSClientConfig.Clone()
		// Every scrape must perform a fresh handshake so that rotation is
		// observed immediately, and the certificate must be presented even
		// when the server no longer lists its issuer as acceptable.
		transport.DisableKeepAlives = true
		client.Transport = transport
		t.Cleanup(transport.CloseIdleConnections)
		scrape := func(certificate tls.Certificate) error {
			transport.TLSClientConfig.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
				return &certificate, nil
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			request, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/metrics", nil)
			require.NoError(t, err)
			resp, err := client.Do(request)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			require.Equal(t, http.StatusOK, resp.StatusCode)
			return nil
		}
		oldLeaf := issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, false)
		require.NoError(t, wait.PollUntilContextTimeout(ctx, time.Millisecond, 5*time.Second, true, func(context.Context) (bool, error) {
			return scrape(oldLeaf) == nil, nil
		}))
		// Rotate to a different signing key. The previously accepted leaf
		// must stop verifying at the TLS handshake.
		newKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)
		newDER, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &newKey.PublicKey, newKey)
		require.NoError(t, err)
		writeBundle(newDER)
		require.NoError(t, wait.PollUntilContextTimeout(ctx, time.Millisecond, 5*time.Second, true, func(context.Context) (bool, error) {
			return scrape(oldLeaf) != nil, nil
		}))
		newCA, err := x509.ParseCertificate(newDER)
		require.NoError(t, err)
		newLeafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)
		leafTemplate := &x509.Certificate{SerialNumber: big.NewInt(3), Subject: pkix.Name{CommonName: metricsScraperIdentity}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}, KeyUsage: x509.KeyUsageDigitalSignature}
		leafDER, err := x509.CreateCertificate(rand.Reader, leafTemplate, newCA, &newLeafKey.PublicKey, newKey)
		require.NoError(t, err)
		newLeaf := tls.Certificate{Certificate: [][]byte{leafDER}, PrivateKey: newLeafKey}
		require.NoError(t, scrape(newLeaf))
		// A failed reload keeps the last valid bundle. RunOnce performs the
		// same load as the watcher, synchronously, so each failure is observed
		// before the scrape.
		reloader, ok := provider.(interface{ RunOnce(context.Context) error })
		require.True(t, ok)
		require.NoError(t, os.WriteFile(caFile, []byte("not a CA bundle"), 0600))
		require.Error(t, reloader.RunOnce(ctx))
		require.NoError(t, scrape(newLeaf))
		// Scrapes use the cached CA data even when the mounted file is unavailable.
		require.NoError(t, os.Remove(caFile))
		require.Error(t, reloader.RunOnce(ctx))
		require.NoError(t, scrape(newLeaf))
		cancel()
	})
}

// TestMetricsAuthenticationFailsClosedWithoutCA verifies that when TLS is
// enabled but no client CA bundle is configured, every scrape is rejected
// regardless of presented certificates or forwarded identity headers.
func TestMetricsAuthenticationFailsClosedWithoutCA(t *testing.T) {
	handler := denyAllMetrics(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { t.Fatal("untrusted scrape reached metrics") }))
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
	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}

// TestMetricsClientCAConfiguration verifies that metricsClientCA fails on a
// missing or invalid CA bundle file.
func TestMetricsClientCAConfiguration(t *testing.T) {
	ctx := context.Background()

	dir := t.TempDir()
	for _, name := range []string{"missing", "invalid"} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(dir, name)
			if name == "invalid" {
				require.NoError(t, os.WriteFile(path, []byte("not a CA bundle"), 0600))
			}
			_, err := metricsClientCA(ctx, path)
			require.ErrorContains(t, err, "failed to load metrics client CA bundle")
		})
	}
}

// TestMetricsClientCARequiresTLS verifies that configuring a client CA file
// without TLS is rejected at startup.
func TestMetricsClientCARequiresTLS(t *testing.T) {
	_, _, err := createHTTPServer(context.Background(), &Config{
		ClientCAFile: filepath.Join(t.TempDir(), "client-ca.crt"),
		Features:     map[Feature]bool{Alerting: true},
	})
	require.ErrorContains(t, err, "client CA file requires TLS to be enabled")
}
