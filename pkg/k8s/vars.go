package k8s

const (
	ClusterMonitoringNamespace = "openshift-monitoring"

	PlatformRouteNamespace            = "openshift-monitoring"
	PlatformRouteName                 = "prometheus-k8s"
	PlatformAlertmanagerRouteName     = "alertmanager-main"
	UserWorkloadRouteNamespace        = "openshift-user-workload-monitoring"
	UserWorkloadRouteName             = "prometheus-user-workload"
	UserWorkloadAlertmanagerRouteName = "alertmanager-user-workload"
	PrometheusAlertsPath              = "/v1/alerts"
	PrometheusRulesPath               = "/v1/rules"
	AlertmanagerAlertsPath            = "/api/v2/alerts"
	UserWorkloadAlertmanagerPort      = 9095
	UserWorkloadPrometheusServiceName = "prometheus-user-workload-web"
	UserWorkloadPrometheusPort        = 9090

	ThanosQuerierNamespace               = "openshift-monitoring"
	ThanosQuerierServiceName             = "thanos-querier"
	ThanosQuerierTenancyRulesPortName    = "tenancy-rules"
	DefaultThanosQuerierTenancyRulesPort = 9093
	ThanosQuerierTenancyAlertsPath       = "/api/v1/alerts"
	ThanosQuerierTenancyRulesPath        = "/api/v1/rules"
	ServiceCAPath                        = "/var/run/secrets/kubernetes.io/serviceaccount/service-ca.crt"

	AlertSourceLabel    = "openshift_io_alert_source"
	AlertSourcePlatform = "platform"
	AlertSourceUser     = "user"
	AlertBackendLabel   = "openshift_io_alert_backend"
	AlertBackendAM      = "alertmanager"
	AlertBackendProm    = "prometheus"
	AlertBackendThanos  = "thanos"
)
