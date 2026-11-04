package k8s

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/relabel"
	"github.com/stretchr/testify/require"
)

func TestAlertRelabelingUsesUpstreamMetadata(t *testing.T) {
	for _, upstreamBackend := range []string{"", "original"} {
		t.Run("upstream="+upstreamBackend, func(t *testing.T) {
			alertsProm := []PrometheusAlert{{Labels: map[string]string{"alertname": "Collision", AlertBackendLabel: upstreamBackend}, State: "firing"}}
			alertsAM := []PrometheusAlert{{Labels: map[string]string{"alertname": "Collision", AlertBackendLabel: upstreamBackend}, State: "firing"}}

			applyAlertMetadata(alertsProm, AlertSourcePlatform, AlertBackendProm)
			applyAlertMetadata(alertsAM, AlertSourcePlatform, AlertBackendAM)

			copyBackend := relabel.DefaultRelabelConfig
			copyBackend.NameValidationScheme = model.UTF8Validation
			copyBackend.SourceLabels = model.LabelNames{AlertBackendLabel}
			copyBackend.TargetLabel = "copied_backend"

			drop := relabel.DefaultRelabelConfig
			drop.Action = relabel.Drop
			drop.SourceLabels = model.LabelNames{AlertBackendLabel}
			drop.Regex = relabel.MustNewRegexp("original|prom")

			configs := []*relabel.Config{&copyBackend, &drop}

			merged := mergeAlertsIncludingDropped(alertsAM, alertsProm, configs)
			require.Len(t, merged, 1)

			if upstreamBackend == "original" {
				require.Equal(t, AlertBackendProm, merged[0].Labels[AlertBackendLabel], "rejected instances come from live Prometheus data")
			} else {
				require.Equal(t, AlertBackendAM, merged[0].Labels[AlertBackendLabel], "plugin metadata must not cause rejection")
			}

			keep := alertsProm[0].ApplyRelabelConfigs(configs...)
			require.Equal(t, upstreamBackend != "original", keep)
			require.Equal(t, upstreamBackend, alertsProm[0].Labels["copied_backend"])
			require.Equal(t, AlertBackendProm, alertsProm[0].Labels[AlertBackendLabel])
			require.Equal(t, AlertSourcePlatform, alertsProm[0].Labels[AlertSourceLabel])
		})
	}
}

func TestEnrichActiveAtPreservesGenuineReservedLabels(t *testing.T) {
	now := time.Now().UTC()
	for _, name := range []string{AlertSourceLabel, AlertBackendLabel} {
		t.Run(name, func(t *testing.T) {
			prom := []PrometheusAlert{
				{Labels: map[string]string{"alertname": "Collision", name: "a"}, State: "firing", ActiveAt: now.Add(-time.Hour)},
				{Labels: map[string]string{"alertname": "Collision", name: "b"}, State: "firing", ActiveAt: now.Add(-2 * time.Hour)},
			}
			am := []PrometheusAlert{
				{Labels: map[string]string{"alertname": "Collision", name: "a"}, ActiveAt: now},
				{Labels: map[string]string{"alertname": "Collision", name: "b"}, ActiveAt: now},
			}

			applyAlertMetadata(prom, AlertSourcePlatform, AlertBackendProm)
			applyAlertMetadata(am, AlertSourcePlatform, AlertBackendAM)

			enrichActiveAt(am, prom, nil)

			require.Equal(t, prom[0].ActiveAt, am[0].ActiveAt)
			require.Equal(t, prom[1].ActiveAt, am[1].ActiveAt)
		})
	}
}

func TestEnrichActiveAtRejectsAmbiguousOccurrences(t *testing.T) {
	firedAt := time.Now().UTC()
	for _, tc := range []struct {
		name     string
		state    string
		activeAt time.Time
		match    bool
	}{
		{name: "same firing occurrence", state: "firing", activeAt: firedAt.Add(-time.Minute), match: true},
		{name: "pending instance cannot replace firing occurrence", state: "pending", activeAt: firedAt.Add(-time.Minute)},
		{name: "reactivated pending instance", state: "pending", activeAt: firedAt.Add(time.Minute)},
		{name: "reactivated firing instance", state: "firing", activeAt: firedAt.Add(time.Minute)},
		{name: "clock skew remains ambiguous", state: "firing", activeAt: firedAt.Add(time.Millisecond)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			am := []PrometheusAlert{{Labels: map[string]string{"alertname": "Occurrence"}, ActiveAt: firedAt}}
			prom := []PrometheusAlert{{Labels: map[string]string{"alertname": "Occurrence"}, State: tc.state, ActiveAt: tc.activeAt}}

			enrichActiveAt(am, prom, nil)

			want := firedAt
			if tc.match {
				want = tc.activeAt
			}
			require.Equal(t, want, am[0].ActiveAt)
		})
	}
}

func TestEnrichActiveAtChecksEveryExternalLabel(t *testing.T) {
	for _, name := range []string{"cluster", "custom_rollout_label"} {
		for _, discard := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/discard=%t", name, discard), func(t *testing.T) {
				config := &alertDeliveryConfig{}
				config.Global.ExternalLabels = map[string]string{name: "config-replica"}

				amLabels := map[string]string{"alertname": "External", name: "config-replica"}
				if discard {
					drop := relabel.DefaultRelabelConfig
					drop.Action = relabel.LabelDrop
					drop.Regex = relabel.MustNewRegexp(name)
					config.Alerting.RelabelConfigs = []*relabel.Config{&drop}
					delete(amLabels, name)
				}

				now := time.Now().UTC()
				am := []PrometheusAlert{{Labels: amLabels, ActiveAt: now}}
				prom := []PrometheusAlert{{Labels: map[string]string{"alertname": "External"}, State: "firing", ActiveAt: now.Add(-time.Hour)}}

				enrichActiveAt(am, prom, config)

				want := now
				if discard {
					want = prom[0].ActiveAt
				}
				require.Equal(t, want, am[0].ActiveAt)
			})
		}
	}
}

func TestDeliveryConfigCache(t *testing.T) {
	pa := &prometheusAlerts{}
	var calls atomic.Int32
	get := func(ctx context.Context) ([]byte, error) {
		calls.Add(1)
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > alertDeliveryConfigTimeout {
			return nil, errors.New("configuration fetch is not bounded")
		}
		return []byte(`{"status":"success","data":{"yaml":"global: {}"}}`), nil
	}
	var wg sync.WaitGroup
	errorsCh := make(chan error, 8)
	for range 8 {
		wg.Go(func() {
			config, err := pa.cachedAlertDeliveryConfig(context.Background(), "route/platform", get)
			if err == nil && config == nil {
				err = errors.New("parsed configuration is nil")
			}
			errorsCh <- err
		})
	}
	wg.Wait()
	close(errorsCh)
	for err := range errorsCh {
		require.NoError(t, err)
	}
	require.EqualValues(t, 1, calls.Load(), "concurrent callers share the parsed configuration")
	_, err := pa.cachedAlertDeliveryConfig(context.Background(), "service/platform", get)
	require.NoError(t, err)
	require.EqualValues(t, 2, calls.Load(), "route and service settings must not share a key")
	pa.deliveryConfigMu.Lock()
	entry := pa.deliveryConfigs["route/platform"]
	entry.expiresAt = time.Now().Add(-time.Second)
	pa.deliveryConfigs["route/platform"] = entry
	pa.deliveryConfigMu.Unlock()
	_, err = pa.cachedAlertDeliveryConfig(context.Background(), "route/platform", get)
	require.NoError(t, err)
	require.EqualValues(t, 3, calls.Load(), "expired configuration must refresh")
}

func TestDeliveryConfigCacheFailureAndCancellation(t *testing.T) {
	pa := &prometheusAlerts{}
	calls := 0
	get := func(context.Context) ([]byte, error) {
		calls++
		return nil, errors.New("unavailable")
	}
	for range 2 {
		_, err := pa.cachedAlertDeliveryConfig(context.Background(), "route/platform", get)
		require.Error(t, err)
	}
	require.Equal(t, 1, calls, "cache failures briefly to avoid repeated blocking requests")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := pa.cachedAlertDeliveryConfig(ctx, "route/canceled", get)
	require.ErrorIs(t, err, context.Canceled)
	_, exists := pa.deliveryConfigs["route/canceled"]
	require.False(t, exists, "a canceled caller must not poison the shared cache")
}
