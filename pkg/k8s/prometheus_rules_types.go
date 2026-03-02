package k8s

import (
	"encoding/json"
	"time"
)

// GetRulesRequest holds parameters for filtering rules alerts.
type GetRulesRequest struct {
	// Labels filters rules by exact label equality. The special key "namespace"
	// is used to select the user-workload tenancy namespace and is not treated
	// as a rule label filter.
	Labels map[string]string
	// Matchers filters rules using Prometheus-style label matchers (upstream
	// Prometheus API `match[]` semantics). Each entry may be either a full
	// selector (`{severity="critical"}`) or a selector body (`severity="critical"`).
	Matchers []string
	// State filters alerts by state: "firing", "pending", "silenced", or "" for all states
	State string
}

// PrometheusRuleGroup models a rule group from the Prometheus alerting API.
type PrometheusRuleGroup struct {
	Name     string           `json:"name"`
	File     string           `json:"file,omitempty"`
	Interval json.RawMessage  `json:"interval,omitempty"`
	Rules    []PrometheusRule `json:"rules"`
}

// PrometheusRule models a rule entry from the Prometheus alerting API.
type PrometheusRule struct {
	Name           string                `json:"name,omitempty"`
	Query          string                `json:"query,omitempty"`
	Duration       float64               `json:"duration,omitempty"`
	Labels         map[string]string     `json:"labels,omitempty"`
	Annotations    map[string]string     `json:"annotations,omitempty"`
	Alerts         []PrometheusRuleAlert `json:"alerts,omitempty"`
	Health         string                `json:"health,omitempty"`
	Type           string                `json:"type,omitempty"`
	LastError      string                `json:"lastError,omitempty"`
	EvaluationTime float64               `json:"evaluationTime,omitempty"`
	LastEvaluation time.Time             `json:"lastEvaluation,omitempty"`
}

// PrometheusRuleAlert models an alert entry within a rule from the Prometheus alerting API.
type PrometheusRuleAlert struct {
	Labels          map[string]string `json:"labels"`
	Annotations     map[string]string `json:"annotations,omitempty"`
	State           string            `json:"state"`
	ActiveAt        time.Time         `json:"activeAt"`
	Value           string            `json:"value"`
	KeepFiringSince time.Time         `json:"keepFiringSince,omitempty"`
}
