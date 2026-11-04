package server

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/server/dynamiccertificates"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/rest"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
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
			// Exercise the same dynamic TLS callback wrapping as serving-certificate rotation.
			server.TLS = &tls.Config{MinVersion: tls.VersionTLS12}
			server.StartTLS()
			t.Cleanup(server.Close)
			servingConfig := server.TLS.Clone()
			server.TLS.GetConfigForClient = func(*tls.ClientHelloInfo) (*tls.Config, error) { return servingConfig, nil }
			requestMetricsClientCertificate(server.TLS)
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
		configMap := corev1.ConfigMap{
			TypeMeta:   metav1.TypeMeta{APIVersion: "v1", Kind: "ConfigMap"},
			ObjectMeta: metav1.ObjectMeta{Name: "metrics-client-ca", Namespace: k8s.ClusterMonitoringNamespace, ResourceVersion: "1"},
			Data:       map[string]string{"client-ca.crt": string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}))},
		}
		api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			encoder := json.NewEncoder(w)
			if r.URL.Query().Get("watch") == "true" {
				require.NoError(t, encoder.Encode(map[string]any{"type": "ADDED", "object": configMap}))
				bookmark := corev1.ConfigMap{TypeMeta: configMap.TypeMeta, ObjectMeta: metav1.ObjectMeta{ResourceVersion: "1", Annotations: map[string]string{"k8s.io/initial-events-end": "true"}}}
				require.NoError(t, encoder.Encode(map[string]any{"type": "BOOKMARK", "object": bookmark}))
				w.(http.Flusher).Flush()
				<-r.Context().Done()
				return
			}
			require.NoError(t, encoder.Encode(corev1.ConfigMapList{
				TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "ConfigMapList"},
				ListMeta: metav1.ListMeta{ResourceVersion: "1"},
				Items:    []corev1.ConfigMap{configMap},
			}))
		}))
		defer func() {
			cancel()
			api.Close()
		}()
		router, _, err := setupRoutes(ctx, &Config{}, nil, &rest.Config{Host: api.URL})
		require.NoError(t, err)
		certificate := issueCertificate(metricsScraperIdentity, x509.ExtKeyUsageClientAuth, false, false)
		leaf, err := x509.ParseCertificate(certificate.Certificate[0])
		require.NoError(t, err)
		request := httptest.NewRequest(http.MethodGet, "https://plugin/metrics", nil)
		request.TLS.PeerCertificates = []*x509.Certificate{leaf}
		var recorder *httptest.ResponseRecorder
		require.NoError(t, wait.PollUntilContextCancel(ctx, time.Millisecond, true, func(context.Context) (bool, error) {
			recorder = httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
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
		configMap := &corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Namespace: k8s.ClusterMonitoringNamespace, Name: "metrics-client-ca"}, Data: map[string]string{"client-ca.crt": string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}))}}
		client := fake.NewClientset(configMap)
		provider, err := metricsClientCA(ctx, client)
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
		configMap.Data["client-ca.crt"] = string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: newDER}))
		_, err = client.CoreV1().ConfigMaps(k8s.ClusterMonitoringNamespace).Update(ctx, configMap, metav1.UpdateOptions{})
		require.NoError(t, err)
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
		// Scrapes remain local and valid after the controller loses API access.
		actions := len(client.Actions())
		require.Equal(t, http.StatusOK, scrape())
		require.Len(t, client.Actions(), actions)
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
