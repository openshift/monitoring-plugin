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

var errTempoNotFound = errors.New("is not a valid Tempo resource")

var errResponseRewrite = errors.New("cannot rewrite Tempo response")

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
			return nil, fmt.Errorf("failed to read service CA file: %w", errors.Unwrap(err))
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
			return fmt.Errorf("%w: %w", errResponseRewrite, err)
		}
		if err := addEmptyTracesField(resp); err != nil {
			return fmt.Errorf("%w: %w", errResponseRewrite, err)
		}
		return nil
	}
	tempoLog := log.WithFields(logrus.Fields{"namespace": tempo.Namespace, "tempo": tempo.Name})
	reverseProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		errorKind := monitoring.ErrorKind(err)
		if errors.Is(err, errResponseRewrite) {
			errorKind = "response_rewrite"
		}
		tempoLog.WithField("error_kind", errorKind).Error("error connecting to Tempo instance")
		http.Error(w, "Error connecting to Tempo instance", http.StatusBadGateway)
	}
	reverseProxy.ErrorLog = monitoring.NewRedactedErrorLog(tempoLog)
	return reverseProxy, nil
}

func handleError(w http.ResponseWriter, code int, clientMsg string, err error) {
	log.WithField("error_kind", monitoring.ErrorKind(err)).Error(clientMsg)
	http.Error(w, clientMsg, code)
}

func (h *ProxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	// all path params are unescaped by gorilla/mux
	namespace := vars["namespace"]
	name := vars["name"]
	tenant := vars["tenant"]

	if len(namespace) == 0 {
		const msg = "cannot proxy request, namespace was not provided"
		handleError(w, http.StatusBadRequest, msg, errors.New(msg))
		return
	}

	if len(name) == 0 {
		const msg = "cannot proxy request, tempo name was not provided"
		handleError(w, http.StatusBadRequest, msg, errors.New(msg))
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
			clientMsg := "cannot proxy request: unable to look up Tempo resource"
			if errors.Is(err, errTempoNotFound) {
				clientMsg = fmt.Sprintf("cannot proxy request: %s", err)
			}
			handleError(w, http.StatusInternalServerError, clientMsg, fmt.Errorf("cannot proxy request: %w", err))
			return
		}

		proxy, err = h.createProxy(tempo, tenant)
		if err != nil {
			handleError(w, http.StatusInternalServerError, "cannot proxy request: unable to configure connection to Tempo instance", fmt.Errorf("cannot proxy request: %w", err))
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
		return api.TempoResource{}, fmt.Errorf("%s/%s %w", namespace, name, errTempoNotFound)
	}
	return tempo, nil
}
