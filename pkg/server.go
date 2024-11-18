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
	"k8s.io/apiserver/pkg/server/dynamiccertificates"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
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
	LogLevel         string
	AlertmanagerUrl  string
	ThanosQuerierUrl string
}

type PluginConfig struct {
	Timeout time.Duration `json:"timeout,omitempty" yaml:"timeout,omitempty"`
}

type Feature string

const (
	AcmAlerting Feature = "acm-alerting"
	Incidents   Feature = "incidents"
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

func Start(cfg *Config) {
	acmMode := cfg.Features[AcmAlerting]
	acmLocationsLength := len(cfg.AlertmanagerUrl) + len(cfg.ThanosQuerierUrl)

	if acmLocationsLength > 0 && !acmMode {
		log.Panic("alertmanager and thanos-querier cannot be set without the 'acm-alerting' feature flag")
	}
	if acmLocationsLength == 0 && acmMode {
		log.Panic("alertmanager and thanos-querier must be set to use the 'acm-alerting' feature flag")
	}

	if cfg.Port == int(proxy.AlertmanagerPort) || cfg.Port == int(proxy.ThanosQuerierPort) {
		log.Panic(fmt.Printf("Cannot set default port to reserved port %d", cfg.Port))
	}

	// Uncomment the following line for local development:
	// k8sconfig, err := clientcmd.BuildConfigFromFlags("", "$HOME/.kube/config")

	// Comment the following line for local development:
	var k8sclient *dynamic.DynamicClient
	if acmMode {

		k8sconfig, err := rest.InClusterConfig()

		if err != nil {
			panic(fmt.Errorf("cannot get in cluster config: %w", err))
		}

		k8sclient, err = dynamic.NewForConfig(k8sconfig)
		if err != nil {
			panic(fmt.Errorf("error creating dynamicClient: %w", err))
		}
	} else {
		k8sclient = nil
	}

	router, pluginConfig := setupRoutes(cfg)
	router.Use(corsHeaderMiddleware())

	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}
	tlsEnabled := cfg.CertFile != "" && cfg.PrivateKeyFile != ""
	if tlsEnabled {
		// Build and run the controller which reloads the certificate and key
		// files whenever they change.
		certKeyPair, err := dynamiccertificates.NewDynamicServingContentFromFiles("serving-cert", cfg.CertFile, cfg.PrivateKeyFile)
		if err != nil {
			logrus.WithError(err).Fatal("unable to create TLS controller")
		}
		ctrl := dynamiccertificates.NewDynamicServingCertificateController(
			tlsConfig,
			nil,
			certKeyPair,
			nil,
			nil,
		)

		// Check that the cert and key files are valid.
		if err := ctrl.RunOnce(); err != nil {
			logrus.WithError(err).Fatal("invalid certificate/key files")
		}

		ctx := context.Background()
		go ctrl.Run(1, ctx.Done())
	}

	timeout := 30 * time.Second
	if pluginConfig != nil {
		timeout = pluginConfig.Timeout
	}

	logrusLevel, err := logrus.ParseLevel(cfg.LogLevel)
	if err != nil {
		logrus.WithError(err).Warn("Invalid log level. Defaulting to 'error'")
		logrusLevel = logrus.ErrorLevel
	}

	httpServer := &http.Server{
		Handler:      router,
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		TLSConfig:    tlsConfig,
		ReadTimeout:  timeout,
		WriteTimeout: timeout,
	}

	if logrusLevel == logrus.TraceLevel {
		loggedRouter := handlers.LoggingHandler(log.Logger.Out, router)
		httpServer.Handler = loggedRouter
	}

	if tlsEnabled {
		log.Infof("listening on https. port: %d", cfg.Port)

		if acmMode {
			startProxy(cfg, k8sclient, tlsConfig, timeout, proxy.AlertManagerKind, proxy.AlertmanagerPort)
			startProxy(cfg, k8sclient, tlsConfig, timeout, proxy.ThanosQuerierKind, proxy.ThanosQuerierPort)
		}

		logrus.SetLevel(logrusLevel)
		panic(httpServer.ListenAndServeTLS(cfg.CertFile, cfg.PrivateKeyFile))
	} else {
		log.Infof("listening on http. port: %d", cfg.Port)
		logrus.SetLevel(logrusLevel)
		panic(httpServer.ListenAndServe())
	}
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

func filesHandler(root http.FileSystem) http.Handler {
	fileServer := http.FileServer(root)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		filePath := r.URL.Path

		// disable caching for plugin entry point
		if strings.HasPrefix(filePath, "/plugin-entry.js") {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Expires", "0")
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
	log.Infof("%s proxy listening on https. port %d", kind, port)
	proxyRouter := setupProxyRoutes(cfg, k8sclient, kind)
	proxyRouter.Use(corsHeaderMiddleware())
	proxyServer := &http.Server{
		Handler:      proxyRouter,
		Addr:         fmt.Sprintf(":%d", port),
		TLSConfig:    tlsConfig,
		ReadTimeout:  timeout,
		WriteTimeout: timeout,
	}

	go func() {
		panic(proxyServer.ListenAndServeTLS(cfg.CertFile, cfg.PrivateKeyFile))
	}()
}
