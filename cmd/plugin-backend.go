package main

import (
	"context"
	"flag"
	"os"
	"strconv"
	"strings"

	server "github.com/openshift/monitoring-plugin/pkg"
	"github.com/sirupsen/logrus"
	k8sapiflag "k8s.io/component-base/cli/flag"
)

var (
	portArg             = flag.Int("port", 0, "server port to listen on (default: 9443)\nports 9444 and 9445 reserved for other use")
	certArg             = flag.String("cert", "", "cert file path to enable TLS (disabled by default)")
	keyArg              = flag.String("key", "", "private key file path to enable TLS (disabled by default)")
	featuresArg         = flag.String("features", "", "enabled features, comma separated.\noptions: ['acm-alerting', 'dev-config', 'perses-dashboards']")
	staticPathArg       = flag.String("static-path", "", "static files path to serve frontend (default: './web/dist')")
	configPathArg       = flag.String("config-path", "", "config files path (default: './config')")
	pluginConfigArg     = flag.String("plugin-config-path", "", "plugin yaml configuration")
	logLevelArg         = flag.String("log-level", logrus.InfoLevel.String(), "verbosity of logs\noptions: ['panic', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']\n'trace' level will log all incoming requests\n(default 'error')")
	alertmanagerUrlArg  = flag.String("alertmanager", "", "alertmanager url to proxy to for acm mode")
	thanosQuerierUrlArg = flag.String("thanos-querier", "", "thanos querier url to proxy to for acm mode")
	tlsMinVersionArg    = flag.String("tls-min-version", "VersionTLS12", "minimum TLS version\noptions: ['VersionTLS10', 'VersionTLS11', 'VersionTLS12', 'VersionTLS13']")
	tlsMaxVersionArg    = flag.String("tls-max-version", "", "maximum TLS version\noptions: ['VersionTLS10', 'VersionTLS11', 'VersionTLS12', 'VersionTLS13']\n(default is the highest supported by Go)")
	tlsCipherSuitesArg  = flag.String("tls-cipher-suites", "", "comma-separated list of cipher suites for the server\nvalues are from tls package constants (https://golang.org/pkg/crypto/tls/#pkg-constants)")
	log                 = logrus.WithField("module", "main")
)

func main() {
	flag.Parse()

	port := mergeEnvValueInt("PORT", *portArg, 9443)
	cert := mergeEnvValue("CERT_FILE_PATH", *certArg, "")
	key := mergeEnvValue("PRIVATE_KEY_FILE_PATH", *keyArg, "")
	features := mergeEnvValue("MONITORING_PLUGIN_FEATURES", *featuresArg, "")
	staticPath := mergeEnvValue("MONITORING_PLUGIN_STATIC_PATH", *staticPathArg, "/opt/app-root/web/dist")
	configPath := mergeEnvValue("MONITORING_PLUGIN_MANIFEST_CONFIG_PATH", *configPathArg, "/opt/app-root/config")
	pluginConfigPath := mergeEnvValue("MONITORING_PLUGIN_CONFIG_PATH", *pluginConfigArg, "/etc/plugin/config.yaml")
	logLevel := mergeEnvValue("MONITORING_PLUGIN_LOG_LEVEL", *logLevelArg, logrus.InfoLevel.String())
	alertmanagerUrl := mergeEnvValue("MONITORING_PLUGIN_ALERTMANAGER", *alertmanagerUrlArg, "")
	thanosQuerierUrl := mergeEnvValue("MONITORING_PLUGIN_THANOS_QUERIER", *thanosQuerierUrlArg, "")
	tlsMinVersion := mergeEnvValue("TLS_MIN_VERSION", *tlsMinVersionArg, "VersionTLS12")
	tlsMaxVersion := mergeEnvValue("TLS_MAX_VERSION", *tlsMaxVersionArg, "")
	tlsCipherSuites := mergeEnvValue("TLS_CIPHER_SUITES", *tlsCipherSuitesArg, "")

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

	// Parse the TLS configuration using k8s component-base
	tlsMinVer, err := parseTLSVersion(tlsMinVersion)
	if err != nil {
		log.WithError(err).Fatalf("Invalid TLS min version: %s", tlsMinVersion)
	}
	log.Infof("Min TLS version: %s", tlsMinVersion)

	tlsMaxVer, err := parseTLSVersion(tlsMaxVersion)
	if err != nil {
		log.WithError(err).Fatalf("Invalid TLS max version: %s", tlsMaxVersion)
	}
	if tlsMaxVersion != "" {
		log.Infof("Max TLS version: %s", tlsMaxVersion)
	}

	var tlsCiphers []uint16
	if tlsCipherSuites != "" {
		cipherNames := strings.Split(strings.ReplaceAll(tlsCipherSuites, " ", ""), ",")
		tlsCiphers, err = k8sapiflag.TLSCipherSuites(cipherNames)
		if err != nil {
			log.WithError(err).Fatalf("Invalid TLS cipher suites: %s", tlsCipherSuites)
		}
		log.Infof("TLS ciphers: %s", tlsCipherSuites)
	}

	srv, err := server.CreateServer(context.Background(), &server.Config{
		Port:             port,
		CertFile:         cert,
		PrivateKeyFile:   key,
		Features:         featuresSet,
		StaticPath:       staticPath,
		ConfigPath:       configPath,
		PluginConfigPath: pluginConfigPath,
		AlertmanagerUrl:  alertmanagerUrl,
		ThanosQuerierUrl: thanosQuerierUrl,
		TLSMinVersion:    tlsMinVer,
		TLSMaxVersion:    tlsMaxVer,
		TLSCipherSuites:  tlsCiphers,
	})

	if err != nil {
		panic(err)
	}

	if err = srv.StartHTTPServer(); err != nil {
		panic(err)
	}
}

func mergeEnvValue(key string, arg string, defaultValue string) string {
	if arg != "" {
		return arg
	}

	envValue := os.Getenv(key)

	if envValue != "" {
		return envValue
	}

	return defaultValue
}

func mergeEnvValueInt(key string, arg int, defaultValue int) int {
	if arg != 0 {
		return arg
	}

	envValue := os.Getenv(key)

	num, err := strconv.Atoi(envValue)
	if err != nil && num != 0 {
		return num
	}

	return defaultValue
}

func parseTLSVersion(version string) (uint16, error) {
	if version == "" {
		return 0, nil
	}
	return k8sapiflag.TLSVersion(version)
}
