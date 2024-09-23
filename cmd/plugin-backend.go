package main

import (
	"flag"
	"os"
	"strconv"
	"strings"

	server "github.com/openshift/monitoring-plugin/pkg"
	"github.com/sirupsen/logrus"
)

var (
	portArg                   = flag.Int("port", 0, "server port to listen on (default: 9443)")
	certArg                   = flag.String("cert", "", "cert file path to enable TLS (disabled by default)")
	keyArg                    = flag.String("key", "", "private key file path to enable TLS (disabled by default)")
	featuresArg               = flag.String("features", "", "enabled features, comma separated")
	staticPathArg             = flag.String("static-path", "", "static files path to serve frontend (default: './web/dist')")
	configPathArg             = flag.String("config-path", "", "config files path (default: './config')")
	pluginConfigArg           = flag.String("plugin-config-path", "", "plugin yaml configuration")
	logLevelArg               = flag.String("log-level", "error", "verbosity of logs\noptions: ['panic', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']\n'trace' level will log all incoming requests\n(default 'error')")
	alertmanagerNameArg       = flag.String("alertmanager-name", "", "alertmanager name for acm mode")
	alertmanagerNamespaceArg  = flag.String("alertmanager-namespace", "", "alertmanager namespace for acm mode")
	thanosQuerierNameArg      = flag.String("thanos-querier-name", "", "thanos querier name for acm mode")
	thanosQuerierNamespaceArg = flag.String("thanos-querier-namespace", "", "thanos querier namespace for acm mode")
	log                       = logrus.WithField("module", "main")
)

func main() {
	flag.Parse()

	port := mergeEnvValueInt("PORT", *portArg, 9443)
	cert := mergeEnvValue("CERT_FILE_PATH", *certArg, "")
	key := mergeEnvValue("PRIVATE_KEY_FILE_PATH", *keyArg, "")
	features := mergeEnvValue("MONITORING_PLUGIN_FEATURES", *featuresArg, "")
	staticPath := mergeEnvValue("MONITORING_PLUGIN_STATIC_PATH", *staticPathArg, "/opt/app-root/web/dist")
	configPath := mergeEnvValue("MONITORING_PLUGIN_MANIFEST_CONFIG_PATH", *configPathArg, "/opt/app-root/web/dist")
	pluginConfigPath := mergeEnvValue("MONITORING_PLUGIN_CONFIG_PATH", *pluginConfigArg, "/etc/plugin/config.yaml")
	logLevel := mergeEnvValue("MONITORING_PLUGIN_LOG_LEVEL", *logLevelArg, "error")
	alertmanagerName := mergeEnvValue("MONITORING_PLUGIN_ALERTMANAGER_NAME", *alertmanagerNameArg, "")
	alertmanagerNamespace := mergeEnvValue("MONITORING_PLUGIN_ALERTMANAGER_NAMESPACE", *alertmanagerNamespaceArg, "")
	thanosQuerierName := mergeEnvValue("MONITORING_PLUGIN_THANOS_QUERIER_NAME", *thanosQuerierNameArg, "")
	thanosQuerierNamespace := mergeEnvValue("MONITORING_PLUGIN_THANOS_QUERIER_NAMESPACE", *thanosQuerierNamespaceArg, "")

	featuresList := strings.Fields(strings.Join(strings.Split(strings.ToLower(features), ","), " "))

	featuresSet := make(map[string]bool)
	for _, s := range featuresList {
		featuresSet[s] = true
	}

	log.Infof("enabled features: %+q\n", featuresList)

	server.Start(&server.Config{
		Port:                   port,
		CertFile:               cert,
		PrivateKeyFile:         key,
		Features:               featuresSet,
		StaticPath:             staticPath,
		ConfigPath:             configPath,
		PluginConfigPath:       pluginConfigPath,
		LogLevel:               logLevel,
		AlertmanagerName:       alertmanagerName,
		AlertmanagerNamespace:  alertmanagerNamespace,
		ThanosQuerierName:      thanosQuerierName,
		ThanosQuerierNamespace: thanosQuerierNamespace,
	})
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
