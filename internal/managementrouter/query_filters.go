package managementrouter

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

var validStates = map[string]bool{
	"pending":  true,
	"firing":   true,
	"silenced": true,
}

// reservedQueryKeys lists query parameter names that have special meaning
// and must not be treated as label equality filters.
var reservedQueryKeys = map[string]bool{
	"state":   true,
	"match[]": true,
}

// parseStateLabelsAndMatchers returns the optional state filter, label equality
// matches, and Prometheus-style label matchers from the query string.
//
// An empty state is allowed and means "all states". Repeated state values
// are rejected. Reserved keys ("state", "match[]") are handled specially.
// Every other key is treated as a label equality filter
// (e.g. ?severity=critical). Repeated values for a label key are rejected.
//
// match[] values follow upstream Prometheus API conventions and may contain
// equality, inequality, regex, or negative-regex matchers:
//
//	?match[]=severity="critical"&match[]=alertname=~"Kube.*"
func parseStateLabelsAndMatchers(q url.Values) (string, map[string]string, []string, error) {
	if len(q["state"]) > 1 {
		return "", nil, nil, fmt.Errorf("multiple values for state filter: only a single value is supported")
	}
	state := strings.ToLower(strings.TrimSpace(q.Get("state")))
	if state != "" && !validStates[state] {
		return "", nil, nil, fmt.Errorf("invalid state filter %q: must be one of pending, firing, silenced", state)
	}

	labels := make(map[string]string)
	for key, vals := range q {
		if reservedQueryKeys[key] {
			continue
		}
		if len(vals) > 1 {
			return "", nil, nil, fmt.Errorf("multiple values for label filter %q: only a single value is supported", key)
		}
		if len(vals) == 0 || strings.TrimSpace(vals[0]) == "" {
			continue
		}
		labels[strings.TrimSpace(key)] = strings.TrimSpace(vals[0])
	}

	var matchers []string
	for _, raw := range q["match[]"] {
		v := strings.TrimSpace(raw)
		if v != "" {
			matchers = append(matchers, v)
		}
	}
	if err := k8s.ParseRuleMatchers(matchers); err != nil {
		return "", nil, nil, err
	}

	return state, labels, matchers, nil
}

// parseStateAndLabels returns the optional state filter and label matches.
// Any query param other than reserved keys is treated as a label match.
func parseStateAndLabels(q url.Values) (string, map[string]string, error) {
	state, labels, _, err := parseStateLabelsAndMatchers(q)
	return state, labels, err
}
