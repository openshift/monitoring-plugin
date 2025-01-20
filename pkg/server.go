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
}

type PluginConfig struct {
	Timeout time.Duration `json:"timeout,omitempty" yaml:"timeout,omitempty"`
}

type Feature string

const (
	AcmAlerting      Feature = "acm-alerting"
	Incidents        Feature = "incidents"
	DevConfig        Feature = "dev-config"
	PersesDashboards Feature = "perses-dashboards"
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
		ctx := context.Background()

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

	if tlsEnabled {
		if acmMode {
			startProxy(cfg, k8sclient, tlsConfig, timeout, proxy.AlertManagerKind, proxy.AlertmanagerPort)
			startProxy(cfg, k8sclient, tlsConfig, timeout, proxy.ThanosQuerierKind, proxy.ThanosQuerierPort)
		}

		log.Infof("listening for https on %s", httpServer.Addr)
		panic(httpServer.ListenAndServeTLS(cfg.CertFile, cfg.PrivateKeyFile))
	} else {
		log.Infof("listening for http on %s", httpServer.Addr)
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
