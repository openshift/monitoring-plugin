package k8s

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"maps"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	routev1 "github.com/openshift/api/route/v1"
	routefake "github.com/openshift/client-go/route/clientset/versioned/fake"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/relabel"
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
		State:    "firing",
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
		State:    "firing",
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
		State:  "firing",
	}}

	enrichActiveAt(amAlerts, promAlerts, nil)

	if !amAlerts[0].ActiveAt.Equal(amTime) {
		t.Errorf("expected ActiveAt to stay %v when prom has zero time, got %v", amTime, amAlerts[0].ActiveAt)
	}
}

func TestAlertFingerprint_PreservesGenuineReservedLabels(t *testing.T) {
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

	if fp1 == fp2 {
		t.Errorf("fingerprints must retain genuine upstream reserved-label values:\n  fp1=%q\n  fp2=%q", fp1, fp2)
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
			name: "unverified cluster remains ambiguous after replica removal",
			config: `global:
  external_labels: {cluster: cluster-a, prometheus_replica: prometheus-0}
alerting:
  alert_relabel_configs:
  - action: labeldrop
    regex: prometheus_replica
`,
			promLabels: map[string]string{"alertname": "HighCPU", "instance": "node-a"},
			amLabels:   map[string]string{"alertname": "HighCPU", "instance": "node-a", "cluster": "cluster-a"},
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
			promLabels: map[string]string{"alertname": "HighCPU", "severity": "warning", "cluster": "cluster-a", AlertBackendLabel: AlertBackendProm},
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
			promAlerts := []PrometheusAlert{{Labels: tc.promLabels, ActiveAt: promTime, State: "firing"}}
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
			{Labels: map[string]string{"alertname": "HighCPU", "instance": "a"}, ActiveAt: timestamps[0], State: "firing"},
			{Labels: map[string]string{"alertname": "HighCPU", "instance": "b"}, ActiveAt: timestamps[1], State: "firing"},
			{Labels: map[string]string{"alertname": "HighCPU", "instance": "c"}, ActiveAt: timestamps[2], State: "firing"},
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
							{Labels: map[string]string{"alertname": "HighCPU", "cluster": "cluster-a", "severity": "critical"}, StartsAt: amTime, Status: alertmanagerAlertStatus{State: "active"}},
							{Labels: map[string]string{"alertname": "ExactMatch"}, StartsAt: amTime, Status: alertmanagerAlertStatus{State: "suppressed"}},
						})
					case "/api" + PrometheusAlertsPath:
						_ = json.NewEncoder(w).Encode(prometheusAlertsResponse{Status: "success", Data: prometheusAlertsData{Alerts: []PrometheusAlert{
							{Labels: map[string]string{"alertname": "HighCPU", "cluster": "cluster-a", "severity": "warning"}, State: "firing", ActiveAt: promTime},
							{Labels: map[string]string{"alertname": "ExactMatch"}, State: "firing", ActiveAt: promTime},
							{Labels: map[string]string{"alertname": "Waiting"}, State: "pending", ActiveAt: promTime},
						}}})
					case PrometheusConfigPath:
						w.WriteHeader(configStatus)
						if configStatus == http.StatusOK {
							_, _ = w.Write([]byte(`{"status":"success","data":{"yaml":"global:\n  external_labels: {cluster: cluster-a}\nalerting:\n  alert_relabel_configs:\n  - source_labels: [alertname]\n    regex: HighCPU\n    target_label: severity\n    replacement: critical\n"}}`))
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

func TestEnrichActiveAt_PreservesOriginalMetadataForRelabeling(t *testing.T) {
	activeAt := time.Now().Add(-time.Hour)
	promAlerts := []PrometheusAlert{{Labels: map[string]string{"alertname": "MetadataCollision", AlertSourceLabel: "original-source", AlertBackendLabel: "original-backend"}, ActiveAt: activeAt, State: "firing"}}
	amAlerts := []PrometheusAlert{{Labels: map[string]string{"alertname": "MetadataCollision", AlertSourceLabel: "original-source", AlertBackendLabel: "original-backend", "team": "original-source;original-backend"}, ActiveAt: time.Now()}}
	applyAlertMetadata(promAlerts, AlertSourcePlatform, AlertBackendProm)
	applyAlertMetadata(amAlerts, AlertSourcePlatform, AlertBackendAM)
	config, err := parseAlertDeliveryConfig([]byte(`{"status":"success","data":{"yaml":"alerting:\n  alert_relabel_configs:\n  - source_labels: [openshift_io_alert_source, openshift_io_alert_backend]\n    target_label: team\n"}}`))
	require.NoError(t, err)
	enrichActiveAt(amAlerts, promAlerts, config)
	require.Equal(t, activeAt, amAlerts[0].ActiveAt)
	require.Equal(t, AlertBackendProm, promAlerts[0].Labels[AlertBackendLabel])
	require.Equal(t, AlertBackendAM, amAlerts[0].Labels[AlertBackendLabel])
}

func TestEnrichActiveAt_AmbiguousReplicaIdentity(t *testing.T) {
	activeAt, receivedAt := time.Now().Add(-time.Hour), time.Now()
	for _, tc := range []struct {
		name       string
		rules      string
		promLabels map[string]string
		amLabels   map[string]string
		match      bool
	}{
		{name: "config replica is not proof of alert replica", promLabels: map[string]string{"alertname": "ReplicaAlert"}, amLabels: map[string]string{"alertname": "ReplicaAlert", "prometheus_replica": "prometheus-1"}},
		{name: "different replica stays distinct", promLabels: map[string]string{"alertname": "ReplicaAlert", "prometheus_replica": "prometheus-0"}, amLabels: map[string]string{"alertname": "ReplicaAlert", "prometheus_replica": "prometheus-1"}},
		{name: "explicit alert replica overrides config replica", promLabels: map[string]string{"alertname": "ReplicaAlert", "prometheus_replica": "prometheus-0"}, amLabels: map[string]string{"alertname": "ReplicaAlert", "prometheus_replica": "prometheus-0"}, match: true},
		{name: "discarding replica before any read is safe", rules: "  - action: labeldrop\n    regex: prometheus_replica\n", promLabels: map[string]string{"alertname": "ReplicaAlert"}, amLabels: map[string]string{"alertname": "ReplicaAlert"}, match: true},
		{name: "reading replica before discarding remains ambiguous", rules: "  - source_labels: [prometheus_replica]\n    target_label: replica_copy\n  - action: labeldrop\n    regex: prometheus_replica\n", promLabels: map[string]string{"alertname": "ReplicaAlert"}, amLabels: map[string]string{"alertname": "ReplicaAlert", "replica_copy": "prometheus-1"}},
		{name: "mapping replica before discarding remains ambiguous", rules: "  - action: labelmap\n    regex: prometheus_replica\n    replacement: replica_copy\n  - action: labeldrop\n    regex: prometheus_replica\n", promLabels: map[string]string{"alertname": "ReplicaAlert"}, amLabels: map[string]string{"alertname": "ReplicaAlert", "replica_copy": "prometheus-1"}},
		{name: "keeping only other labels discards replica", rules: "  - action: labelkeep\n    regex: alertname\n", promLabels: map[string]string{"alertname": "ReplicaAlert"}, amLabels: map[string]string{"alertname": "ReplicaAlert"}, match: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			yaml := "global:\n  external_labels: {prometheus_replica: prometheus-1}\n"
			if tc.rules != "" {
				yaml += "alerting:\n  alert_relabel_configs:\n" + tc.rules
			}
			raw, err := json.Marshal(map[string]any{"status": "success", "data": map[string]string{"yaml": yaml}})
			require.NoError(t, err)
			config, err := parseAlertDeliveryConfig(raw)
			require.NoError(t, err)
			amAlerts := []PrometheusAlert{{Labels: tc.amLabels, ActiveAt: receivedAt}}
			enrichActiveAt(amAlerts, []PrometheusAlert{{Labels: tc.promLabels, ActiveAt: activeAt, State: "firing"}}, config)
			want := receivedAt
			if tc.match {
				want = activeAt
			}
			require.Equal(t, want, amAlerts[0].ActiveAt)
		})
	}
}

func TestUserWorkloadAlertDeliveryConfig_ServiceFallback(t *testing.T) {
	activeAt, receivedAt := time.Now().UTC().Add(-time.Hour).Truncate(time.Second), time.Now().UTC().Truncate(time.Second)
	serviceHost := UserWorkloadPrometheusServiceName + "." + UserWorkloadMonitoringNamespace + ".svc"
	caPEM, certificate := mustServiceServerCert(t, serviceHost)
	requests := make(chan string, 8)
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests <- r.Host + r.URL.Path
		switch r.URL.Path {
		case AlertmanagerAlertsPath:
			_ = json.NewEncoder(w).Encode([]alertmanagerAlert{{Labels: map[string]string{"alertname": "ServiceFallback", "cluster": "service-config", "team": "ops"}, StartsAt: receivedAt, Status: alertmanagerAlertStatus{State: "active"}}})
		case "/api" + PrometheusAlertsPath:
			_ = json.NewEncoder(w).Encode(prometheusAlertsResponse{Status: "success", Data: prometheusAlertsData{Alerts: []PrometheusAlert{{Labels: map[string]string{"alertname": "ServiceFallback", "cluster": "service-config", "team": "web"}, ActiveAt: activeAt, State: "firing"}}}})
		case PrometheusConfigPath:
			_, _ = w.Write([]byte(`{"status":"success","data":{"yaml":"global:\n  external_labels: {cluster: service-config}\nalerting:\n  alert_relabel_configs:\n  - target_label: team\n    replacement: ops\n"}}`))
		default:
			t.Errorf("unexpected request %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	server.TLS = &tls.Config{Certificates: []tls.Certificate{certificate}, MinVersion: tls.VersionTLS12}
	server.StartTLS()
	defer server.Close()
	// Only Alertmanager has a Route; Prometheus must use its Service.
	routes := routefake.NewSimpleClientset(&routev1.Route{ObjectMeta: metav1.ObjectMeta{Name: UserWorkloadAlertmanagerRouteName, Namespace: UserWorkloadMonitoringNamespace}, Spec: routev1.RouteSpec{Host: strings.Replace(strings.TrimPrefix(server.URL, "https://"), "127.0.0.1", serviceHost, 1)}})
	pa := &prometheusAlerts{routeClient: routes, config: &rest.Config{BearerToken: "test-token", TLSClientConfig: rest.TLSClientConfig{CAData: caPEM}, Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
		var dialer net.Dialer
		return dialer.DialContext(ctx, network, server.Listener.Addr().String())
	}}}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	alerts, err := pa.getUserWorkloadAlertsViaAlertmanager(ctx)
	require.NoError(t, err)
	require.Len(t, alerts, 1)
	require.Equal(t, activeAt, alerts[0].ActiveAt)
	require.Len(t, requests, 3)
	<-requests // Alertmanager Route.
	require.Equal(t, fmt.Sprintf("%s:%d/api%s", serviceHost, UserWorkloadPrometheusPort, PrometheusAlertsPath), <-requests)
	require.Equal(t, fmt.Sprintf("%s:%d%s", serviceHost, UserWorkloadPrometheusPort, PrometheusConfigPath), <-requests)
}

func TestMergeAlertsIncludingDropped(t *testing.T) {
	activeAt := time.Now().Add(-time.Hour)
	drop := relabel.DefaultRelabelConfig
	drop.Action = relabel.Drop
	drop.SourceLabels = model.LabelNames{"alertname"}
	drop.Regex = relabel.MustNewRegexp("Dropped.*")
	am := []PrometheusAlert{
		{Labels: map[string]string{"alertname": "Visible", AlertBackendLabel: AlertBackendAM}, State: "silenced", ActiveAt: time.Now()},
		{Labels: map[string]string{"alertname": "DroppedFiring", AlertBackendLabel: AlertBackendAM}, State: "firing", ActiveAt: time.Now()},
		{Labels: map[string]string{"alertname": "DroppedResolved", AlertBackendLabel: AlertBackendAM}, State: "firing", ActiveAt: time.Now()},
	}
	prom := []PrometheusAlert{
		{Labels: map[string]string{"alertname": "Visible", AlertBackendLabel: AlertBackendProm}, State: "firing", ActiveAt: activeAt},
		{Labels: map[string]string{"alertname": "DroppedFiring", AlertBackendLabel: AlertBackendProm}, State: "firing", ActiveAt: activeAt},
		{Labels: map[string]string{"alertname": "DroppedPending", AlertBackendLabel: AlertBackendProm}, State: "pending", ActiveAt: activeAt},
		{Labels: map[string]string{"alertname": "Waiting", AlertBackendLabel: AlertBackendProm}, State: "pending", ActiveAt: activeAt},
		{Labels: map[string]string{"alertname": "DroppedAbsentFromAM", AlertBackendLabel: AlertBackendProm}, State: "firing", ActiveAt: activeAt},
	}
	merged := mergeAlertsIncludingDropped(am, prom, []*relabel.Config{&drop})
	require.Len(t, merged, 5)
	require.Equal(t, "silenced", merged[0].State)
	require.Equal(t, AlertBackendAM, merged[0].Labels[AlertBackendLabel])
	for _, alert := range merged[1:] {
		require.Equal(t, AlertBackendProm, alert.Labels[AlertBackendLabel])
		require.Equal(t, activeAt, alert.ActiveAt)
	}
	require.Equal(t, "DroppedFiring", merged[1].Labels["alertname"])
	require.Equal(t, "DroppedPending", merged[2].Labels["alertname"])
	require.Equal(t, "Waiting", merged[3].Labels["alertname"])
	require.Equal(t, "DroppedAbsentFromAM", merged[4].Labels["alertname"])

	// Removing the Drop restores the usual Alertmanager + pending merge.
	restored := mergeAlertsIncludingDropped(am, prom, nil)
	require.Len(t, restored, 5)
	require.Equal(t, "firing", restored[1].State)
	require.Equal(t, AlertBackendAM, restored[1].Labels[AlertBackendLabel])
}

func TestFetchAlerts_RecoversDroppedInstancesAbsentFromAlertmanager(t *testing.T) {
	activeAt := time.Now().UTC().Add(-time.Hour).Truncate(time.Second)
	var promUnavailable atomic.Bool
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case AlertmanagerAlertsPath:
			if promUnavailable.Load() {
				_ = json.NewEncoder(w).Encode([]alertmanagerAlert{{Labels: map[string]string{"alertname": "DroppedFiring"}, StartsAt: activeAt, Status: alertmanagerAlertStatus{State: "suppressed"}}})
				return
			}
			_, _ = w.Write([]byte(`[]`))
		case "/api" + PrometheusAlertsPath:
			if promUnavailable.Load() {
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
			_ = json.NewEncoder(w).Encode(prometheusAlertsResponse{Status: "success", Data: prometheusAlertsData{Alerts: []PrometheusAlert{
				{Labels: map[string]string{"alertname": "DroppedFiring"}, State: "firing", ActiveAt: activeAt},
			}}})
		default:
			t.Errorf("unexpected request path %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	routes := routefake.NewSimpleClientset(&routev1.Route{
		ObjectMeta: metav1.ObjectMeta{Name: PlatformRouteName, Namespace: ClusterMonitoringNamespace},
		Spec:       routev1.RouteSpec{Host: strings.TrimPrefix(server.URL, "https://"), Path: "/api"},
	}, &routev1.Route{
		ObjectMeta: metav1.ObjectMeta{Name: PlatformAlertmanagerRouteName, Namespace: ClusterMonitoringNamespace},
		Spec:       routev1.RouteSpec{Host: strings.TrimPrefix(server.URL, "https://")},
	})
	pa := &prometheusAlerts{routeClient: routes, config: &rest.Config{
		BearerToken:     "test-token",
		TLSClientConfig: rest.TLSClientConfig{CAData: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})},
	}}
	drop := relabel.DefaultRelabelConfig
	drop.Action = relabel.Drop
	drop.SourceLabels = model.LabelNames{"alertname"}
	drop.Regex = relabel.MustNewRegexp("Dropped.*")
	ctx := context.Background()
	status := AlertFetchStatus{PlatformUnavailable: true}
	alerts, _, err := pa.FetchAlerts(ctx, GetAlertsRequest{FetchStatus: &status})
	require.NoError(t, err)
	require.False(t, status.PlatformUnavailable)
	require.True(t, status.UserUnavailable)
	require.Empty(t, alerts)
	alerts, _, err = pa.FetchAlerts(ctx, GetAlertsRequest{IncludeDropped: true, DroppedAlertRelabelConfigs: []*relabel.Config{&drop}})
	require.NoError(t, err)
	require.Len(t, alerts, 1)
	require.Equal(t, "DroppedFiring", alerts[0].Labels["alertname"])
	require.Equal(t, AlertBackendProm, alerts[0].Labels[AlertBackendLabel])
	require.Equal(t, activeAt, alerts[0].ActiveAt)
	promUnavailable.Store(true)
	alerts, _, err = pa.FetchAlerts(ctx, GetAlertsRequest{IncludeDropped: true, DroppedAlertRelabelConfigs: []*relabel.Config{&drop}})
	require.NoError(t, err)
	require.Empty(t, alerts, "Alertmanager alone cannot establish a dropped instance's native state")
	alerts, _, err = pa.FetchAlerts(ctx, GetAlertsRequest{})
	require.NoError(t, err)
	require.Len(t, alerts, 1, "default fetch retains the Alertmanager fallback")
	require.Equal(t, "silenced", alerts[0].State)
}
