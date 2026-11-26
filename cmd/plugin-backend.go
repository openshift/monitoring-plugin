package main

import (
	"context"
	"crypto/tls"
	"errors"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"

	server "github.com/openshift/monitoring-plugin/pkg/server"
)

// shutdownGracePeriod bounds the HTTP server shutdown after SIGTERM. The
// deployment's termination grace period is 30 seconds by default, and the
// remaining budget goes to releasing the metrics leader lease.
const shutdownGracePeriod = 10 * time.Second

var (
	portArg             = flag.Int("port", 9443, "server port to listen on\nports 9444 and 9445 reserved for other use")
	certArg             = flag.String("cert", "", "cert file path to enable TLS (disabled by default)")
	clientCAFileArg     = flag.String("client-ca-file", "", "client CA bundle file for metrics certificate authentication (it requires TLS to be enabled)")
	keyArg              = flag.String("key", "", "private key file path to enable TLS (disabled by default)")
	featuresArg         = flag.String("features", "", "enabled features, comma separated.\noptions: ['logging', 'acm-alerting', 'alerting', 'alert-management-api', 'legacy-dashboards', 'metrics', 'targets', 'overview', 'perses-dashboards', 'cluster-health-analyzer', 'troubleshooting', 'agent-navigation', 'tracing']")
	staticPathArg       = flag.String("static-path", "/opt/app-root/web/dist", "static files path to serve frontend")
	configPathArg       = flag.String("config-path", "/opt/app-root/config", "config files path")
	pluginConfigArg     = flag.String("plugin-config-path", "/etc/plugin/config.yaml", "plugin yaml configuration")
	logLevelArg         = flag.String("log-level", logrus.InfoLevel.String(), "verbosity of logs\noptions: ['panic', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']\n'trace' level logs every incoming request URI, including query strings; enable it only temporarily for debugging")
	alertmanagerUrlArg  = flag.String("alertmanager", "", "Alertmanager URL to proxy to for ACM mode")
	thanosQuerierUrlArg = flag.String("thanos-querier", "", "Thanos Querier URL to proxy to for ACM mode")
	tlsMinVersionArg    = flag.String("tls-min-version", "VersionTLS12", "minimum TLS version\noptions: ['VersionTLS10', 'VersionTLS11', 'VersionTLS12', 'VersionTLS13']")
	tlsMaxVersionArg    = flag.String("tls-max-version", "", "maximum TLS version\noptions: ['VersionTLS10', 'VersionTLS11', 'VersionTLS12', 'VersionTLS13']\n(default is the highest supported by Go)")
	tlsCipherSuitesArg  = flag.String("tls-cipher-suites", "", "comma-separated list of cipher suites for the server\nvalues are from tls package constants (https://golang.org/pkg/crypto/tls/#pkg-constants)")
	tlsCurvesArg        = flag.String("tls-curves", "", "comma-separated list of TLS curves for the server\nvalues are tls.CurveID names (https://pkg.go.dev/crypto/tls#CurveID) or OpenShift TLS group names")
	log                 = logrus.WithField("module", "main")
)

func main() {
	flag.Parse()

	port := mergeEnvValueInt("PORT", *portArg)
	cert := mergeEnvValue("CERT_FILE_PATH", *certArg)
	key := mergeEnvValue("PRIVATE_KEY_FILE_PATH", *keyArg)
	clientCAFile := mergeEnvValue("CLIENT_CA_FILE_PATH", *clientCAFileArg)
	features := mergeEnvValue("MONITORING_PLUGIN_FEATURES", *featuresArg)
	staticPath := mergeEnvValue("MONITORING_PLUGIN_STATIC_PATH", *staticPathArg)
	configPath := mergeEnvValue("MONITORING_PLUGIN_MANIFEST_CONFIG_PATH", *configPathArg)
	pluginConfigPath := mergeEnvValue("MONITORING_PLUGIN_CONFIG_PATH", *pluginConfigArg)
	logLevel := mergeEnvValue("MONITORING_PLUGIN_LOG_LEVEL", *logLevelArg)
	alertmanagerUrl := mergeEnvValue("MONITORING_PLUGIN_ALERTMANAGER", *alertmanagerUrlArg)
	thanosQuerierUrl := mergeEnvValue("MONITORING_PLUGIN_THANOS_QUERIER", *thanosQuerierUrlArg)
	tlsMinVersion := mergeEnvValue("TLS_MIN_VERSION", *tlsMinVersionArg)
	tlsMaxVersion := mergeEnvValue("TLS_MAX_VERSION", *tlsMaxVersionArg)
	tlsCipherSuites := mergeEnvValue("TLS_CIPHER_SUITES", *tlsCipherSuitesArg)
	tlsCurves := mergeEnvValue("TLS_CURVES", *tlsCurvesArg)

	featuresList := strings.Fields(strings.Join(strings.Split(strings.ToLower(features), ","), " "))

	featuresSet := make(map[server.Feature]bool)
	for _, s := range featuresList {
		featuresSet[server.Feature(s)] = true
	}

	logrusLevel, err := logrus.ParseLevel(logLevel)
	if err != nil {
		logrusLevel = logrus.ErrorLevel
		logrus.WithError(err).Warnf("Invalid log level. Defaulting to %q", logrusLevel.String())
	}
	logrus.SetLevel(logrusLevel)

	log.Infof("enabled features: %+q\n", featuresList)

	// Parse the TLS configuration.
	tlsMinVer := server.ParseTLSVersion(tlsMinVersion)
	log.Infof("Min TLS version: %q", tls.VersionName(tlsMinVer))
	tlsMaxVer := server.ParseTLSVersion(tlsMaxVersion)
	if tlsMaxVer != 0 {
		log.Infof("Max TLS version: %q", tls.VersionName(tlsMaxVer))
	}
	tlsCiphers, err := server.ParseCipherSuites(tlsCipherSuites)
	if err != nil {
		log.WithError(err).Fatal("Invalid TLS cipher suites configuration")
	}
	if len(tlsCiphers) > 0 {
		log.Infof("TLS ciphers: %q", server.CipherSuiteNames(tlsCiphers))
	}
	tlsCurvePrefs, err := server.ParseCurves(tlsCurves)
	if err != nil {
		log.WithError(err).Fatal("Invalid TLS curves configuration")
	}
	if len(tlsCurvePrefs) > 0 {
		log.Infof("TLS curves: %q", tlsCurvePrefs)
	}

	// Cancel the server context on SIGINT/SIGTERM so that leader election
	// can release its lease before the process exits.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	srv, err := server.CreateServer(ctx, &server.Config{
		Port:                port,
		CertFile:            cert,
		PrivateKeyFile:      key,
		ClientCAFile:        clientCAFile,
		Features:            featuresSet,
		StaticPath:          staticPath,
		ConfigPath:          configPath,
		PluginConfigPath:    pluginConfigPath,
		AlertmanagerUrl:     alertmanagerUrl,
		ThanosQuerierUrl:    thanosQuerierUrl,
		TLSMinVersion:       tlsMinVer,
		TLSMaxVersion:       tlsMaxVer,
		TLSCipherSuites:     tlsCiphers,
		TLSCurvePreferences: tlsCurvePrefs,
	})

	if err != nil {
		panic(err)
	}

	go func() {
		<-ctx.Done()
		// Shutdown makes ListenAndServe return so that main can wait for
		// the leader election to stop before exiting. NotifyContext above
		// no longer lets the signal terminate the process directly.
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownGracePeriod)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.WithError(err).Warn("HTTP server shutdown failed")
		}
	}()

	if err = srv.StartHTTPServer(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		panic(err)
	}

	// Give up the alert metrics leadership (and its lease) before exiting.
	srv.WaitForLeaderElection()
}

func mergeEnvValue(key string, arg string) string {
	if arg != "" {
		return arg
	}

	return os.Getenv(key)
}

func mergeEnvValueInt(key string, arg int) int {
	if arg != 0 {
		return arg
	}

	envValue := os.Getenv(key)

	i, err := strconv.Atoi(envValue)
	if err != nil {
		return 0
	}

	return i
}
