package server

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/openshift/monitoring-plugin/pkg/proxy"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apiserver/pkg/server/dynamiccertificates"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/record"
)

var log = logrus.WithField("module", "server")

type Config struct {
	Port             int
	CertFile         string
	PrivateKeyFile   string
	Features         map[Feature]bool
	StaticPath       string
	ConfigPath       string
	PluginConfigPath string
	AlertmanagerUrl  string
	ThanosQuerierUrl string
	TLSMinVersion    uint16
	TLSMaxVersion    uint16
	TLSCipherSuites  []uint16
}

func (c *Config) IsTLSEnabled() bool {
	return c.CertFile != "" && c.PrivateKeyFile != ""
}

type PluginServer struct {
	*http.Server
	Config *Config
}

type PluginConfig struct {
	Timeout time.Duration `json:"timeout,omitempty" yaml:"timeout,omitempty"`
}

type Feature string

const (
	AcmAlerting           Feature = "acm-alerting"
	Incidents             Feature = "incidents"
	DevConfig             Feature = "dev-config"
	PersesDashboards      Feature = "perses-dashboards"
	ClusterHealthAnalyzer Feature = "cluster-health-analyzer"
)

func (pluginConfig *PluginConfig) MarshalJSON() ([]byte, error) {
	type Alias PluginConfig
	return json.Marshal(&struct {
		Timeout float64 `json:"timeout,omitempty"`
		*Alias
	}{
		Timeout: pluginConfig.Timeout.Seconds(),
		Alias:   (*Alias)(pluginConfig),
	})
}

func CreateServer(ctx context.Context, cfg *Config) (*PluginServer, error) {
	httpServer, err := createHTTPServer(ctx, cfg)
	if err != nil {
		return nil, err
	}

	return &PluginServer{
		Config: cfg,
		Server: httpServer,
	}, nil
}

func (s *PluginServer) StartHTTPServer() error {
	if s.Config.IsTLSEnabled() {
		log.Infof("listening for https on %s", s.Server.Addr)
		return s.Server.ListenAndServeTLS(s.Config.CertFile, s.Config.PrivateKeyFile)
	}
	log.Infof("listening for http on %s", s.Server.Addr)
	return s.Server.ListenAndServe()
}

func (s *PluginServer) Shutdown(ctx context.Context) error {
	if s.Server != nil {
		return s.Server.Shutdown(ctx)
	}
	return nil
}

func createHTTPServer(ctx context.Context, cfg *Config) (*http.Server, error) {
	acmMode := cfg.Features[AcmAlerting]
	acmLocationsLength := len(cfg.AlertmanagerUrl) + len(cfg.ThanosQuerierUrl)

	if acmLocationsLength > 0 && !acmMode {
		return nil, fmt.Errorf("alertmanager and thanos-querier cannot be set without the 'acm-alerting' feature flag")
	}
	if acmLocationsLength == 0 && acmMode {
		return nil, fmt.Errorf("alertmanager and thanos-querier must be set to use the 'acm-alerting' feature flag")
	}

	if cfg.Port == int(proxy.AlertmanagerPort) || cfg.Port == int(proxy.ThanosQuerierPort) {
		return nil, fmt.Errorf("cannot set default port to reserved port %d", cfg.Port)
	}

	// Uncomment the following line for local development:
	// k8sconfig, err := clientcmd.BuildConfigFromFlags("", "$HOME/.kube/config")

	// Comment the following line for local development:
	var k8sclient *dynamic.DynamicClient
	if acmMode {

		k8sconfig, err := rest.InClusterConfig()

		if err != nil {
			return nil, fmt.Errorf("cannot get in cluster config: %w", err)
		}

		k8sclient, err = dynamic.NewForConfig(k8sconfig)
		if err != nil {
			return nil, fmt.Errorf("error creating dynamicClient: %w", err)
		}
	} else {
		k8sclient = nil
	}

	router, pluginConfig := setupRoutes(cfg)
	router.Use(corsHeaderMiddleware())

	tlsConfig := &tls.Config{}

	tlsEnabled := cfg.IsTLSEnabled()
	if tlsEnabled {
		// Set MinVersion - default to TLS 1.2 if not specified
		if cfg.TLSMinVersion != 0 {
			tlsConfig.MinVersion = cfg.TLSMinVersion
		} else {
			tlsConfig.MinVersion = tls.VersionTLS12
		}

		if cfg.TLSMaxVersion != 0 {
			tlsConfig.MaxVersion = cfg.TLSMaxVersion
		}

		if len(cfg.TLSCipherSuites) > 0 {
			tlsConfig.CipherSuites = cfg.TLSCipherSuites
		}

		// Build and run the controller which reloads the certificate and key
		// files whenever they change.
		certKeyPair, err := dynamiccertificates.NewDynamicServingContentFromFiles("serving-cert", cfg.CertFile, cfg.PrivateKeyFile)
		if err != nil {
			log.WithError(err).Fatal("unable to create TLS controller")
		}

		if err := certKeyPair.RunOnce(ctx); err != nil {
			log.WithError(err).Fatal("failed to initialize cert/key content")
		}

		eventBroadcaster := record.NewBroadcaster()
		eventBroadcaster.StartLogging(func(format string, args ...interface{}) {
			log.Infof(format, args...)
		})

		ctrl := dynamiccertificates.NewDynamicServingCertificateController(
			tlsConfig,
			nil,
			certKeyPair,
			nil,
			record.NewEventRecorderAdapter(
				eventBroadcaster.NewRecorder(scheme.Scheme, v1.EventSource{Component: "monitoring-plugin"}),
			),
		)
		// Configure the server to use the cert/key pair for all client connections.
		tlsConfig.GetConfigForClient = ctrl.GetConfigForClient

		// Notify cert/key file changes to the controller.
		certKeyPair.AddListener(ctrl)

		// Start certificate controllers in background
		go ctrl.Run(1, ctx.Done())
		go certKeyPair.Run(ctx, 1)
	}

	timeout := 30 * time.Second
	if pluginConfig != nil {
		timeout = pluginConfig.Timeout
	}

	httpServer := &http.Server{
		Handler:      router,
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		TLSConfig:    tlsConfig,
		ReadTimeout:  timeout,
		WriteTimeout: timeout,
	}

	if logrus.GetLevel() == logrus.TraceLevel {
		loggedRouter := handlers.LoggingHandler(log.Logger.Out, router)
		httpServer.Handler = loggedRouter
	}

	// Start proxy servers if in ACM mode
	if tlsEnabled && acmMode {
		startProxy(cfg, k8sclient, tlsConfig, timeout, proxy.AlertManagerKind, proxy.AlertmanagerPort)
		startProxy(cfg, k8sclient, tlsConfig, timeout, proxy.ThanosQuerierKind, proxy.ThanosQuerierPort)
	}

	return httpServer, nil
}

func setupRoutes(cfg *Config) (*mux.Router, *PluginConfig) {
	configHandlerFunc, pluginConfig := configHandler(cfg)

	router := mux.NewRouter()

	router.PathPrefix("/health").HandlerFunc(healthHandler())

	router.Path("/plugin-manifest.json").Handler(manifestHandler(cfg))

	router.PathPrefix("/features").HandlerFunc(featuresHandler(cfg))
	router.PathPrefix("/config").HandlerFunc(configHandlerFunc)
	router.PathPrefix("/").Handler(filesHandler(http.Dir(cfg.StaticPath)))

	return router, pluginConfig
}

func setupProxyRoutes(cfg *Config, k8sclient *dynamic.DynamicClient, kind proxy.KindType) *mux.Router {
	router := mux.NewRouter()
	var proxyUrl string
	switch kind {
	case proxy.AlertManagerKind:
		proxyUrl = cfg.AlertmanagerUrl
	case proxy.ThanosQuerierKind:
		proxyUrl = cfg.ThanosQuerierUrl
	}

	router.PathPrefix("/").Handler(proxy.NewProxyHandler(
		k8sclient,
		cfg.CertFile,
		kind,
		proxyUrl,
	))

	return router
}

type headerPreservingWriter struct {
	http.ResponseWriter
	wroteHeader bool
}

func (w *headerPreservingWriter) WriteHeader(statusCode int) {
	if !w.wroteHeader {
		if w.Header().Get("Cache-Control") == "" {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		}
		if w.Header().Get("Expires") == "" {
			w.Header().Set("Expires", "0")
		}
		w.wroteHeader = true
	}
	w.ResponseWriter.WriteHeader(statusCode)
}

func filesHandler(root http.FileSystem) http.Handler {
	fileServer := http.FileServer(root)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// disable caching for plugin entry point
		if strings.HasPrefix(r.URL.Path, "/plugin-entry.js") {
			fileServer.ServeHTTP(&headerPreservingWriter{ResponseWriter: w}, r)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func healthHandler() http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
}

func corsHeaderMiddleware() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			headers := w.Header()
			headers.Set("Access-Control-Allow-Origin", "*")
			next.ServeHTTP(w, r)
		})
	}
}

func featuresHandler(cfg *Config) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jsonFeatures, err := json.Marshal(cfg.Features)

		if err != nil {
			log.WithError(err).Errorf("cannot marshall, features were: %v", string(jsonFeatures))
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(jsonFeatures)
	})
}

func configHandler(cfg *Config) (http.HandlerFunc, *PluginConfig) {
	pluginConfData, err := os.ReadFile(cfg.PluginConfigPath)

	if err != nil {
		log.WithError(err).Warnf("cannot read config file, serving plugin with default configuration, tried %s", cfg.PluginConfigPath)

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("{}"))
		}), nil
	}

	var pluginConfig PluginConfig
	err = yaml.Unmarshal(pluginConfData, &pluginConfig)

	if err != nil {
		log.WithError(err).Error("unable to unmarshall config data")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "unable to unmarshall config data", http.StatusInternalServerError)
		}), nil
	}

	jsonPluginConfig, err := pluginConfig.MarshalJSON()

	if err != nil {
		log.WithError(err).Errorf("unable to marshall, config data: %v", pluginConfig)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "unable to marshall config data", http.StatusInternalServerError)
		}), nil
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(jsonPluginConfig)
	}), &pluginConfig
}

func startProxy(cfg *Config, k8sclient *dynamic.DynamicClient, tlsConfig *tls.Config, timeout time.Duration, kind proxy.KindType, port proxy.ProxyPort) {
	proxyRouter := setupProxyRoutes(cfg, k8sclient, kind)
	proxyRouter.Use(corsHeaderMiddleware())
	proxyServer := &http.Server{
		Handler:      proxyRouter,
		Addr:         fmt.Sprintf(":%d", port),
		TLSConfig:    tlsConfig,
		ReadTimeout:  timeout,
		WriteTimeout: timeout,
	}
	log.Infof("%s proxy listening for https on %s", kind, proxyServer.Addr)

	go func() {
		panic(proxyServer.ListenAndServeTLS(cfg.CertFile, cfg.PrivateKeyFile))
	}()
}
