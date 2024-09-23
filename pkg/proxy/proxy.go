package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"slices"
	"time"

	"github.com/gorilla/mux"
	oscrypto "github.com/openshift/library-go/pkg/crypto"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/dynamic"
)

var log = logrus.WithField("module", "proxy")
var allowedKinds = []KindType{"alertmanager", "thanos-querier"}

type ProxyHandler struct {
	alertManagerProxy  *httputil.ReverseProxy
	thanosQuerierProxy *httputil.ReverseProxy
}

type KindType string

const (
	AlertManagerKind  KindType = "alertmanager"
	ThanosQuerierKind KindType = "thanos-querier"
)

type K8sResource struct {
	Kind      KindType `json:"kind"`
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
}

func NewProxyHandler(k8sclient *dynamic.DynamicClient, serviceCAfile string, alertmanager K8sResource, thanosQuerier K8sResource) *ProxyHandler {

	proxies, err := getProxies(alertmanager, thanosQuerier, serviceCAfile)
	if err != nil {
		log.Panic(err)
	}

	return &ProxyHandler{
		alertManagerProxy:  proxies[AlertManagerKind],
		thanosQuerierProxy: proxies[ThanosQuerierKind],
	}
}

// These headers aren't things that proxies should pass along. Some are forbidden by http2.
// This fixes the bug where Chrome users saw a ERR_SPDY_PROTOCOL_ERROR for all proxied requests.
func FilterHeaders(r *http.Response) error {
	badHeaders := []string{
		"Connection",
		"Keep-Alive",
		"Proxy-Connection",
		"Transfer-Encoding",
		"Upgrade",
		"Access-Control-Allow-Headers",
		"Access-Control-Allow-Methods",
		"Access-Control-Allow-Origin",
		"Access-Control-Expose-Headers",
		"Server",
		"Cookie",
		"X-CSRFToken",
	}
	for _, h := range badHeaders {
		r.Header.Del(h)
	}
	return nil
}

func createProxy(proxyUrl *url.URL, serviceCAfile string) (*httputil.ReverseProxy, error) {
	// TODO: allow custom CA per datasource
	serviceCertPEM, err := os.ReadFile(serviceCAfile)
	if err != nil {
		return nil, fmt.Errorf("failed to read certificate file: tried '%s' and got %v", serviceCAfile, err)
	}
	serviceProxyRootCAs := x509.NewCertPool()
	if !serviceProxyRootCAs.AppendCertsFromPEM(serviceCertPEM) {
		return nil, fmt.Errorf("no CA found for Kubernetes services, proxy to datasources will fail")
	}
	serviceProxyTLSConfig := oscrypto.SecureTLSConfig(&tls.Config{
		RootCAs: serviceProxyRootCAs,
	})

	const (
		dialerKeepalive       = 30 * time.Second
		dialerTimeout         = 5 * time.Minute // Maximum request timeout for most browsers.
		tlsHandshakeTimeout   = 10 * time.Second
		websocketPingInterval = 30 * time.Second
		websocketTimeout      = 30 * time.Second
	)

	dialer := &net.Dialer{
		Timeout:   dialerTimeout,
		KeepAlive: dialerKeepalive,
	}

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialer.DialContext(ctx, network, addr)
		},
		TLSClientConfig:     serviceProxyTLSConfig,
		TLSHandshakeTimeout: tlsHandshakeTimeout,
	}

	reverseProxy := httputil.NewSingleHostReverseProxy(proxyUrl)
	reverseProxy.FlushInterval = time.Millisecond * 100
	reverseProxy.Transport = transport
	reverseProxy.ModifyResponse = FilterHeaders
	return reverseProxy, nil
}

func getProxies(alertmanager K8sResource, thanosQuerier K8sResource, serviceCAfile string) (map[KindType]*httputil.ReverseProxy, error) {
	proxies := make(map[KindType]*httputil.ReverseProxy)
	for _, allowedKind := range allowedKinds {
		var targetURL string
		if allowedKind == AlertManagerKind {
			service := DNSName(alertmanager.Name)
			targetURL = fmt.Sprintf("https://%s-%s.%s.svc:9094", alertmanager.Kind, service, alertmanager.Namespace)
		} else if allowedKind == ThanosQuerierKind {
			// this is only for the rules endpoint, determine if we need more
			service := DNSName(thanosQuerier.Name)
			targetURL = fmt.Sprintf("https://%s.%s.svc:9091", service, thanosQuerier.Namespace)
		}
		// svc is only valid inside the cluster. May want to add a development version?

		log.Info(fmt.Sprintf("Proxy of Type: %s Points to Url: %s", allowedKind, targetURL))
		proxyURL, err := url.Parse(targetURL)
		if err != nil {
			return nil, err
		}

		// proxy not found in cache, validate if a resource exists with this namespace/name
		proxy, err := createProxy(proxyURL, serviceCAfile)
		if err != nil {
			return nil, err
		}
		proxies[allowedKind] = proxy
	}
	return proxies, nil
}

func handleError(w http.ResponseWriter, code int, err error) {
	log.Error(err)
	http.Error(w, err.Error(), code)
}

func (h *ProxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	// all path params are unescaped by gorilla/mux
	kind := KindType(vars["kind"])

	if len(kind) == 0 {
		handleError(w, http.StatusBadRequest, errors.New("cannot proxy request, resource kind was not provided"))
		return
	}
	if !slices.Contains(allowedKinds, KindType(kind)) {
		handleError(w, http.StatusBadRequest, errors.New("cannot proxy request, invalid resource kind"))
		return
	}

	var proxy *httputil.ReverseProxy
	if kind == AlertManagerKind {
		proxy = h.alertManagerProxy
	} else if kind == ThanosQuerierKind {
		proxy = h.thanosQuerierProxy
	}

	http.StripPrefix(fmt.Sprintf("/proxy/%s", url.PathEscape(string(kind))), proxy).ServeHTTP(w, r)
}
