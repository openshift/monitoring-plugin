package management

// alertRuleClassificationOverridePayload is the ConfigMap entry payload stored under each rule ID key.
// It may include optional metadata fields for readability, but only Classification is used by the backend.
type alertRuleClassificationOverridePayload struct {
	AlertName     string `json:"alertName,omitempty"`
	RuleName      string `json:"prometheusRuleName,omitempty"`
	RuleNamespace string `json:"prometheusRuleNamespace,omitempty"`

	Classification alertRuleClassification `json:"classification"`
}

type alertRuleClassification struct {
	Component     string `json:"openshift_io_alert_rule_component,omitempty"`
	Layer         string `json:"openshift_io_alert_rule_layer,omitempty"`
	ComponentFrom string `json:"openshift_io_alert_rule_component_from,omitempty"`
	LayerFrom     string `json:"openshift_io_alert_rule_layer_from,omitempty"`
}
