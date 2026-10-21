package k8s

import "time"

const (
	RuleTypeAlerting  = "alerting"
	RuleTypeRecording = "recording"
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
	Name           string    `json:"name"`
	File           string    `json:"file"`
	Rules          []Rule    `json:"rules"`
	Interval       float64   `json:"interval"`
	Limit          int       `json:"limit"`
	EvaluationTime float64   `json:"evaluationTime"`
	LastEvaluation time.Time `json:"lastEvaluation"`
}

type Rule any

type AlertingRule struct {
	State          string                `json:"state"`
	Name           string                `json:"name"`
	Query          string                `json:"query"`
	Duration       float64               `json:"duration"`
	KeepFiringFor  float64               `json:"keepFiringFor"`
	Labels         map[string]string     `json:"labels"`
	Annotations    map[string]string     `json:"annotations"`
	Alerts         []PrometheusRuleAlert `json:"alerts"`
	Health         string                `json:"health"`
	LastError      string                `json:"lastError,omitempty"`
	EvaluationTime float64               `json:"evaluationTime"`
	LastEvaluation time.Time             `json:"lastEvaluation"`
	Type           string                `json:"type"`
}

type RecordingRule struct {
	Name           string            `json:"name"`
	Query          string            `json:"query"`
	Labels         map[string]string `json:"labels"`
	Health         string            `json:"health"`
	LastError      string            `json:"lastError,omitempty"`
	EvaluationTime float64           `json:"evaluationTime"`
	LastEvaluation time.Time         `json:"lastEvaluation"`
	Type           string            `json:"type"`
}

// PrometheusRuleAlert models an alert entry within a rule from the Prometheus alerting API.
type PrometheusRuleAlert struct {
	Labels          map[string]string `json:"labels"`
	Annotations     map[string]string `json:"annotations"`
	State           string            `json:"state"`
	ActiveAt        *time.Time        `json:"activeAt,omitempty"`
	Value           string            `json:"value"`
	KeepFiringSince *time.Time        `json:"keepFiringSince,omitempty"`
}
