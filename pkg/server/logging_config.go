package server

import (
	"encoding/json"
	"time"
)

type LoggingConfig struct {
	UseTenantInHeader               bool          `json:"useTenantInHeader,omitempty" yaml:"useTenantInHeader,omitempty"`
	IsStreamingEnabledInDefaultPage bool          `json:"isStreamingEnabledInDefaultPage,omitempty" yaml:"isStreamingEnabledInDefaultPage,omitempty"`
	AlertingRuleTenantLabelKey      string        `json:"alertingRuleTenantLabelKey,omitempty" yaml:"alertingRuleTenantLabelKey,omitempty"`
	AlertingRuleNamespaceLabelKey   string        `json:"alertingRuleNamespaceLabelKey,omitempty" yaml:"alertingRuleNamespaceLabelKey,omitempty"`
	Timeout                         time.Duration `json:"timeout,omitempty" yaml:"timeout,omitempty"`
	LogsLimit                       int           `json:"logsLimit,omitempty" yaml:"logsLimit,omitempty"`
	Schema                          string        `json:"schema,omitempty" yaml:"schema,omitempty"`
	ShowTimezoneSelector            bool          `json:"showTimezoneSelector,omitempty" yaml:"showTimezoneSelector,omitempty"`
}

func (pluginConfig *LoggingConfig) MarshalJSON() ([]byte, error) {
	type Alias LoggingConfig
	return json.Marshal(&struct {
		Timeout float64 `json:"timeout,omitempty"`
		*Alias
	}{
		Timeout: pluginConfig.Timeout.Seconds(),
		Alias:   (*Alias)(pluginConfig),
	})
}
