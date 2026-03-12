package managementrouter

import (
	"net/url"
	"testing"
)

func TestParseStateLabelsAndMatchers(t *testing.T) {
	tests := []struct {
		name            string
		query           string
		wantState       string
		wantLabels      map[string]string
		wantMatchers    []string
		wantMatchersLen int
		wantErr         bool
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
			name:            "multiple match[] values",
			query:           `match[]=severity="critical"&match[]=namespace="openshift-monitoring"`,
			wantState:       "",
			wantLabels:      map[string]string{},
			wantMatchersLen: 2,
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
		},
		{
			name:    "invalid state",
			query:   "state=invalid",
			wantErr: true,
		},
		{
			name:            "empty match[] values are skipped",
			query:           `match[]=&match[]=%20&match[]=severity="warning"`,
			wantState:       "",
			wantLabels:      map[string]string{},
			wantMatchersLen: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q, err := url.ParseQuery(tt.query)
			if err != nil {
				t.Fatalf("invalid test query: %v", err)
			}

			state, labels, matchers, err := parseStateLabelsAndMatchers(q)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
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

			if tt.wantMatchersLen > 0 && len(matchers) != tt.wantMatchersLen {
				t.Errorf("matchers length = %d, want %d", len(matchers), tt.wantMatchersLen)
			}
		})
	}
}

func TestParseStateAndLabelsBackcompat(t *testing.T) {
	q, _ := url.ParseQuery(`state=firing&severity=critical&match[]=alertname=~"Foo.*"`)

	state, labels, err := parseStateAndLabels(q)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if state != "firing" {
		t.Errorf("state = %q, want %q", state, "firing")
	}
	if labels["severity"] != "critical" {
		t.Errorf("severity = %q, want %q", labels["severity"], "critical")
	}
	if _, found := labels["match[]"]; found {
		t.Error("match[] should not appear in labels map")
	}
}
