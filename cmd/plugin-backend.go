package main

import (
	"context"
	"crypto/tls"
	"flag"
	"os"
	"strconv"
	"strings"

	server "github.com/openshift/monitoring-plugin/pkg"
	"github.com/sirupsen/logrus"
)

var (
	portArg             = flag.Int("port", 0, "server port to listen on (default: 9443)\nports 9444 and 9445 reserved for other use")
	certArg             = flag.String("cert", "", "cert file path to enable TLS (disabled by default)")
	keyArg              = flag.String("key", "", "private key file path to enable TLS (disabled by default)")
	featuresArg         = flag.String("features", "", "enabled features, comma separated.\noptions: ['acm-alerting', 'incidents', 'dev-config', 'perses-dashboards']")
	staticPathArg       = flag.String("static-path", "", "static files path to serve frontend (default: './web/dist')")
	configPathArg       = flag.String("config-path", "", "config files path (default: './config')")
	pluginConfigArg     = flag.String("plugin-config-path", "", "plugin yaml configuration")
	logLevelArg         = flag.String("log-level", logrus.InfoLevel.String(), "verbosity of logs\noptions: ['panic', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']\n'trace' level will log all incoming requests\n(default 'error')")
	alertmanagerUrlArg  = flag.String("alertmanager", "", "alertmanager url to proxy to for acm mode")
	thanosQuerierUrlArg = flag.String("thanos-querier", "", "thanos querier url to proxy to for acm mode")
	tlsMinVersionArg    = flag.String("tls-min-version", "", "minimum TLS version\noptions: ['VersionTLS10', 'VersionTLS11', 'VersionTLS12', 'VersionTLS13']\n(default 'VersionTLS12')")
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
	tlsMinVersion := mergeEnvValue("TLS_MIN_VERSION", *tlsMinVersionArg, "")
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

	// Parse TLS configuration
	tlsMinVer := parseTLSVersion(tlsMinVersion)
	tlsMaxVer := parseTLSVersion(tlsMaxVersion)
	tlsCiphers := parseCipherSuites(tlsCipherSuites)

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

func getCipherSuitesMap() map[string]uint16 {
	result := make(map[string]uint16)

	for _, suite := range tls.CipherSuites() {
		result[suite.Name] = suite.ID
	}

	return result
}

func getTLSVersionsMap() map[string]uint16 {
	versions := make(map[string]uint16)

	versions["VersionTLS12"] = tls.VersionTLS12
	versions["VersionTLS13"] = tls.VersionTLS13

	return versions
}

func parseTLSVersion(version string) uint16 {
	if version == "" {
		return tls.VersionTLS12
	}

	tlsVersions := getTLSVersionsMap()

	if v, ok := tlsVersions[version]; ok {
		return v
	}

	log.Warnf("Invalid TLS version %q, using default VersionTLS12", version)
	return tls.VersionTLS12
}

func parseCipherSuites(ciphers string) []uint16 {
	if ciphers == "" {
		return nil
	}

	cipherMap := getCipherSuitesMap()

	cipherNames := strings.Split(strings.ReplaceAll(ciphers, " ", ""), ",")
	var result []uint16

	for _, name := range cipherNames {
		if name == "" {
			continue
		}
		if cipher, ok := cipherMap[name]; ok {
			result = append(result, cipher)
		} else {
			log.Warnf("Unknown cipher suite %q, skipping", name)
		}
	}

	if len(result) == 0 {
		log.Warn("No valid cipher suites provided, using Go defaults")
		return nil
	}

	return result
}
