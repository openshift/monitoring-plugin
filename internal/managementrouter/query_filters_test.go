package managementrouter

import (
	"net/url"
	"testing"
)

func TestParseStateLabelsAndMatchers(t *testing.T) {
	tests := []struct {
		name         string
		query        string
		wantState    string
		wantLabels   map[string]string
		wantMatchers []string
		wantErr      string
	}{
		{
			name:         "empty query",
			query:        "",
			wantState:    "",
			wantLabels:   map[string]string{},
			wantMatchers: nil,
		},
		{
			name:       "state only",
			query:      "state=firing",
			wantState:  "firing",
			wantLabels: map[string]string{},
		},
		{
			name:      "flat labels only",
			query:     "severity=critical&namespace=openshift-monitoring",
			wantState: "",
			wantLabels: map[string]string{
				"severity":  "critical",
				"namespace": "openshift-monitoring",
			},
		},
		{
			name:       "match[] only with equality",
			query:      `match[]=severity="critical"`,
			wantState:  "",
			wantLabels: map[string]string{},
			wantMatchers: []string{
				`severity="critical"`,
			},
		},
		{
			name:       "match[] with regex",
			query:      `match[]=alertname=~"Kube.*CPU.*"`,
			wantState:  "",
			wantLabels: map[string]string{},
			wantMatchers: []string{
				`alertname=~"Kube.*CPU.*"`,
			},
		},
		{
			name:       "multiple match[] values",
			query:      `match[]=severity="critical"&match[]=namespace="openshift-monitoring"`,
			wantState:  "",
			wantLabels: map[string]string{},
			wantMatchers: []string{
				`severity="critical"`,
				`namespace="openshift-monitoring"`,
			},
		},
		{
			name:      "mixed flat labels and match[]",
			query:     `state=firing&team=sre&match[]=severity=~"critical|warning"`,
			wantState: "firing",
			wantLabels: map[string]string{
				"team": "sre",
			},
			wantMatchers: []string{
				`severity=~"critical|warning"`,
			},
		},
		{
			name:       "match[] is not treated as a label",
			query:      `match[]=severity="critical"`,
			wantState:  "",
			wantLabels: map[string]string{},
			wantMatchers: []string{
				`severity="critical"`,
			},
		},
		{
			name:    "invalid state",
			query:   "state=invalid",
			wantErr: `invalid state filter "invalid": must be one of pending, firing, silenced`,
		},
		{
			name:    "repeated state values are rejected",
			query:   "state=&state=firing",
			wantErr: "multiple values for state filter: only a single value is supported",
		},
		{
			name:       "empty match[] values are skipped",
			query:      `match[]=&match[]=%20&match[]=severity="warning"`,
			wantState:  "",
			wantLabels: map[string]string{},
			wantMatchers: []string{
				`severity="warning"`,
			},
		},
		{
			name:    "repeated label values are rejected",
			query:   "severity=critical&severity=warning",
			wantErr: `multiple values for label filter "severity": only a single value is supported`,
		},
		{
			name:    "repeated label with leading empty value is rejected",
			query:   "namespace=&namespace=ns1",
			wantErr: `multiple values for label filter "namespace": only a single value is supported`,
		},
		{
			name:    "repeated label after key trim is rejected",
			query:   "severity=critical&%20severity%20=warning",
			wantErr: `multiple values for label filter "severity": only a single value is supported`,
		},
		{
			name:    "invalid match[] is rejected",
			query:   `match[]=severity=`,
			wantErr: `invalid matcher "severity=": 1:11: parse error: unexpected "}" in label matching, expected string`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q, err := url.ParseQuery(tt.query)
			if err != nil {
				t.Fatalf("invalid test query: %v", err)
			}

			state, labels, matchers, err := parseStateLabelsAndMatchers(q)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if err.Error() != tt.wantErr {
					t.Fatalf("error = %q, want %q", err.Error(), tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if state != tt.wantState {
				t.Errorf("state = %q, want %q", state, tt.wantState)
			}

			if tt.wantLabels != nil {
				if len(labels) != len(tt.wantLabels) {
					t.Errorf("labels length = %d, want %d", len(labels), len(tt.wantLabels))
				}
				for k, v := range tt.wantLabels {
					if labels[k] != v {
						t.Errorf("labels[%q] = %q, want %q", k, labels[k], v)
					}
				}
				if _, found := labels["match[]"]; found {
					t.Error("match[] should not appear in labels map")
				}
			}

			if tt.wantMatchers != nil {
				if len(matchers) != len(tt.wantMatchers) {
					t.Errorf("matchers length = %d, want %d", len(matchers), len(tt.wantMatchers))
				}
				for i, want := range tt.wantMatchers {
					if i < len(matchers) && matchers[i] != want {
						t.Errorf("matchers[%d] = %q, want %q", i, matchers[i], want)
					}
				}
			}
		})
	}
}
