package managementlabels

const (
	// Label keys
	RuleManagedByLabel          = "openshift_io_rule_managed_by"
	RelabelConfigManagedByLabel = "openshift_io_relabel_config_managed_by"
	AlertNameLabel              = "alertname"
	AlertingRuleLabelName       = "openshift_io_alerting_rule_name"

	// label values
	ManagedByOperator = "operator"
	ManagedByGitOps   = "gitops"
)

// ARC-related label and annotation keys
const (
	ARCLabelPrometheusRuleNameKey = "monitoring.openshift.io/prometheusrule-name"
	ARCLabelAlertNameKey          = "monitoring.openshift.io/alertname"
	ARCAnnotationAlertRuleIDKey   = "monitoring.openshift.io/alertRuleId"
)
