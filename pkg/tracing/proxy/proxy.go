package proxy

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
	lru "github.com/hashicorp/golang-lru/v2"
	oscrypto "github.com/openshift/library-go/pkg/crypto"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/dynamic"

	"github.com/openshift/monitoring-plugin/pkg/monitoring"
	"github.com/openshift/monitoring-plugin/pkg/tracing/api"
)

var log = logrus.WithField("module", "proxy")

type ProxyHandler struct {
	k8sclient       *dynamic.DynamicClient
	serviceCAfile   string
	tlsMinVersion   uint16
	tlsCipherSuites []uint16
	proxyCache      *lru.Cache[string, *httputil.ReverseProxy]
}

func NewProxyHandler(k8sclient *dynamic.DynamicClient, serviceCAfile string, tlsMinVersion uint16, tlsCipherSuites []uint16) *ProxyHandler {
	proxyCache, err := lru.New[string, *httputil.ReverseProxy](128)
	if err != nil {
		// the only error path of lru.New is size <= 0
		panic(fmt.Errorf("cannot allocate LRU cache: %w", err))
	}

	return &ProxyHandler{
		k8sclient:       k8sclient,
		serviceCAfile:   serviceCAfile,
		tlsMinVersion:   tlsMinVersion,
		tlsCipherSuites: tlsCipherSuites,
		proxyCache:      proxyCache,
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
	}
	for _, h := range badHeaders {
		r.Header.Del(h)
	}
	return nil
}

// tempoSearchPath is Tempo's TraceQL search endpoint. With query RBAC enabled,
// the Tempo gateway used to drop the "traces" field from zero-result responses
// instead of returning an empty array (TRACING-6841), and the
// @perses-dev/tempo-plugin used by the frontend crashes on a missing field with
// "Cannot read properties of undefined (reading 'map')":
// https://github.com/perses/plugins/blob/main/tempo/src/plugins/tempo-trace-query/get-trace-data.ts
// Ensure "traces" is always present so the empty state renders regardless of
// the gateway version.
const tempoSearchPath = "/api/search"

// maxSearchResponseBytes bounds how much of a Tempo /api/search response
// addEmptyTracesField will buffer in memory to inspect and rewrite. Tempo
// limits the number of traces returned, not the response size, so a search
// response can be arbitrarily large; anything over this limit is passed
// through unmodified rather than being fully buffered.
const maxSearchResponseBytes = 5 * 1024 * 1024 // 5 MiB

// addEmptyTracesField rewrites a Tempo search response that omits the
// "traces" field to include an empty one, so the frontend's TraceQL query
// plugin can render the empty-results state instead of crashing.
func addEmptyTracesField(resp *http.Response) error {
	if resp.StatusCode != http.StatusOK || !strings.HasSuffix(resp.Request.URL.Path, tempoSearchPath) {
		return nil
	}
	// Tempo has shipped /api/search responses with no Content-Type header at
	// all (https://github.com/grafana/tempo/issues/4121); treat those as JSON
	// too rather than skipping the rewrite.
	if contentType := resp.Header.Get("Content-Type"); contentType != "" {
		mediaType, _, err := mime.ParseMediaType(contentType)
		if err != nil || !strings.EqualFold(mediaType, "application/json") {
			return nil
		}
	}

	prefix, err := io.ReadAll(io.LimitReader(resp.Body, maxSearchResponseBytes+1))
	if err != nil {
		return err
	}

	if int64(len(prefix)) > maxSearchResponseBytes {
		// Too large to safely buffer and rewrite; pass the response through
		// unmodified by restoring the body from the bytes already consumed
		// plus whatever remains unread on the original reader. Close still
		// delegates to the original body so its underlying connection is
		// released once the proxy is done writing the response.
		original := resp.Body
		resp.Body = struct {
			io.Reader
			io.Closer
		}{
			Reader: io.MultiReader(bytes.NewReader(prefix), original),
			Closer: original,
		}
		return nil
	}

	if err := resp.Body.Close(); err != nil {
		return err
	}
	resp.Body = io.NopCloser(bytes.NewReader(prefix))

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(prefix, &payload); err != nil || payload == nil {
		// Not a JSON object we understand; pass through unmodified.
		return nil
	}
	if _, ok := payload["traces"]; ok {
		return nil
	}

	payload["traces"] = json.RawMessage("[]")
	newBody, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp.Body = io.NopCloser(bytes.NewReader(newBody))
	resp.ContentLength = int64(len(newBody))
	resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(newBody)))
	return nil
}

func (h *ProxyHandler) buildTLSConfig() (*tls.Config, error) {
	tlsConfig := oscrypto.SecureTLSConfig(&tls.Config{})

	if h.serviceCAfile != "" {
		serviceCertPEM, err := os.ReadFile(h.serviceCAfile)
		if err != nil {
			return nil, fmt.Errorf("failed to read certificate file: tried '%s' and got %v", h.serviceCAfile, err)
		}

		serviceProxyRootCAs := x509.NewCertPool()
		if !serviceProxyRootCAs.AppendCertsFromPEM(serviceCertPEM) {
			return nil, fmt.Errorf("no CA found for Kubernetes services, proxy to datasources will fail")
		}
		tlsConfig.RootCAs = serviceProxyRootCAs
	}

	if h.tlsMinVersion != 0 {
		tlsConfig.MinVersion = h.tlsMinVersion
	}
	if len(h.tlsCipherSuites) > 0 {
		tlsConfig.CipherSuites = h.tlsCipherSuites
	}

	return tlsConfig, nil
}

func (h *ProxyHandler) createProxy(tempo api.TempoResource, tenant string) (*httputil.ReverseProxy, error) {
	// TODO: allow custom CA per datasource
	serviceProxyTLSConfig, err := h.buildTLSConfig()
	if err != nil {
		return nil, err
	}

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

	var targetURL string
	switch tempo.Kind {
	case api.KindTempoStack:
		if len(tempo.Tenants) > 0 {
			service := monitoring.DNSName(fmt.Sprintf("tempo-%s-gateway", tempo.Name))
			targetURL = fmt.Sprintf("https://%s.%s.svc:8080/api/traces/v1/%s/tempo", service, tempo.Namespace, url.PathEscape(tenant))
		} else {
			service := monitoring.DNSName(fmt.Sprintf("tempo-%s-query-frontend", tempo.Name))
			targetURL = fmt.Sprintf("http://%s.%s.svc:3200", service, tempo.Namespace)
		}

	case api.KindTempoMonolithic:
		if len(tempo.Tenants) > 0 {
			service := monitoring.DNSName(fmt.Sprintf("tempo-%s-gateway", tempo.Name))
			targetURL = fmt.Sprintf("https://%s.%s.svc:8080/api/traces/v1/%s/tempo", service, tempo.Namespace, url.PathEscape(tenant))
		} else {
			service := monitoring.DNSName(fmt.Sprintf("tempo-%s", tempo.Name))
			targetURL = fmt.Sprintf("http://%s.%s.svc:3200", service, tempo.Namespace)
		}

	default:
		return nil, fmt.Errorf("invalid Tempo resource with kind '%s'", tempo.Kind)
	}

	// For local development, set the target URL to a local Tempo instance
	// targetURL = "http://localhost:3200"

	proxyURL, err := url.Parse(targetURL)
	if err != nil {
		return nil, err
	}

	reverseProxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(proxyURL)
			// Request an uncompressed response so ModifyResponse can safely
			// inspect and rewrite the JSON body below.
			pr.Out.Header.Del("Accept-Encoding")
		},
	}
	reverseProxy.FlushInterval = time.Millisecond * 100
	reverseProxy.Transport = transport

	reverseProxy.ModifyResponse = func(resp *http.Response) error {
		if err := FilterHeaders(resp); err != nil {
			return err
		}
		return addEmptyTracesField(resp)
	}
	reverseProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("http: proxy error: %v", err)
		w.WriteHeader(http.StatusBadGateway)
		_, _ = fmt.Fprintf(w, "Error connecting to Tempo instance: %s", err)
	}
	return reverseProxy, nil
}

func handleError(w http.ResponseWriter, code int, err error) {
	log.Error(err)
	http.Error(w, err.Error(), code)
}

func (h *ProxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	// all path params are unescaped by gorilla/mux
	namespace := vars["namespace"]
	name := vars["name"]
	tenant := vars["tenant"]

	if len(namespace) == 0 {
		handleError(w, http.StatusBadRequest, errors.New("cannot proxy request, namespace was not provided"))
		return
	}

	if len(name) == 0 {
		handleError(w, http.StatusBadRequest, errors.New("cannot proxy request, tempo name was not provided"))
		return
	}

	// Slashes are not allowed in the namespace or name fields, therefore it's a suitable cache key separator
	cacheKey := fmt.Sprintf("%s/%s/%s", namespace, name, tenant)

	// If two requests arrive simultaneously, it's likely that two proxy instances will be created,
	// the later one overriding the first one in the cache.
	// This could be avoided by locking, at the cost of performance.
	proxy, ok := h.proxyCache.Get(cacheKey)
	if !ok {
		// proxy not found in cache, validate if a Tempo resource exists with this namespace/name
		tempo, err := h.lookupTempoResource(r.Context(), namespace, name)
		if err != nil {
			handleError(w, http.StatusInternalServerError, fmt.Errorf("cannot proxy request: %w", err))
			return
		}

		proxy, err = h.createProxy(tempo, tenant)
		if err != nil {
			handleError(w, http.StatusInternalServerError, fmt.Errorf("cannot proxy request: %w", err))
			return
		}
		h.proxyCache.Add(cacheKey, proxy)
	}

	http.StripPrefix(fmt.Sprintf("/proxy/%s/%s/%s", url.PathEscape(namespace), url.PathEscape(name), url.PathEscape(tenant)), proxy).ServeHTTP(w, r)
}

func (h *ProxyHandler) lookupTempoResource(ctx context.Context, namespace string, name string) (api.TempoResource, error) {
	resources, err := api.ListTempoResources(ctx, h.k8sclient)
	if err != nil {
		return api.TempoResource{}, err
	}

	var tempo api.TempoResource
	found := false
	for _, resource := range resources {
		if resource.Namespace == namespace && resource.Name == name {
			found = true
			tempo = resource
			break
		}
	}

	if !found {
		return api.TempoResource{}, fmt.Errorf("%s/%s is not a valid Tempo resource", namespace, name)
	}
	return tempo, nil
}
