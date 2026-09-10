package k8s

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

// --- parseAlertmanagerResponse ---

func TestParseAlertmanagerResponse_ValidAlerts(t *testing.T) {
	raw, _ := json.Marshal([]alertmanagerAlert{
		{
			Labels:      map[string]string{"alertname": "TestAlert", "severity": "critical"},
			Annotations: map[string]string{"summary": "test"},
			StartsAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
			Status:      alertmanagerAlertStatus{State: "active"},
		},
		{
			Labels: map[string]string{"alertname": "SilencedAlert"},
			Status: alertmanagerAlertStatus{State: "suppressed"},
		},
	})

	alerts, err := parseAlertmanagerResponse(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 2 {
		t.Fatalf("expected 2 alerts, got %d", len(alerts))
	}
	if alerts[0].State != "firing" {
		t.Errorf("expected state=firing for active alert, got %q", alerts[0].State)
	}
	if alerts[0].Labels["alertname"] != "TestAlert" {
		t.Errorf("expected alertname=TestAlert, got %q", alerts[0].Labels["alertname"])
	}
	if alerts[1].State != "silenced" {
		t.Errorf("expected state=silenced for suppressed alert, got %q", alerts[1].State)
	}
}

func TestParseAlertmanagerResponse_UnknownStateSkipped(t *testing.T) {
	raw, _ := json.Marshal([]alertmanagerAlert{
		{
			Labels: map[string]string{"alertname": "UnknownState"},
			Status: alertmanagerAlertStatus{State: "unprocessed"},
		},
	})

	alerts, err := parseAlertmanagerResponse(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 0 {
		t.Fatalf("expected 0 alerts for unknown state, got %d", len(alerts))
	}
}

func TestParseAlertmanagerResponse_InvalidJSON(t *testing.T) {
	_, err := parseAlertmanagerResponse([]byte("not json"))
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestParseAlertmanagerResponse_EmptyArray(t *testing.T) {
	alerts, err := parseAlertmanagerResponse([]byte("[]"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 0 {
		t.Fatalf("expected 0 alerts, got %d", len(alerts))
	}
}

// --- mapAlertmanagerState ---

func TestMapAlertmanagerState(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"active", "firing"},
		{"suppressed", "silenced"},
		{"unprocessed", ""},
		{"", ""},
		{"unknown", ""},
	}
	for _, tc := range cases {
		got := mapAlertmanagerState(tc.input)
		if got != tc.want {
			t.Errorf("mapAlertmanagerState(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

// --- filterAlertsByState ---

func TestFilterAlertsByState(t *testing.T) {
	alerts := []PrometheusAlert{
		{Labels: map[string]string{"alertname": "A"}, State: "firing"},
		{Labels: map[string]string{"alertname": "B"}, State: "pending"},
		{Labels: map[string]string{"alertname": "C"}, State: "firing"},
		{Labels: map[string]string{"alertname": "D"}, State: "silenced"},
	}

	firing := filterAlertsByState(alerts, "firing")
	if len(firing) != 2 {
		t.Fatalf("expected 2 firing alerts, got %d", len(firing))
	}

	pending := filterAlertsByState(alerts, "pending")
	if len(pending) != 1 {
		t.Fatalf("expected 1 pending alert, got %d", len(pending))
	}
	if pending[0].Labels["alertname"] != "B" {
		t.Errorf("expected pending alert B, got %q", pending[0].Labels["alertname"])
	}

	none := filterAlertsByState(alerts, "resolved")
	if len(none) != 0 {
		t.Fatalf("expected 0 resolved alerts, got %d", len(none))
	}
}

// --- buildRouteURL ---

func TestBuildRouteURL(t *testing.T) {
	cases := []struct {
		name        string
		host        string
		routePath   string
		requestPath string
		want        string
	}{
		{
			name:        "no route path",
			host:        "prometheus.example.com",
			routePath:   "",
			requestPath: "/api/v1/alerts",
			want:        "https://prometheus.example.com/api/v1/alerts",
		},
		{
			name:        "route path with trailing slash",
			host:        "prometheus.example.com",
			routePath:   "/prom/",
			requestPath: "/api/v1/alerts",
			want:        "https://prometheus.example.com/prom/api/v1/alerts",
		},
		{
			name:        "request path already prefixed",
			host:        "prometheus.example.com",
			routePath:   "/api",
			requestPath: "/api/v1/alerts",
			want:        "https://prometheus.example.com/api/v1/alerts",
		},
		{
			name:        "route path equals request path",
			host:        "prometheus.example.com",
			routePath:   "/api/v1/alerts",
			requestPath: "/api/v1/alerts",
			want:        "https://prometheus.example.com/api/v1/alerts",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := buildRouteURL(tc.host, tc.routePath, tc.requestPath)
			if got != tc.want {
				t.Errorf("buildRouteURL(%q, %q, %q) = %q, want %q", tc.host, tc.routePath, tc.requestPath, got, tc.want)
			}
		})
	}
}

// --- namespaceFromLabels ---

func TestNamespaceFromLabels(t *testing.T) {
	cases := []struct {
		name   string
		labels map[string]string
		want   string
	}{
		{"nil labels", nil, ""},
		{"missing namespace", map[string]string{"other": "val"}, ""},
		{"present namespace", map[string]string{"namespace": "test-ns"}, "test-ns"},
		{"whitespace-only namespace", map[string]string{"namespace": "  "}, ""},
		{"padded namespace", map[string]string{"namespace": " ns-a "}, "ns-a"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := namespaceFromLabels(tc.labels)
			if got != tc.want {
				t.Errorf("namespaceFromLabels(%v) = %q, want %q", tc.labels, got, tc.want)
			}
		})
	}
}

// --- applyAlertMetadata ---

func TestApplyAlertMetadata(t *testing.T) {
	alerts := []PrometheusAlert{
		{Labels: map[string]string{"alertname": "A"}},
		{Labels: nil},
	}

	applyAlertMetadata(alerts, AlertSourcePlatform, AlertBackendAM)

	for i, a := range alerts {
		if a.Labels[AlertSourceLabel] != AlertSourcePlatform {
			t.Errorf("alert[%d] source = %q, want %q", i, a.Labels[AlertSourceLabel], AlertSourcePlatform)
		}
		if a.Labels[AlertBackendLabel] != AlertBackendAM {
			t.Errorf("alert[%d] backend = %q, want %q", i, a.Labels[AlertBackendLabel], AlertBackendAM)
		}
	}
}

func TestApplyAlertMetadata_NilLabelsInitialized(t *testing.T) {
	alerts := []PrometheusAlert{{Labels: nil}}
	applyAlertMetadata(alerts, "src", "be")
	if alerts[0].Labels == nil {
		t.Fatal("expected labels to be initialized, got nil")
	}
}

// --- shouldPreferUserAlertmanager ---

func TestShouldPreferUserAlertmanager(t *testing.T) {
	cases := []struct {
		state string
		want  bool
	}{
		{"firing", true},
		{"silenced", true},
		{"pending", false},
		{"", false},
	}
	for _, tc := range cases {
		got := shouldPreferUserAlertmanager(tc.state)
		if got != tc.want {
			t.Errorf("shouldPreferUserAlertmanager(%q) = %v, want %v", tc.state, got, tc.want)
		}
	}
}

// --- matchesAlertState ---

func TestMatchesAlertState(t *testing.T) {
	cases := []struct {
		requested string
		alert     string
		want      bool
	}{
		{"", "firing", true},
		{"", "pending", true},
		{"", "silenced", true},
		{"firing", "firing", true},
		{"firing", "silenced", true},
		{"firing", "pending", false},
		{"pending", "pending", true},
		{"pending", "firing", false},
		{"silenced", "silenced", true},
		{"silenced", "firing", false},
	}
	for _, tc := range cases {
		got := matchesAlertState(tc.requested, tc.alert)
		if got != tc.want {
			t.Errorf("matchesAlertState(%q, %q) = %v, want %v", tc.requested, tc.alert, got, tc.want)
		}
	}
}

// --- labelsMatch ---

func TestLabelsMatch(t *testing.T) {
	cases := []struct {
		name  string
		req   map[string]string
		alert map[string]string
		want  bool
	}{
		{
			name:  "empty request matches everything",
			req:   nil,
			alert: map[string]string{"severity": "critical"},
			want:  true,
		},
		{
			name:  "exact match",
			req:   map[string]string{"severity": "critical"},
			alert: map[string]string{"severity": "critical", "alertname": "X"},
			want:  true,
		},
		{
			name:  "value mismatch",
			req:   map[string]string{"severity": "warning"},
			alert: map[string]string{"severity": "critical"},
			want:  false,
		},
		{
			name:  "label absent on alert",
			req:   map[string]string{"team": "infra"},
			alert: map[string]string{"severity": "critical"},
			want:  false,
		},
		{
			name:  "multiple labels all match",
			req:   map[string]string{"severity": "critical", "namespace": "ns-a"},
			alert: map[string]string{"severity": "critical", "namespace": "ns-a", "extra": "val"},
			want:  true,
		},
		{
			name:  "multiple labels partial mismatch",
			req:   map[string]string{"severity": "critical", "namespace": "ns-b"},
			alert: map[string]string{"severity": "critical", "namespace": "ns-a"},
			want:  false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := &GetAlertsRequest{Labels: tc.req}
			alert := &PrometheusAlert{Labels: tc.alert}
			got := labelsMatch(req, alert)
			if got != tc.want {
				t.Errorf("labelsMatch(%v, %v) = %v, want %v", tc.req, tc.alert, got, tc.want)
			}
		})
	}
}

// --- parsePrometheusRulesResponse ---

func TestParsePrometheusRulesResponse_Success(t *testing.T) {
	raw, err := json.Marshal(prometheusRulesResponse{
		Status: "success",
		Data: prometheusRulesData{
			Groups: []PrometheusRuleGroup{
				{
					Name: "group-a",
					Rules: []PrometheusRule{
						{Name: "AlertA", Type: RuleTypeAlerting, Labels: map[string]string{"severity": "critical"}},
					},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}

	groups, err := parsePrometheusRulesResponse(raw, "prometheus")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if groups[0].Name != "group-a" {
		t.Errorf("expected group name group-a, got %q", groups[0].Name)
	}
	if len(groups[0].Rules) != 1 || groups[0].Rules[0].Name != "AlertA" {
		t.Errorf("expected rule AlertA, got %+v", groups[0].Rules)
	}
}

func TestParsePrometheusRulesResponse_InvalidJSON(t *testing.T) {
	_, err := parsePrometheusRulesResponse([]byte("not json"), "prometheus")
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestParsePrometheusRulesResponse_NonSuccessStatus(t *testing.T) {
	raw, err := json.Marshal(prometheusRulesResponse{Status: "error"})
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	_, err = parsePrometheusRulesResponse(raw, "thanos")
	if err == nil {
		t.Fatal("expected error for non-success status")
	}
}

// --- applyRuleSource ---

func TestApplyRuleSource(t *testing.T) {
	groups := []PrometheusRuleGroup{
		{
			Name: "g",
			Rules: []PrometheusRule{
				{
					Name:   "A",
					Labels: nil,
					Alerts: []PrometheusRuleAlert{{Labels: nil}, {Labels: map[string]string{"alertname": "A"}}},
				},
			},
		},
	}
	applyRuleSource(groups, AlertSourcePlatform)
	rule := groups[0].Rules[0]
	if rule.Labels[AlertSourceLabel] != AlertSourcePlatform {
		t.Errorf("rule source = %q, want %q", rule.Labels[AlertSourceLabel], AlertSourcePlatform)
	}
	if rule.Alerts[0].Labels[AlertSourceLabel] != AlertSourcePlatform {
		t.Errorf("alert[0] source = %q, want %q", rule.Alerts[0].Labels[AlertSourceLabel], AlertSourcePlatform)
	}
	if rule.Alerts[1].Labels[AlertSourceLabel] != AlertSourcePlatform {
		t.Errorf("alert[1] source = %q, want %q", rule.Alerts[1].Labels[AlertSourceLabel], AlertSourcePlatform)
	}
	if rule.Alerts[1].Labels["alertname"] != "A" {
		t.Errorf("alert[1] alertname = %q, want %q", rule.Alerts[1].Labels["alertname"], "A")
	}
}

// --- mergeRuleFetchResults ---

func TestMergeRuleFetchResults(t *testing.T) {
	platform := []PrometheusRuleGroup{{Name: "platform"}}
	user := []PrometheusRuleGroup{{Name: "user"}}
	platErr := errors.New("platform down")
	userErr := errors.New("user down")

	t.Run("both succeed", func(t *testing.T) {
		groups, warnings, err := mergeRuleFetchResults(platform, nil, user, nil, false)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(groups) != 2 {
			t.Fatalf("expected 2 groups, got %d", len(groups))
		}
		if len(warnings) != 0 {
			t.Errorf("expected no warnings, got %v", warnings)
		}
	})

	t.Run("cluster-wide platform error is fatal", func(t *testing.T) {
		_, _, err := mergeRuleFetchResults(nil, platErr, user, nil, false)
		if err == nil {
			t.Fatal("expected platform error")
		}
		if !errors.Is(err, platErr) {
			t.Errorf("expected platform error, got %v", err)
		}
	})

	t.Run("namespace-scoped platform error is a warning", func(t *testing.T) {
		groups, warnings, err := mergeRuleFetchResults(nil, platErr, user, nil, true)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(groups) != 1 || groups[0].Name != "user" {
			t.Fatalf("expected user group, got %+v", groups)
		}
		if len(warnings) != 1 {
			t.Fatalf("expected 1 warning, got %v", warnings)
		}
		if warnings[0] != "failed to get platform rules: platform down" {
			t.Errorf("unexpected warning %q", warnings[0])
		}
	})

	t.Run("user error is a warning", func(t *testing.T) {
		groups, warnings, err := mergeRuleFetchResults(platform, nil, nil, userErr, false)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(groups) != 1 || groups[0].Name != "platform" {
			t.Fatalf("expected platform group, got %+v", groups)
		}
		if len(warnings) != 1 {
			t.Fatalf("expected 1 warning, got %v", warnings)
		}
		if warnings[0] != "failed to get user workload rules: user down" {
			t.Errorf("unexpected warning %q", warnings[0])
		}
	})

	t.Run("both errors are fatal", func(t *testing.T) {
		_, _, err := mergeRuleFetchResults(nil, platErr, nil, userErr, true)
		if err == nil {
			t.Fatal("expected combined error")
		}
		if !errors.Is(err, platErr) {
			t.Errorf("expected platform error, got %v", err)
		}
		if !errors.Is(err, userErr) {
			t.Errorf("expected user error, got %v", err)
		}
	})
}
