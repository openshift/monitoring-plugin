package managementrouter

import (
	"fmt"
	"net/url"
	"strings"
)

var validStates = map[string]bool{
	"pending":  true,
	"firing":   true,
	"silenced": true,
}

// parseStateAndLabels returns the optional state filter and label matches.
// Any query param other than "state" is treated as a label match.
// Returns an error if the state value is not one of the known states.
func parseStateAndLabels(q url.Values) (string, map[string]string, error) {
	state := strings.ToLower(strings.TrimSpace(q.Get("state")))
	if state != "" && !validStates[state] {
		return "", nil, fmt.Errorf("invalid state filter %q: must be one of pending, firing, silenced", state)
	}

	labels := make(map[string]string)
	for key, vals := range q {
		if key == "state" {
			continue
		}
		if len(vals) == 0 || strings.TrimSpace(vals[0]) == "" {
			continue
		}
		if len(vals) > 1 {
			return "", nil, fmt.Errorf("multiple values for label filter %q: only a single value is supported", key)
		}
		labels[strings.TrimSpace(key)] = strings.TrimSpace(vals[0])
	}
	return state, labels, nil
}
