package managementlabels

const (
	// RuleManagedByLabel indicates which system manages the alert rule lifecycle.
	RuleManagedByLabel = "openshift_io_rule_managed_by"
	// RelabelConfigManagedByLabel indicates which system manages the relabel config lifecycle.
	RelabelConfigManagedByLabel = "openshift_io_relabel_config_managed_by"
	// AlertNameLabel is the standard Prometheus label for an alert's name.
	AlertNameLabel = "alertname"
	// AlertingRuleLabelName stores the name of the AlertingRule resource that owns the rule.
	AlertingRuleLabelName = "openshift_io_alerting_rule_name"

	// ManagedByOperator indicates the resource is managed by a Kubernetes operator.
	ManagedByOperator = "operator"
	// ManagedByGitOps indicates the resource is managed via GitOps (e.g. ArgoCD, Flux).
	ManagedByGitOps = "gitops"
)

// ARC-related label and annotation keys link AlertRelabelConfigs back to their
// source PrometheusRule and alert, enabling lifecycle management.
const (
	// ARCLabelPrometheusRuleNameKey stores the name of the source PrometheusRule.
	ARCLabelPrometheusRuleNameKey = "monitoring.openshift.io/prometheusrule-name"
	// ARCLabelAlertNameKey stores the alert name this relabel config applies to.
	ARCLabelAlertNameKey = "monitoring.openshift.io/alertname"
	// ARCAnnotationAlertRuleIDKey stores the computed alert rule ID for cross-referencing.
	ARCAnnotationAlertRuleIDKey = "monitoring.openshift.io/alertRuleId"
)
