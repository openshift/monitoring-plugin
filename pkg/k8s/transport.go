package k8s

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	corev1client "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/rest"
)

var transportLog = logrus.WithField("module", "k8s-transport")

const (
	serviceRequestTimeout = 10 * time.Second

	// openshift-config-managed/openshift-service-ca.crt publishes the
	// cluster service CA under ca-bundle.crt (service-ca-operator
	// BundleDataKey). Injected copies use service-ca.crt.
	openshiftServiceCANamespace   = "openshift-config-managed"
	openshiftServiceCAConfigMap   = "openshift-service-ca.crt"
	openshiftServiceCABundleKey   = "ca-bundle.crt"
	openshiftServiceCAInjectedKey = "service-ca.crt"

	// serviceCACacheTTL bounds how long out-of-cluster clients reuse the
	// service CA from openshift-config-managed before checking for rotation.
	serviceCACacheTTL = time.Minute

	// serviceCAFileEnv points at the test cluster service CA when the
	// plugin runs outside that cluster (e2e-management-api). The default
	// in-cluster path is optional; an explicit path must be readable.
	serviceCAFileEnv = "MONITORING_PLUGIN_SERVICE_CA_FILE"
)

// transport provides authenticated HTTP and TLS trust for OpenShift services,
// including HTTP over an existing port-forward. It does not select service
// endpoints or interpret response bodies.
type transport struct {
	coreClient corev1client.CoreV1Interface
	config     *rest.Config

	serviceCAMu                  sync.Mutex
	serviceCAFallbackWarningOnce sync.Once
	serviceCAPEM                 []byte
	serviceCAExpiresAt           time.Time
}

func newTransport(coreClient corev1client.CoreV1Interface, config *rest.Config) *transport {
	return &transport{
		coreClient: coreClient,
		config:     config,
	}
}

func (mt *transport) createHTTPClient() (*http.Client, error) {
	tlsConfig, err := mt.buildTLSConfig()
	if err != nil {
		return nil, err
	}

	return &http.Client{
		Timeout: serviceRequestTimeout,
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		},
	}, nil
}

func (mt *transport) buildTLSConfig() (*tls.Config, error) {
	caCertPool, err := mt.loadCACertPool()
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		MinVersion: tls.VersionTLS12,
		RootCAs:    caCertPool,
	}, nil
}

func (mt *transport) loadCACertPool() (*x509.CertPool, error) {
	caCertPool, err := x509.SystemCertPool()
	if err != nil {
		caCertPool = x509.NewCertPool()
	}

	// Kubeconfig CA (API server) and the OpenShift service CA sign different
	// certificates. The service CA must still be appended when CAData is set.
	if len(mt.config.CAData) > 0 {
		caCertPool.AppendCertsFromPEM(mt.config.CAData)
	} else if mt.config.CAFile != "" {
		caCert, err := os.ReadFile(mt.config.CAFile)
		if err != nil {
			return nil, fmt.Errorf("read CA cert file: %w", err)
		}
		caCertPool.AppendCertsFromPEM(caCert)
	}

	if err := appendServiceCA(caCertPool); err != nil {
		return nil, err
	}

	return caCertPool, nil
}

func serviceCAFilePath() (string, bool) {
	if path := strings.TrimSpace(os.Getenv(serviceCAFileEnv)); path != "" {
		return path, true
	}
	return ServiceCAPath, false
}

func appendServiceCA(pool *x509.CertPool) error {
	path, required := serviceCAFilePath()
	pemBytes, err := os.ReadFile(path)
	if err != nil {
		if !required {
			return nil
		}
		return fmt.Errorf("read service CA file %s: %w", path, err)
	}
	if !pool.AppendCertsFromPEM(pemBytes) {
		if !required {
			return nil
		}
		return fmt.Errorf("parse service CA file %s", path)
	}
	return nil
}

func (mt *transport) executeRequest(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	req, err := mt.createAuthenticatedRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	return mt.performRequest(client, req)
}

func (mt *transport) createAuthenticatedRequest(ctx context.Context, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	token := BearerTokenFromContext(ctx)
	if token == "" {
		var err error
		token, err = mt.loadBearerToken()
		if err != nil {
			return nil, err
		}
	}

	req.Header.Set("Authorization", "Bearer "+token)
	return req, nil
}

func (mt *transport) loadBearerToken() (string, error) {
	if mt.config.BearerToken != "" {
		return mt.config.BearerToken, nil
	}

	if mt.config.BearerTokenFile == "" {
		return "", fmt.Errorf("no bearer token or token file configured")
	}

	tokenBytes, err := os.ReadFile(mt.config.BearerTokenFile)
	if err != nil {
		return "", fmt.Errorf("load bearer token file: %w", err)
	}

	return strings.TrimSpace(string(tokenBytes)), nil
}

func (mt *transport) performRequest(client *http.Client, req *http.Request) ([]byte, error) {
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, &upstreamHTTPError{statusCode: resp.StatusCode, body: string(body)}
	}

	return body, nil
}

type upstreamHTTPError struct {
	statusCode int
	body       string
}

func (e *upstreamHTTPError) Error() string {
	return fmt.Sprintf("unexpected status %d: %s", e.statusCode, e.body)
}

func isForbiddenResponse(err error) bool {
	httpErr, ok := err.(*upstreamHTTPError)
	return ok && httpErr.statusCode == http.StatusForbidden
}

func (mt *transport) outOfClusterServiceTLSConfig(ctx context.Context) (*tls.Config, error) {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}

	pemBytes, pemErr := mt.loadOutOfClusterServiceCA(ctx)
	if pemErr == nil && !pool.AppendCertsFromPEM(pemBytes) {
		pemErr = fmt.Errorf("parse service CA from configmap %s/%s", openshiftServiceCANamespace, openshiftServiceCAConfigMap)
	}

	_, fileRequired := serviceCAFilePath()
	if fileRequired {
		if err := appendServiceCA(pool); err != nil {
			return nil, err
		}
		if pemErr != nil {
			mt.serviceCAFallbackWarningOnce.Do(func() {
				transportLog.WithError(pemErr).Warn("using MONITORING_PLUGIN_SERVICE_CA_FILE without the cluster service CA configmap")
			})
		}
	} else if pemErr != nil {
		return nil, pemErr
	}

	return &tls.Config{
		MinVersion: tls.VersionTLS12,
		RootCAs:    pool,
	}, nil
}

func (mt *transport) loadOutOfClusterServiceCA(ctx context.Context) ([]byte, error) {
	mt.serviceCAMu.Lock()
	defer mt.serviceCAMu.Unlock()

	if len(mt.serviceCAPEM) > 0 && time.Now().Before(mt.serviceCAExpiresAt) {
		return append([]byte(nil), mt.serviceCAPEM...), nil
	}
	if mt.coreClient == nil {
		return nil, fmt.Errorf("core client is not configured")
	}

	configMap, err := mt.coreClient.ConfigMaps(openshiftServiceCANamespace).Get(ctx, openshiftServiceCAConfigMap, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get service CA configmap %s/%s: %w", openshiftServiceCANamespace, openshiftServiceCAConfigMap, err)
	}
	pemBytes, err := serviceCAFromConfigMapData(configMap.Data)
	if err != nil {
		return nil, err
	}
	mt.serviceCAPEM = pemBytes
	mt.serviceCAExpiresAt = time.Now().Add(serviceCACacheTTL)
	return append([]byte(nil), pemBytes...), nil
}

func serviceCAFromConfigMapData(data map[string]string) ([]byte, error) {
	for _, key := range []string{openshiftServiceCABundleKey, openshiftServiceCAInjectedKey} {
		pemData := data[key]
		if strings.Contains(pemData, "BEGIN CERTIFICATE") {
			return []byte(pemData), nil
		}
	}
	return nil, fmt.Errorf("configmap %s/%s has no service CA certificate", openshiftServiceCANamespace, openshiftServiceCAConfigMap)
}
