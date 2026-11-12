package server

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type httpClientConfig struct {
	TLSConfig     *tls.Config
	HTTPTransport *http.Transport
}

const (
	testHostname = "127.0.0.1"
)

var defaultFeatures = map[Feature]bool{
	Alerting: true,
	// even though alert-management-api will be true, starting the server
	// required a logged in kubeconfig or to be running in the server, which is
	// not always true, especially when running in ci
	AlertManagementAPI: false,
	Metrics:            true,
	LegacyDashboards:   true,
	Targets:            true,
}

func TestCreateHTTPServer(t *testing.T) {
	for _, tc := range []struct {
		cfg *Config
		err bool
	}{
		{
			// The minimum TLS version is 1.2 by default.
			cfg: &Config{
				TLSMaxVersion:  tls.VersionTLS11,
				CertFile:       "/etc/tls/server.crt",
				PrivateKeyFile: "/etc/tls/server.key",
				Features:       defaultFeatures,
			},
			err: true,
		},
		{
			cfg: &Config{
				TLSMinVersion:  tls.VersionTLS13,
				TLSMaxVersion:  tls.VersionTLS12,
				CertFile:       "/etc/tls/server.crt",
				PrivateKeyFile: "/etc/tls/server.key",
				Features:       defaultFeatures,
			},
			err: true,
		},
	} {
		t.Run("", func(t *testing.T) {
			_, err := createHTTPServer(context.Background(), tc.cfg)
			if tc.err {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
		})
	}

}

// startTestServer is a helper that starts a server for testing and returns
// a cleanup function that should be deferred by the caller.
func startTestServer(t *testing.T, conf *Config) (*PluginServer, func()) {
	ctx, cancel := context.WithCancel(context.Background())

	server, err := CreateServer(ctx, conf)
	require.NoError(t, err)

	// Start the server in a goroutine for testing
	go func() {
		if err := server.StartHTTPServer(); err != nil && err != http.ErrServerClosed {
			t.Errorf("Server error: %v", err)
		}
	}()

	cleanup := func() {
		shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelShutdown()
		server.Shutdown(shutdownCtx)
		cancel()
		// Give time for the dynamic certificate controller to fully stop
		time.Sleep(100 * time.Millisecond)
	}

	return server, cleanup
}

func TestServerRunning(t *testing.T) {
	testPort, err := getFreePort(testHostname)
	if err != nil {
		t.Fatalf("Cannot get a free port to run tests on host [%v]", testHostname)
	} else {
		t.Logf("Will use free port [%v] on host [%v] for tests", testPort, testHostname)
	}

	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)

	serverURL := fmt.Sprintf("http://%s", testServerHostPort)

	// Prepare directory to serve web files
	tmpDir := prepareServerAssets(t)
	defer os.RemoveAll(tmpDir)

	_, cleanup := startTestServer(t, &Config{
		Port:     testPort,
		Features: defaultFeatures,
	})
	defer cleanup()

	t.Logf("Started test http server: %v", serverURL)

	httpConfig := httpClientConfig{}
	httpClient, err := httpConfig.buildHTTPClient()
	if err != nil {
		t.Fatalf("Failed to create http client")
	}

	// wait for our test http server to come up
	checkHTTPReady(httpClient, serverURL)

	if _, err = getRequestResults(t, httpClient, serverURL); err != nil {
		t.Fatalf("Failed: could not fetch static files on / (root): %v", err)
	}

	if _, err = getRequestResults(t, httpClient, serverURL+"/health"); err != nil {
		t.Fatalf("Failed: could not fetch health check: %v", err)
	}

	if _, err = getRequestResults(t, httpClient, serverURL+"/features"); err != nil {
		t.Fatalf("Failed: could not fetch features endpoint: %v", err)
	}

	// sanity check - make sure we cannot get to a bogus context path
	if _, err = getRequestResults(t, httpClient, serverURL+"/badroot"); err == nil {
		t.Fatalf("Failed: Should have failed going to /badroot")
	}
}

func TestSecureServerRunning(t *testing.T) {
	srv := startTLSTestServer(t, &Config{Features: defaultFeatures})
	httpClient := srv.client(t, &tls.Config{})

	_, err := getRequestResults(t, httpClient, srv.url)
	require.NoError(t, err, "could not fetch static files on / (root)")

	_, err = getRequestResults(t, httpClient, srv.url+"/health")
	require.NoError(t, err, "could not fetch API endpoint")

	// Make sure the server rejects anything trying to use TLS 1.1 or under
	httpClientTLS11 := srv.client(t, &tls.Config{
		MinVersion: tls.VersionTLS10,
		MaxVersion: tls.VersionTLS11,
	})
	_, err = getRequestResults(t, httpClientTLS11, srv.url)
	require.Error(t, err, "should not have been able to use TLS 1.1")
}

func getFreePort(host string) (int, error) {
	addr, err := net.ResolveTCPAddr("tcp", host+":0")
	if err != nil {
		return 0, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func prepareServerAssets(t *testing.T) string {
	tmpDir, err := os.MkdirTemp("", "server-test")
	require.NoError(t, err)
	distpath := filepath.Join(tmpDir, "web/dist")
	err = os.MkdirAll(distpath, os.ModePerm)
	require.NoError(t, err)
	dummyfile := filepath.Join(distpath, "dummy")
	_, err = os.Create(dummyfile)
	require.NoError(t, err)
	err = os.Chdir(tmpDir)
	require.NoError(t, err)
	return tmpDir
}

func getRequestResults(t *testing.T, httpClient *http.Client, url string) (string, error) {
	r, err := http.NewRequest("GET", url, nil)
	if err != nil {
		t.Fatal(err)
		return "", err
	}

	resp, err := httpClient.Do(r)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		buf := new(bytes.Buffer)
		_, err2 := buf.ReadFrom(resp.Body)
		if err2 != nil {
			return "", err2
		}
		bodyString := buf.String()
		return bodyString, nil
	}
	return "", fmt.Errorf("Bad status: %v", resp.StatusCode)
}

func checkHTTPReady(httpClient *http.Client, url string) {
	for i := 0; i < 60; i++ {
		if r, err := httpClient.Get(url); err == nil {
			r.Body.Close()
			break
		} else {
			time.Sleep(time.Second)
		}
	}
}

func (conf *httpClientConfig) buildHTTPClient() (*http.Client, error) {
	// Make our own copy of TLS config
	tlsConfig := &tls.Config{}
	if conf.TLSConfig != nil {
		tlsConfig = conf.TLSConfig
	}

	// Make our own copy of HTTP transport
	transport := &http.Transport{}
	if conf.HTTPTransport != nil {
		transport = conf.HTTPTransport
	}

	// Make sure the transport has some things we know we need
	transport.TLSClientConfig = tlsConfig

	if transport.IdleConnTimeout == 0 {
		transport.IdleConnTimeout = time.Second * 600
	}
	if transport.ResponseHeaderTimeout == 0 {
		transport.ResponseHeaderTimeout = time.Second * 600
	}

	// Build the http client
	httpClient := http.Client{Transport: transport}

	return &httpClient, nil
}

func generateCertificate(t *testing.T, certPath string, keyPath string, host string) error {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}

	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return err
	}

	notBefore := time.Now()
	notAfter := notBefore.Add(365 * 24 * time.Hour)

	template := x509.Certificate{
		SerialNumber:          serialNumber,
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		Subject: pkix.Name{
			Organization: []string{"ABC Corp."},
		},
	}

	hosts := strings.Split(host, ",")
	for _, h := range hosts {
		if ip := net.ParseIP(h); ip != nil {
			template.IPAddresses = append(template.IPAddresses, ip)
		} else {
			template.DNSNames = append(template.DNSNames, h)
		}
	}

	template.IsCA = true
	template.KeyUsage |= x509.KeyUsageCertSign

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return err
	}

	certOut, err := os.Create(certPath)
	if err != nil {
		return err
	}
	_ = pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	certOut.Close()

	keyOut, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}

	pemBlockForKey := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)}
	_ = pem.Encode(keyOut, pemBlockForKey)
	keyOut.Close()

	t.Logf("Generated security data: %v|%v|%v", certPath, keyPath, host)
	return nil
}

type tlsTestServer struct {
	url string
}

// startTLSTestServer starts a TLS server with conf, filling in its Port and
// cert files, and waits until it is ready. Cleanup is automatic.
func startTLSTestServer(t *testing.T, conf *Config) tlsTestServer {
	t.Helper()

	testPort, err := getFreePort(testHostname)
	require.NoError(t, err)

	hostPort := fmt.Sprintf("%v:%v", testHostname, testPort)
	tmpDir := t.TempDir()

	conf.Port = testPort
	conf.CertFile = filepath.Join(tmpDir, "server.cert")
	conf.PrivateKeyFile = filepath.Join(tmpDir, "server.key")
	require.NoError(t, generateCertificate(t, conf.CertFile, conf.PrivateKeyFile, hostPort))

	tmpDirAssets := prepareServerAssets(t)
	t.Cleanup(func() { os.RemoveAll(tmpDirAssets) })

	_, cleanup := startTestServer(t, conf)
	t.Cleanup(cleanup)

	srv := tlsTestServer{url: fmt.Sprintf("https://%s", hostPort)}
	readyClient := srv.client(t, &tls.Config{})
	require.Eventually(t, func() bool {
		_, err := getRequestResults(t, readyClient, srv.url+"/health")
		return err == nil
	}, 10*time.Second, 50*time.Millisecond, "test https server did not become ready")
	t.Logf("Started test https server: %v", srv.url)

	return srv
}

// client returns a client using a copy of tlsConfig with InsecureSkipVerify.
func (s tlsTestServer) client(t *testing.T, tlsConfig *tls.Config) *http.Client {
	t.Helper()

	tlsConfig = tlsConfig.Clone()
	tlsConfig.InsecureSkipVerify = true
	httpClient, err := (&httpClientConfig{TLSConfig: tlsConfig}).buildHTTPClient()
	require.NoError(t, err)

	return httpClient
}

func TestTLSConfigWithCustomSettings(t *testing.T) {
	srv := startTLSTestServer(t, &Config{
		TLSMinVersion:   tls.VersionTLS12,
		TLSMaxVersion:   tls.VersionTLS13,
		TLSCipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384},
		Features:        defaultFeatures,
	})
	healthURL := srv.url + "/health"

	httpClientTLS13 := srv.client(t, &tls.Config{
		MinVersion: tls.VersionTLS13,
		MaxVersion: tls.VersionTLS13,
	})
	_, err := getRequestResults(t, httpClientTLS13, healthURL)
	require.NoError(t, err, "could not connect with TLS 1.3")

	httpClientTLS12 := srv.client(t, &tls.Config{
		MinVersion:   tls.VersionTLS12,
		MaxVersion:   tls.VersionTLS12,
		CipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
	})
	_, err = getRequestResults(t, httpClientTLS12, healthURL)
	require.NoError(t, err, "could not connect with TLS 1.2")

	httpClientTLS11 := srv.client(t, &tls.Config{
		MinVersion: tls.VersionTLS10,
		MaxVersion: tls.VersionTLS11,
	})
	_, err = getRequestResults(t, httpClientTLS11, healthURL)
	require.Error(t, err, "should not have been able to connect with TLS 1.1")
}

func TestTLSConfigWithCurvePreferences(t *testing.T) {
	srv := startTLSTestServer(t, &Config{
		TLSCurvePreferences: []tls.CurveID{tls.CurveP384},
		Features:            defaultFeatures,
	})
	healthURL := srv.url + "/health"

	for _, version := range []uint16{tls.VersionTLS12, tls.VersionTLS13} {
		t.Run(tls.VersionName(version), func(t *testing.T) {
			httpClientP384 := srv.client(t, &tls.Config{
				MinVersion:       version,
				MaxVersion:       version,
				CurvePreferences: []tls.CurveID{tls.CurveP384},
			})
			_, err := getRequestResults(t, httpClientP384, healthURL)
			require.NoError(t, err, "could not connect with allowed curve CurveP384")

			httpClientX25519 := srv.client(t, &tls.Config{
				MinVersion:       version,
				MaxVersion:       version,
				CurvePreferences: []tls.CurveID{tls.X25519},
			})
			// Must be a handshake rejection, not an unrelated failure.
			_, err = getRequestResults(t, httpClientX25519, healthURL)
			require.ErrorContains(t, err, "tls: handshake failure")
		})
	}
}

func TestTLSConfigWithDefaults(t *testing.T) {
	srv := startTLSTestServer(t, &Config{
		// No TLS settings - should use Go defaults
		Features: defaultFeatures,
	})
	healthURL := srv.url + "/health"

	httpClientTLS12 := srv.client(t, &tls.Config{
		MinVersion: tls.VersionTLS12,
	})
	_, err := getRequestResults(t, httpClientTLS12, healthURL)
	require.NoError(t, err, "could not connect with TLS 1.2")

	httpClientTLS13 := srv.client(t, &tls.Config{
		MinVersion: tls.VersionTLS13,
	})
	_, err = getRequestResults(t, httpClientTLS13, healthURL)
	require.NoError(t, err, "could not connect with TLS 1.3")

	httpClientTLS11 := srv.client(t, &tls.Config{
		MaxVersion: tls.VersionTLS11,
	})
	_, err = getRequestResults(t, httpClientTLS11, healthURL)
	require.Error(t, err, "should not have been able to connect with TLS 1.1")
}

func TestTLSConfigMinVersionOnly(t *testing.T) {
	srv := startTLSTestServer(t, &Config{
		TLSMinVersion: tls.VersionTLS13,
		// No MaxVersion - should allow TLS 1.3
		Features: defaultFeatures,
	})
	healthURL := srv.url + "/health"

	httpClientTLS13 := srv.client(t, &tls.Config{
		MinVersion: tls.VersionTLS13,
	})
	_, err := getRequestResults(t, httpClientTLS13, healthURL)
	require.NoError(t, err, "could not connect with TLS 1.3")

	httpClientTLS12 := srv.client(t, &tls.Config{
		MinVersion: tls.VersionTLS12,
		MaxVersion: tls.VersionTLS12,
	})
	_, err = getRequestResults(t, httpClientTLS12, healthURL)
	require.Error(t, err, "should not have been able to connect with TLS 1.2 when min is TLS 1.3")
}

func TestFilesHandler(t *testing.T) {
	fs := http.Dir("testdata")
	handler := filesHandler(fs)

	req := httptest.NewRequest("GET", "/index.html", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	res := w.Result()
	if res.Header.Get("Cache-Control") != "" {
		t.Errorf("Expected no Cache-Control header, but got %q", res.Header.Get("Cache-Control"))
	}
	if res.Header.Get("Expires") != "" {
		t.Errorf("Expected no Expires header, but got %q", res.Header.Get("Expires"))
	}

	req = httptest.NewRequest("GET", "/plugin-entry.js", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	res = w.Result()
	if res.Header.Get("Cache-Control") != "no-cache, no-store, must-revalidate" {
		t.Errorf("Expected Cache-Control header %q, but got %q", "no-cache, no-store, must-revalidate", res.Header.Get("Cache-Control"))
	}
	if res.Header.Get("Expires") != "0" {
		t.Errorf("Expected Expires header %q, but got %q", "0", res.Header.Get("Expires"))
	}
}

// TestNoCORSHeaders verifies the backend does not advertise cross-origin access;
// its only consumer, the console bridge, fetches it server-side.
func TestNoCORSHeaders(t *testing.T) {
	testPort, err := getFreePort(testHostname)
	require.NoError(t, err)

	staticDir := t.TempDir()
	require.NoError(t, os.WriteFile(
		filepath.Join(staticDir, "plugin-manifest.json"),
		[]byte(`{"name":"monitoring-plugin","extensions":[]}`),
		0600,
	))
	require.NoError(t, os.WriteFile(
		filepath.Join(staticDir, "plugin-entry.js"),
		[]byte("export default {};"),
		0600,
	))

	_, cleanup := startTestServer(t, &Config{
		Port:             testPort,
		Features:         defaultFeatures,
		StaticPath:       staticDir,
		ConfigPath:       t.TempDir(),
		PluginConfigPath: filepath.Join(t.TempDir(), "plugin-config.yaml"),
	})
	defer cleanup()

	serverURL := fmt.Sprintf("http://%s:%d", testHostname, testPort)
	httpClient, err := (&httpClientConfig{}).buildHTTPClient()
	require.NoError(t, err)
	checkHTTPReady(httpClient, serverURL+"/health")

	for _, path := range []string{
		"/health",
		"/features",
		"/config",
		"/plugin-manifest.json",
		"/plugin-entry.js",
	} {
		t.Run(strings.TrimPrefix(path, "/"), func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, serverURL+path, nil)
			require.NoError(t, err)
			// Mimic a cross-origin browser request.
			req.Header.Set("Origin", "https://evil.example")

			res, err := httpClient.Do(req)
			require.NoError(t, err)
			defer res.Body.Close()

			require.Equal(t, http.StatusOK, res.StatusCode)
			for header := range res.Header {
				require.NotContains(t, header, "Access-Control-", "unexpected %s on %s", header, path)
			}
		})
	}
}
