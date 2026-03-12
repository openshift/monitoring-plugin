package managementrouter

import (
	"fmt"
	"net/url"
	"strings"
)

var validStates = map[string]bool{
	"":         true,
	"pending":  true,
	"firing":   true,
	"silenced": true,
}

// reservedQueryKeys lists query parameter names that have special meaning
// and must not be treated as label equality filters.
var reservedQueryKeys = map[string]bool{
	"state":      true,
	"match[]":    true,
	"limit":      true,
	"next_token": true,
}

// parseStateLabelsAndMatchers returns the optional state filter, label equality
// matches, and Prometheus-style label matchers from the query string.
//
// Reserved keys ("state", "match[]") are handled specially. Every other key is
// treated as a label equality filter (e.g. ?severity=critical).
//
// match[] values follow upstream Prometheus API conventions and may contain
// equality, inequality, regex, or negative-regex matchers:
//
//	?match[]=severity="critical"&match[]=alertname=~"Kube.*"
func parseStateLabelsAndMatchers(q url.Values) (string, map[string]string, []string, error) {
	state := strings.ToLower(strings.TrimSpace(q.Get("state")))
	if !validStates[state] {
		return "", nil, nil, fmt.Errorf("invalid state filter %q: must be one of pending, firing, silenced", q.Get("state"))
	}

	labels := make(map[string]string)
	for key, vals := range q {
		if reservedQueryKeys[key] {
			continue
		}
		if len(vals) > 0 && strings.TrimSpace(vals[0]) != "" {
			labels[strings.TrimSpace(key)] = strings.TrimSpace(vals[0])
		}
	}

	var matchers []string
	for _, raw := range q["match[]"] {
		v := strings.TrimSpace(raw)
		if v != "" {
			matchers = append(matchers, v)
		}
	}

	return state, labels, matchers, nil
}

// parseStateAndLabels returns the optional state filter and label matches.
// Any query param other than reserved keys is treated as a label match.
func parseStateAndLabels(q url.Values) (string, map[string]string, error) {
	state, labels, _, err := parseStateLabelsAndMatchers(q)
	return state, labels, err
}
