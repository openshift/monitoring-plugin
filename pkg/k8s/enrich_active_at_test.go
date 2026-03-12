package k8s

import (
	"context"
	"encoding/json"
	"encoding/pem"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	routev1 "github.com/openshift/api/route/v1"
	routefake "github.com/openshift/client-go/route/clientset/versioned/fake"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
)

func TestEnrichActiveAt_ReplacesAlertmanagerTimestamp(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)
	promTime := time.Date(2026, 3, 9, 8, 0, 0, 0, time.UTC)

	amAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU", "severity": "critical", AlertSourceLabel: "platform", AlertBackendLabel: "am"},
		ActiveAt: amTime,
	}}
	promAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU", "severity": "critical", AlertSourceLabel: "platform", AlertBackendLabel: "prom"},
		ActiveAt: promTime,
	}}

	enrichActiveAt(amAlerts, promAlerts, nil)

	if !amAlerts[0].ActiveAt.Equal(promTime) {
		t.Errorf("expected ActiveAt=%v, got %v", promTime, amAlerts[0].ActiveAt)
	}
}

func TestEnrichActiveAt_NoMatchKeepsOriginal(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)

	amAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU", "severity": "critical"},
		ActiveAt: amTime,
	}}
	promAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "DiskFull", "severity": "warning"},
		ActiveAt: time.Date(2026, 3, 9, 8, 0, 0, 0, time.UTC),
	}}

	enrichActiveAt(amAlerts, promAlerts, nil)

	if !amAlerts[0].ActiveAt.Equal(amTime) {
		t.Errorf("expected ActiveAt to stay %v, got %v", amTime, amAlerts[0].ActiveAt)
	}
}

func TestEnrichActiveAt_EmptyPromAlerts(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)

	amAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU"},
		ActiveAt: amTime,
	}}

	enrichActiveAt(amAlerts, nil, nil)

	if !amAlerts[0].ActiveAt.Equal(amTime) {
		t.Errorf("expected ActiveAt to stay %v, got %v", amTime, amAlerts[0].ActiveAt)
	}
}

func TestEnrichActiveAt_SkipsZeroPromActiveAt(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)

	amAlerts := []PrometheusAlert{{
		Labels:   map[string]string{"alertname": "HighCPU"},
		ActiveAt: amTime,
	}}
	promAlerts := []PrometheusAlert{{
		Labels: map[string]string{"alertname": "HighCPU"},
	}}

	enrichActiveAt(amAlerts, promAlerts, nil)

	if !amAlerts[0].ActiveAt.Equal(amTime) {
		t.Errorf("expected ActiveAt to stay %v when prom has zero time, got %v", amTime, amAlerts[0].ActiveAt)
	}
}

func TestAlertFingerprint_IgnoresMetadataLabels(t *testing.T) {
	fp1 := alertFingerprint(map[string]string{
		"alertname":       "HighCPU",
		"severity":        "critical",
		AlertSourceLabel:  "platform",
		AlertBackendLabel: "am",
	})
	fp2 := alertFingerprint(map[string]string{
		"alertname":       "HighCPU",
		"severity":        "critical",
		AlertSourceLabel:  "platform",
		AlertBackendLabel: "prom",
	})

	if fp1 != fp2 {
		t.Errorf("fingerprints should match when only metadata labels differ:\n  fp1=%q\n  fp2=%q", fp1, fp2)
	}
}

func TestAlertFingerprint_DifferentLabelsProduceDifferentKeys(t *testing.T) {
	fp1 := alertFingerprint(map[string]string{"alertname": "HighCPU", "severity": "critical"})
	fp2 := alertFingerprint(map[string]string{"alertname": "HighCPU", "severity": "warning"})

	if fp1 == fp2 {
		t.Error("fingerprints should differ when label values differ")
	}
}

func TestEnrichActiveAt_DeliveryLabels(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)
	promTime := amTime.Add(-time.Hour)
	for _, tc := range []struct {
		name       string
		config     string
		promLabels map[string]string
		amLabels   map[string]string
		wantMatch  bool
	}{
		{
			name: "external labels and replica removal",
			config: `global:
  external_labels: {cluster: cluster-a, prometheus_replica: prometheus-0}
alerting:
  alert_relabel_configs:
  - action: labeldrop
    regex: prometheus_replica
`,
			promLabels: map[string]string{"alertname": "HighCPU", "instance": "node-a"},
			amLabels:   map[string]string{"alertname": "HighCPU", "instance": "node-a", "cluster": "cluster-a"},
			wantMatch:  true,
		},
		{
			name:       "alert labels override external labels",
			config:     "global:\n  external_labels: {cluster: external-cluster}\n",
			promLabels: map[string]string{"alertname": "HighCPU", "cluster": "alert-cluster"},
			amLabels:   map[string]string{"alertname": "HighCPU", "cluster": "alert-cluster"},
			wantMatch:  true,
		},
		{
			name: "replace uses external labels and excludes plugin metadata",
			config: `global:
  external_labels: {cluster: cluster-a}
alerting:
  alert_relabel_configs:
  - source_labels: [cluster]
    target_label: severity
    replacement: critical
  - source_labels: [openshift_io_alert_backend]
    regex: .+
    action: drop
`,
			promLabels: map[string]string{"alertname": "HighCPU", "severity": "warning", AlertBackendLabel: AlertBackendProm},
			amLabels:   map[string]string{"alertname": "HighCPU", "severity": "critical", "cluster": "cluster-a", AlertBackendLabel: AlertBackendAM},
			wantMatch:  true,
		},
		{
			name: "configured legacy label validation is preserved",
			config: `global:
  metric_name_validation_scheme: legacy
alerting:
  alert_relabel_configs:
  - source_labels: [label_name]
    target_label: "${1}"
    replacement: owned
`,
			promLabels: map[string]string{"alertname": "HighCPU", "label_name": "team.name"},
			amLabels:   map[string]string{"alertname": "HighCPU", "label_name": "team.name"},
			wantMatch:  true,
		},
		{
			name:       "dropped alert cannot enrich an old Alertmanager alert",
			config:     "alerting:\n  alert_relabel_configs:\n  - source_labels: [alertname]\n    regex: HighCPU\n    action: drop\n",
			promLabels: map[string]string{"alertname": "HighCPU"},
			amLabels:   map[string]string{"alertname": "HighCPU"},
		},
		{
			name:       "different instances remain distinct",
			config:     "global:\n  external_labels: {cluster: cluster-a}\n",
			promLabels: map[string]string{"alertname": "HighCPU", "instance": "node-a"},
			amLabels:   map[string]string{"alertname": "HighCPU", "instance": "node-b", "cluster": "cluster-a"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, err := json.Marshal(map[string]any{"status": "success", "data": map[string]string{"yaml": tc.config}})
			require.NoError(t, err)
			config, err := parseAlertDeliveryConfig(raw)
			require.NoError(t, err)
			originalPromLabels, originalAMLabels := maps.Clone(tc.promLabels), maps.Clone(tc.amLabels)
			promAlerts := []PrometheusAlert{{Labels: tc.promLabels, ActiveAt: promTime}}
			amAlerts := []PrometheusAlert{{Labels: tc.amLabels, ActiveAt: amTime}}
			enrichActiveAt(amAlerts, promAlerts, config)
			want := amTime
			if tc.wantMatch {
				want = promTime
			}
			require.Equal(t, want, amAlerts[0].ActiveAt)
			require.Equal(t, originalPromLabels, promAlerts[0].Labels)
			require.Equal(t, originalAMLabels, amAlerts[0].Labels)
		})
	}
}

func TestEnrichActiveAt_CollapsedInstancesRetainEarliestTimestamp(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)
	raw := []byte(`{"status":"success","data":{"yaml":"alerting:\n  alert_relabel_configs:\n  - action: labeldrop\n    regex: instance\n"}}`)
	config, err := parseAlertDeliveryConfig(raw)
	require.NoError(t, err)
	for _, timestamps := range [][]time.Time{
		{amTime.Add(-time.Hour), amTime.Add(-2 * time.Hour), {}},
		{amTime.Add(-2 * time.Hour), amTime.Add(-time.Hour), {}},
	} {
		amAlerts := []PrometheusAlert{{Labels: map[string]string{"alertname": "HighCPU"}, ActiveAt: amTime}}
		promAlerts := []PrometheusAlert{
			{Labels: map[string]string{"alertname": "HighCPU", "instance": "a"}, ActiveAt: timestamps[0]},
			{Labels: map[string]string{"alertname": "HighCPU", "instance": "b"}, ActiveAt: timestamps[1]},
			{Labels: map[string]string{"alertname": "HighCPU", "instance": "c"}, ActiveAt: timestamps[2]},
		}
		enrichActiveAt(amAlerts, promAlerts, config)
		require.Equal(t, amTime.Add(-2*time.Hour), amAlerts[0].ActiveAt)
	}
}

func TestParseAlertDeliveryConfig_InvalidResponse(t *testing.T) {
	for _, raw := range []string{
		`not json`,
		`{"status":"error","data":{"yaml":"global: {}"}}`,
		`{"status":"success","data":{"yaml":""}}`,
		`{"status":"success","data":{"yaml":"global: ["}}`,
		`{"status":"success","data":{"yaml":"alerting:\n  alert_relabel_configs: [null]"}}`,
		`{"status":"success","data":{"yaml":"alerting:\n  alert_relabel_configs:\n  - action: hashmod\n    target_label: hash\n"}}`,
	} {
		t.Run(raw, func(t *testing.T) {
			_, err := parseAlertDeliveryConfig([]byte(raw))
			require.Error(t, err)
		})
	}
}

func TestFetchAlerts_DeliveryConfig(t *testing.T) {
	amTime := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)
	promTime := amTime.Add(-time.Hour)
	for _, source := range []string{AlertSourcePlatform, AlertSourceUser} {
		for _, configStatus := range []int{http.StatusOK, http.StatusForbidden} {
			t.Run(source+"/"+http.StatusText(configStatus), func(t *testing.T) {
				server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if got := r.Header.Get("Authorization"); got != "Bearer test-token" {
						t.Errorf("expected Authorization Bearer test-token, got %q", got)
					}
					switch r.URL.Path {
					case AlertmanagerAlertsPath:
						_ = json.NewEncoder(w).Encode([]alertmanagerAlert{
							{Labels: map[string]string{"alertname": "HighCPU", "cluster": "cluster-a"}, StartsAt: amTime, Status: alertmanagerAlertStatus{State: "active"}},
							{Labels: map[string]string{"alertname": "ExactMatch"}, StartsAt: amTime, Status: alertmanagerAlertStatus{State: "suppressed"}},
						})
					case "/api" + PrometheusAlertsPath:
						_ = json.NewEncoder(w).Encode(prometheusAlertsResponse{Status: "success", Data: prometheusAlertsData{Alerts: []PrometheusAlert{
							{Labels: map[string]string{"alertname": "HighCPU"}, State: "firing", ActiveAt: promTime},
							{Labels: map[string]string{"alertname": "ExactMatch"}, State: "firing", ActiveAt: promTime},
							{Labels: map[string]string{"alertname": "Waiting"}, State: "pending", ActiveAt: promTime},
						}}})
					case PrometheusConfigPath:
						w.WriteHeader(configStatus)
						if configStatus == http.StatusOK {
							_, _ = w.Write([]byte(`{"status":"success","data":{"yaml":"global:\n  external_labels: {cluster: cluster-a}\n"}}`))
						}
					default:
						t.Errorf("unexpected request path %s", r.URL.Path)
						w.WriteHeader(http.StatusNotFound)
					}
				}))
				defer server.Close()
				namespace, promRoute, amRoute := ClusterMonitoringNamespace, PlatformRouteName, PlatformAlertmanagerRouteName
				if source == AlertSourceUser {
					namespace, promRoute, amRoute = UserWorkloadMonitoringNamespace, UserWorkloadRouteName, UserWorkloadAlertmanagerRouteName
				}
				routes := routefake.NewSimpleClientset(&routev1.Route{
					ObjectMeta: metav1.ObjectMeta{Name: promRoute, Namespace: namespace},
					Spec:       routev1.RouteSpec{Host: strings.TrimPrefix(server.URL, "https://"), Path: "/api"},
				}, &routev1.Route{
					ObjectMeta: metav1.ObjectMeta{Name: amRoute, Namespace: namespace},
					Spec:       routev1.RouteSpec{Host: strings.TrimPrefix(server.URL, "https://"), Path: "/api"},
				})
				pa := &prometheusAlerts{routeClient: routes, config: &rest.Config{
					BearerToken:     "test-token",
					TLSClientConfig: rest.TLSClientConfig{CAData: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})},
				}}
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				var alerts []PrometheusAlert
				var err error
				if source == AlertSourceUser {
					alerts, err = pa.getUserWorkloadAlertsViaAlertmanager(ctx)
				} else {
					alerts, err = pa.getAlertsForSource(ctx, namespace, promRoute, amRoute, source)
				}
				require.NoError(t, err)
				require.Len(t, alerts, 3)
				wantTransformed, wantExact := promTime, amTime
				if configStatus != http.StatusOK {
					wantTransformed, wantExact = amTime, promTime
				}
				require.Equal(t, wantTransformed, alerts[0].ActiveAt)
				require.Equal(t, wantExact, alerts[1].ActiveAt)
				require.Equal(t, "silenced", alerts[1].State)
				require.Equal(t, "pending", alerts[2].State)
				require.Equal(t, promTime, alerts[2].ActiveAt)
			})
		}
	}
}
