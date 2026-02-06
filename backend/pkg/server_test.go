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
	CertFile       string
	PrivateKeyFile string
	TLSConfig      *tls.Config
	HTTPTransport  *http.Transport
}

const (
	testHostname = "127.0.0.1"
)

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
			},
			err: true,
		},
		{
			cfg: &Config{
				TLSMinVersion:  tls.VersionTLS13,
				TLSMaxVersion:  tls.VersionTLS12,
				CertFile:       "/etc/tls/server.crt",
				PrivateKeyFile: "/etc/tls/server.key",
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
		Port: testPort,
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
	testPort, err := getFreePort(testHostname)
	if err != nil {
		t.Fatalf("Cannot get a free port to run tests on host [%v]", testHostname)
	} else {
		t.Logf("Will use free port [%v] on host [%v] for tests", testPort, testHostname)
	}
	testMetricsPort, err := getFreePort(testHostname)
	if err != nil {
		t.Fatalf("Cannot get a free metrics port to run tests on host [%v]", testHostname)
	} else {
		t.Logf("Will use free metrics port [%v] on host [%v] for tests", testMetricsPort, testHostname)
	}

	tmpDir, err := os.MkdirTemp("", "server-test")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	testServerCertFile := tmpDir + "/server-test-server.cert"
	testServerKeyFile := tmpDir + "/server-test-server.key"
	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)
	err = generateCertificate(t, testServerCertFile, testServerKeyFile, testServerHostPort)
	if err != nil {
		t.Fatalf("Failed to create server cert/key files: %v", err)
	}

	testClientCertFile := tmpDir + "/server-test-client.cert"
	testClientKeyFile := tmpDir + "/server-test-client.key"
	testClientHost := testHostname
	err = generateCertificate(t, testClientCertFile, testClientKeyFile, testClientHost)
	if err != nil {
		t.Fatalf("Failed to create client cert/key files: %v", err)
	}

	conf := &Config{
		CertFile:       testServerCertFile,
		PrivateKeyFile: testServerKeyFile,
		Port:           testPort,
	}

	serverURL := fmt.Sprintf("https://%s", testServerHostPort)

	// Prepare directory to serve web files
	tmpDirAssets := prepareServerAssets(t)
	defer os.RemoveAll(tmpDirAssets)

	_, cleanup := startTestServer(t, conf)
	defer cleanup()
	t.Logf("Started test https server: %v", serverURL)

	httpConfig := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}
	httpClient, err := httpConfig.buildHTTPClient()
	if err != nil {
		t.Fatalf("Failed to create http client")
	}

	// Wait for our test http server to come up
	checkHTTPReady(httpClient, serverURL+"/status")

	if _, err = getRequestResults(t, httpClient, serverURL); err != nil {
		t.Fatalf("Failed: could not fetch static files on / (root): %v", err)
	}

	if _, err = getRequestResults(t, httpClient, serverURL+"/health"); err != nil {
		t.Fatalf("Failed: could not fetch API endpoint: %v", err)
	}

	// Make sure the server rejects anything trying to use TLS 1.1 or under
	httpConfigTLS11 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS10,
			MaxVersion:         tls.VersionTLS11,
		},
	}
	httpClientTLS11, err := httpConfigTLS11.buildHTTPClient()
	if err != nil {
		t.Fatalf("Failed to create http client with TLS 1.1")
	}
	if _, err = getRequestResults(t, httpClientTLS11, serverURL); err == nil {
		t.Fatalf("Failed: should not have been able to use TLS 1.1")
	}
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

	if conf.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(conf.CertFile, conf.PrivateKeyFile)
		if err != nil {
			return nil, fmt.Errorf("Error loading the client certificates: %w", err)
		}
		tlsConfig.Certificates = append(tlsConfig.Certificates, cert)
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

func TestTLSConfigWithCustomSettings(t *testing.T) {
	testPort, err := getFreePort(testHostname)
	require.NoError(t, err)
	t.Logf("Will use free port [%v] on host [%v] for tests", testPort, testHostname)

	tmpDir, err := os.MkdirTemp("", "server-test-tls")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	testServerCertFile := tmpDir + "/server-test-tls.cert"
	testServerKeyFile := tmpDir + "/server-test-tls.key"
	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)
	err = generateCertificate(t, testServerCertFile, testServerKeyFile, testServerHostPort)
	require.NoError(t, err)

	testClientCertFile := tmpDir + "/client-test-tls.cert"
	testClientKeyFile := tmpDir + "/client-test-tls.key"
	err = generateCertificate(t, testClientCertFile, testClientKeyFile, testHostname)
	require.NoError(t, err)

	conf := &Config{
		CertFile:        testServerCertFile,
		PrivateKeyFile:  testServerKeyFile,
		Port:            testPort,
		TLSMinVersion:   tls.VersionTLS12,
		TLSMaxVersion:   tls.VersionTLS13,
		TLSCipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384},
	}

	serverURL := fmt.Sprintf("https://%s", testServerHostPort)

	tmpDirAssets := prepareServerAssets(t)
	defer os.RemoveAll(tmpDirAssets)

	_, cleanup := startTestServer(t, conf)
	defer cleanup()
	t.Logf("Started test https server with custom TLS config: %v", serverURL)

	httpConfigTLS13 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS13,
			MaxVersion:         tls.VersionTLS13,
		},
	}
	httpClientTLS13, err := httpConfigTLS13.buildHTTPClient()
	require.NoError(t, err)

	checkHTTPReady(httpClientTLS13, serverURL+"/health")

	if _, err = getRequestResults(t, httpClientTLS13, serverURL+"/health"); err != nil {
		t.Fatalf("Failed: could not connect with TLS 1.3: %v", err)
	}

	httpConfigTLS12 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS12,
			MaxVersion:         tls.VersionTLS12,
			CipherSuites:       []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
		},
	}
	httpClientTLS12, err := httpConfigTLS12.buildHTTPClient()
	require.NoError(t, err)

	if _, err = getRequestResults(t, httpClientTLS12, serverURL+"/health"); err != nil {
		t.Fatalf("Failed: could not connect with TLS 1.2: %v", err)
	}

	httpConfigTLS11 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS10,
			MaxVersion:         tls.VersionTLS11,
		},
	}
	httpClientTLS11, err := httpConfigTLS11.buildHTTPClient()
	require.NoError(t, err)

	if _, err = getRequestResults(t, httpClientTLS11, serverURL+"/health"); err == nil {
		t.Fatalf("Failed: should not have been able to connect with TLS 1.1")
	}
}

func TestTLSConfigWithDefaults(t *testing.T) {
	testPort, err := getFreePort(testHostname)
	require.NoError(t, err)
	t.Logf("Will use free port [%v] on host [%v] for tests", testPort, testHostname)

	tmpDir, err := os.MkdirTemp("", "server-test-tls-defaults")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	testServerCertFile := tmpDir + "/server-defaults.cert"
	testServerKeyFile := tmpDir + "/server-defaults.key"
	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)
	err = generateCertificate(t, testServerCertFile, testServerKeyFile, testServerHostPort)
	require.NoError(t, err)

	testClientCertFile := tmpDir + "/client-defaults.cert"
	testClientKeyFile := tmpDir + "/client-defaults.key"
	err = generateCertificate(t, testClientCertFile, testClientKeyFile, testHostname)
	require.NoError(t, err)

	conf := &Config{
		CertFile:       testServerCertFile,
		PrivateKeyFile: testServerKeyFile,
		Port:           testPort,
		// No TLS settings - should use Go defaults
	}

	serverURL := fmt.Sprintf("https://%s", testServerHostPort)

	tmpDirAssets := prepareServerAssets(t)
	defer os.RemoveAll(tmpDirAssets)

	_, cleanup := startTestServer(t, conf)
	defer cleanup()
	t.Logf("Started test https server with default TLS config: %v", serverURL)

	httpConfigTLS12 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS12,
		},
	}
	httpClientTLS12, err := httpConfigTLS12.buildHTTPClient()
	require.NoError(t, err)

	checkHTTPReady(httpClientTLS12, serverURL+"/health")

	if _, err = getRequestResults(t, httpClientTLS12, serverURL+"/health"); err != nil {
		t.Fatalf("Failed: could not connect with TLS 1.2: %v", err)
	}

	httpConfigTLS13 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS13,
		},
	}
	httpClientTLS13, err := httpConfigTLS13.buildHTTPClient()
	require.NoError(t, err)

	if _, err = getRequestResults(t, httpClientTLS13, serverURL+"/health"); err != nil {
		t.Fatalf("Failed: could not connect with TLS 1.3: %v", err)
	}

	httpConfigTLS11 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MaxVersion:         tls.VersionTLS11,
		},
	}
	httpClientTLS11, err := httpConfigTLS11.buildHTTPClient()
	require.NoError(t, err)

	if _, err = getRequestResults(t, httpClientTLS11, serverURL+"/health"); err == nil {
		t.Fatalf("Failed: should not have been able to connect with TLS 1.1")
	}
}

func TestTLSConfigMinVersionOnly(t *testing.T) {
	testPort, err := getFreePort(testHostname)
	require.NoError(t, err)

	tmpDir, err := os.MkdirTemp("", "server-test-tls-minonly")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	testServerCertFile := tmpDir + "/server-minonly.cert"
	testServerKeyFile := tmpDir + "/server-minonly.key"
	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)
	err = generateCertificate(t, testServerCertFile, testServerKeyFile, testServerHostPort)
	require.NoError(t, err)

	testClientCertFile := tmpDir + "/client-minonly.cert"
	testClientKeyFile := tmpDir + "/client-minonly.key"
	err = generateCertificate(t, testClientCertFile, testClientKeyFile, testHostname)
	require.NoError(t, err)

	conf := &Config{
		CertFile:       testServerCertFile,
		PrivateKeyFile: testServerKeyFile,
		Port:           testPort,
		TLSMinVersion:  tls.VersionTLS13,
		// No MaxVersion - should allow TLS 1.3
	}

	serverURL := fmt.Sprintf("https://%s", testServerHostPort)

	tmpDirAssets := prepareServerAssets(t)
	defer os.RemoveAll(tmpDirAssets)

	_, cleanup := startTestServer(t, conf)
	defer cleanup()
	t.Logf("Started test https server with TLS 1.3 minimum: %v", serverURL)

	httpConfigTLS13 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS13,
		},
	}
	httpClientTLS13, err := httpConfigTLS13.buildHTTPClient()
	require.NoError(t, err)

	checkHTTPReady(httpClientTLS13, serverURL+"/health")

	if _, err = getRequestResults(t, httpClientTLS13, serverURL+"/health"); err != nil {
		t.Fatalf("Failed: could not connect with TLS 1.3: %v", err)
	}

	httpConfigTLS12 := httpClientConfig{
		CertFile:       testClientCertFile,
		PrivateKeyFile: testClientKeyFile,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS12,
			MaxVersion:         tls.VersionTLS12,
		},
	}
	httpClientTLS12, err := httpConfigTLS12.buildHTTPClient()
	require.NoError(t, err)

	if _, err = getRequestResults(t, httpClientTLS12, serverURL+"/health"); err == nil {
		t.Fatalf("Failed: should not have been able to connect with TLS 1.2 when min is TLS 1.3")
	}
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
