package k8s

const (
	// Label keys
	RuleManagedByLabel          = "openshift_io_rule_managed_by"
	RelabelConfigManagedByLabel = "openshift_io_relabel_config_managed_by"
	AlertSourceLabel            = "openshift_io_alert_source"
	AlertNameLabel              = "alertname"

	// label values
	ManagedByOperator = "operator"
	ManagedByGitOps   = "gitops"
	SourceUser        = "user"
	SourcePlatform    = "platform"
)

// ARC-related label and annotation keys
const (
	ARCLabelPrometheusRuleNameKey = "monitoring.openshift.io/prometheusrule-name"
	ARCLabelAlertNameKey          = "monitoring.openshift.io/alertname"
	ARCAnnotationAlertRuleIDKey   = "monitoring.openshift.io/alertRuleId"
)
