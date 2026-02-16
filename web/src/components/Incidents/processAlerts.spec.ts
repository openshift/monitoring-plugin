import { PrometheusResult } from '@openshift-console/dynamic-plugin-sdk';
import { convertToAlerts, deduplicateAlerts } from './processAlerts';
import { Incident } from './model';
import { getCurrentTime, DAY_MS } from './utils';

describe('convertToAlerts', () => {
  const now = getCurrentTime();
  const nowSeconds = Math.floor(now / 1000);
  const daysSpanMs = 15 * DAY_MS;

  describe('edge cases', () => {
    it('should return empty array when no prometheus results provided', () => {
      const result = convertToAlerts([], [], now, daysSpanMs);
      expect(result).toEqual([]);
    });

    it('should return empty array when only Watchdog alerts are provided', () => {
      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Watchdog',
            namespace: 'openshift-monitoring',
            severity: 'info',
            component: 'monitoring',
            layer: 'monitoring',
            name: 'watchdog',
            alertstate: 'firing',
          },
          values: [[nowSeconds, '1']],
        },
      ];
      const result = convertToAlerts(prometheusResults, [], now, daysSpanMs);
      expect(result).toEqual([]);
    });

    it('should filter out Watchdog alerts from mixed results', () => {
      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Watchdog',
            namespace: 'openshift-monitoring',
            severity: 'info',
            component: 'monitoring',
            layer: 'monitoring',
            name: 'watchdog',
            alertstate: 'firing',
          },
          values: [[nowSeconds, '1']],
        },
        {
          metric: {
            alertname: 'ClusterOperatorDegraded',
            namespace: 'openshift-cluster-version',
            severity: 'warning',
            component: 'machine-config',
            layer: 'compute',
            name: 'machine-config',
            alertstate: 'firing',
          },
          values: [[nowSeconds, '2']],
        },
      ];
      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'ClusterOperatorDegraded',
          src_namespace: 'openshift-cluster-version',
          src_severity: 'warning',
          values: [[nowSeconds, '2']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);
      expect(result[0].alertname).toBe('ClusterOperatorDegraded');
    });
  });

  describe('time window filtering', () => {
    it('should filter alerts to incident time window with 30s padding', () => {
      const incidentStart = nowSeconds - 3600; // 1 hour ago
      // Use timestamps within 300s of each other to avoid gap-splitting
      const incidentEnd = incidentStart + 300;

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'critical',
            component: 'test-component',
            layer: 'test-layer',
            name: 'test',
            alertstate: 'firing',
          },
          values: [
            [incidentStart - 500, '2'], // Outside window (before, and gap-split away)
            [incidentStart, '2'], // Inside window
            [incidentEnd, '2'], // Inside window
          ],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          values: [
            [incidentStart, '2'],
            [incidentEnd, '2'],
          ],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      // The first value is gap-split away (500s gap > 300s threshold), leaving one interval
      expect(result).toHaveLength(1);
      expect(result[0].values.length).toBeGreaterThan(0);
    });

    it('should exclude alerts with no values in incident time window', () => {
      const incidentTime = nowSeconds - 3600; // 1 hour ago

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'OldAlert',
            namespace: 'test-namespace',
            severity: 'warning',
            component: 'test-component',
            layer: 'test-layer',
            name: 'test',
            alertstate: 'firing',
          },
          values: [[nowSeconds - 7200, '1']], // 2 hours ago, outside incident window
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'DifferentAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          values: [[incidentTime, '2']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toEqual([]);
    });
  });

  describe('alert processing', () => {
    it('should determine resolved status from original values BUT return padded values', () => {
      const timestamp = nowSeconds - 660; // 11 minutes ago

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'critical',
            component: 'test-component',
            layer: 'test-layer',
            name: 'test',
            alertstate: 'firing',
          },
          values: [[timestamp, '2']],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          values: [[timestamp, '2']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);

      // Verify resolved is determined from ORIGINAL values (before padding)
      // Original timestamp: 11 minutes ago (> 10 minutes, so resolved)
      const timeSinceOriginal = nowSeconds - timestamp;
      expect(result[0].resolved).toBe(timeSinceOriginal >= 600); // >= 10 minutes
      expect(result[0].resolved).toBe(true); // Should be resolved

      // Verify the returned values ARE the padded values
      expect(result[0].values.length).toBe(3); // Original + 2 padding points
      expect(result[0].values[0][0]).toBe(timestamp - 300); // Padding before
      expect(result[0].values[1][0]).toBe(timestamp); // Original
      expect(result[0].values[2][0]).toBe(timestamp + 300); // Padding after
    });

    it('should use padded timestamps for firing times', () => {
      const timestamp = nowSeconds - 600; // 10 minutes ago

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'critical',
            component: 'test-component',
            layer: 'test-layer',
            name: 'test',
            alertstate: 'firing',
          },
          values: [[timestamp, '2']],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          values: [[timestamp, '2']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);
      expect(result[0].alertsStartFiring).toBeGreaterThan(0);
      expect(result[0].alertsEndFiring).toBeGreaterThan(0);
      // alertsStartFiring and alertsEndFiring use padded timestamps
      // This ensures table displays same times as chart
      const expectedStart = timestamp - 300; // Padding point 5 minutes before
      expect(result[0].alertsStartFiring).toBe(expectedStart);
      const expectedEnd = timestamp + 300; // Padding point 5 minutes after
      expect(result[0].alertsEndFiring).toBe(expectedEnd);
    });

    it('should mark alert as resolved if ended more than 10 minutes ago', () => {
      const oldTimestamp = nowSeconds - 960; // 16 minutes ago
      // After padding (+300s), last timestamp will be 11 minutes ago (960-300=660s ago)
      // which is > 10 minutes, so it should be resolved

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'warning',
            component: 'test-component',
            layer: 'test-layer',
            name: 'test',
            alertstate: 'firing',
          },
          values: [[oldTimestamp, '1']],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'warning',
          values: [[oldTimestamp, '1']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);
      expect(result[0].alertstate).toBe('resolved');
      expect(result[0].resolved).toBe(true);
    });

    it('should mark alert as firing if ended less than 10 minutes ago', () => {
      const recentTimestamp = nowSeconds - 540; // 9 minutes ago
      // Resolved check is done on original timestamp (before padding)
      // 9 minutes ago is < 10 minutes, so it should still be firing

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'critical',
            component: 'test-component',
            layer: 'test-layer',
            name: 'test',
            alertstate: 'firing',
          },
          values: [[recentTimestamp, '2']],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          values: [[recentTimestamp, '2']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);
      expect(result[0].alertstate).toBe('firing');
      expect(result[0].resolved).toBe(false);
    });
  });

  describe('sorting and indexing', () => {
    it('should sort alerts by earliest timestamp', () => {
      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert2',
            namespace: 'ns2',
            severity: 'warning',
            name: 'name2',
            alertstate: 'firing',
          },
          values: [[nowSeconds - 1800, '1']], // 30 min ago
        },
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'critical',
            name: 'name1',
            alertstate: 'firing',
          },
          values: [[nowSeconds - 3600, '2']], // 1 hour ago
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          component: 'comp1',
          layer: 'layer1',
          src_alertname: 'Alert1',
          src_namespace: 'ns1',
          src_severity: 'critical',
          values: [[nowSeconds - 3600, '2']],
        },
        {
          group_id: 'incident2',
          component: 'comp2',
          layer: 'layer2',
          src_alertname: 'Alert2',
          src_namespace: 'ns2',
          src_severity: 'warning',
          values: [[nowSeconds - 1800, '1']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(2);
      expect(result[0].alertname).toBe('Alert1'); // Earlier alert first
      expect(result[1].alertname).toBe('Alert2');
    });

    it('should assign x values in reverse order (latest alert has x=1)', () => {
      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'critical',
            name: 'name1',
            alertstate: 'firing',
          },
          values: [[nowSeconds - 3600, '2']],
        },
        {
          metric: {
            alertname: 'Alert2',
            namespace: 'ns2',
            severity: 'warning',
            name: 'name2',
            alertstate: 'firing',
          },
          values: [[nowSeconds - 1800, '1']],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'Alert1',
          src_namespace: 'ns1',
          src_severity: 'critical',
          component: 'comp1',
          layer: 'layer1',
          values: [[nowSeconds - 3600, '2']],
        },
        {
          group_id: 'incident2',
          src_alertname: 'Alert2',
          src_namespace: 'ns2',
          src_severity: 'warning',
          component: 'comp2',
          layer: 'layer2',
          values: [[nowSeconds - 1800, '1']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(2);
      expect(result[0].x).toBe(2); // Earliest alert has highest x
      expect(result[1].x).toBe(1); // Latest alert has lowest x
    });
  });

  describe('silenced status', () => {
    it('should use silenced status from matching incident', () => {
      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'critical',
            name: 'test',
            alertstate: 'firing',
          },
          values: [[nowSeconds, '2']],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          component: 'test-component',
          layer: 'test-layer',
          silenced: true,
          values: [[nowSeconds, '2']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);
      expect(result[0].silenced).toBe(true);
    });
  });

  describe('incident merging', () => {
    it('should merge duplicate incidents by composite key', () => {
      // Use timestamps within 300s to avoid gap-splitting in deduplicateAlerts
      const t1 = nowSeconds - 600;
      const t2 = t1 + 300;

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'critical',
            name: 'test',
            alertstate: 'firing',
          },
          values: [
            [t1, '2'],
            [t2, '2'],
          ],
        },
      ];

      // Two incidents with same composite key but different timestamps
      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          component: 'test-component',
          layer: 'test-layer',
          silenced: false,
          values: [[t1, '2']],
        },
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          silenced: true, // Latest should be true
          values: [[t2, '2']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);
      // Should use the silenced value from the latest timestamp
      expect(result[0].silenced).toBe(true);
    });
  });

  describe('metric fields mapping', () => {
    it('should correctly map all metric fields to alert object', () => {
      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'MyAlert',
            namespace: 'my-namespace',
            severity: 'warning',
            name: 'my-name',
            alertstate: 'firing',
          },
          values: [[nowSeconds, '1']],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'MyAlert',
          src_namespace: 'my-namespace',
          src_severity: 'warning',
          component: 'my-component',
          layer: 'my-layer',
          values: [[nowSeconds, '1']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);
      expect(result[0].alertname).toBe('MyAlert');
      expect(result[0].namespace).toBe('my-namespace');
      expect(result[0].severity).toBe('warning');
      expect(result[0].component).toBe('my-component');
      expect(result[0].layer).toBe('my-layer');
      expect(result[0].name).toBe('my-name');
    });
  });

  describe('firstTimestamp from data', () => {
    it('should use first value of deduplicated interval minus padding offset as firstTimestamp', () => {
      const alertStart = nowSeconds - 3600; // 1 hour ago

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'critical',
            name: 'test',
            alertstate: 'firing',
          },
          values: [
            [alertStart, '2'],
            [alertStart + 300, '2'],
            [alertStart + 600, '2'],
          ],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          component: 'test-component',
          layer: 'test-layer',
          values: [[alertStart, '2']],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, daysSpanMs);
      expect(result).toHaveLength(1);
      // firstTimestamp is the first value minus the 300s padding offset
      expect(result[0].firstTimestamp).toBe(alertStart - 300);
    });

    it('should preserve firstTimestamp from full data even when values are clipped by N-day window', () => {
      // Alert interval starts just before the 3-day window boundary and continues into it.
      // The N-day filter clips the first value, but firstTimestamp stays absolute.
      const threeDaysMs = 3 * DAY_MS;
      const nDaysBoundary = Math.floor((now - threeDaysMs) / 1000);
      // Interval: starts 300s before boundary, continues into the window
      const alertStart = nDaysBoundary - 300;

      const prometheusResults: PrometheusResult[] = [
        {
          metric: {
            alertname: 'TestAlert',
            namespace: 'test-namespace',
            severity: 'critical',
            name: 'test',
            alertstate: 'firing',
          },
          values: [
            [alertStart, '2'], // Before N-day boundary (may be clipped by filter)
            [nDaysBoundary, '2'], // At boundary (inside window)
            [nDaysBoundary + 300, '2'], // Inside window
          ],
        },
      ];

      const incidents: Array<Partial<Incident>> = [
        {
          group_id: 'incident1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          src_severity: 'critical',
          component: 'test-component',
          layer: 'test-layer',
          values: [
            [alertStart, '2'],
            [nDaysBoundary + 300, '2'],
          ],
        },
      ];

      const result = convertToAlerts(prometheusResults, incidents, now, threeDaysMs);
      expect(result).toHaveLength(1);
      // firstTimestamp should reflect the absolute interval start minus padding,
      // not the clipped window boundary
      expect(result[0].firstTimestamp).toBe(alertStart - 300);
    });
  });
});

describe('deduplicateAlerts', () => {
  describe('filtering non-firing alerts', () => {
    it('should filter out all non-firing alerts', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'critical',
            alertstate: 'resolved',
          },
          values: [[1000, '2']],
        },
        {
          metric: {
            alertname: 'Alert2',
            namespace: 'ns2',
            severity: 'warning',
            alertstate: 'firing',
          },
          values: [[1000, '1']],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(1);
      expect(result[0].metric.alertname).toBe('Alert2');
    });
  });

  describe('deduplication by key', () => {
    it('should deduplicate alerts with same alertname, namespace, component, and severity', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1000, '2'],
            [1100, '2'],
          ],
        },
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1100, '2'],
            [1200, '2'],
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(3); // Deduplicated: [1000, 1100, 1200]
    });

    it('should not deduplicate alerts with different alertnames', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [[1000, '2']],
        },
        {
          metric: {
            alertname: 'Alert2',
            namespace: 'ns1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [[1000, '2']],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(2);
    });

    it('should not deduplicate alerts with different severities', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [[1000, '2']],
        },
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'warning',
            alertstate: 'firing',
          },
          values: [[1000, '1']],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(2);
    });
  });

  describe('value deduplication', () => {
    it('should remove duplicate values within same alert', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1000, '2'],
            [1000, '2'], // Duplicate
            [1100, '2'],
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(2); // Only 2 unique values
    });

    it('should merge and deduplicate values from multiple alerts', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1000, '2'],
            [1100, '2'],
          ],
        },
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1100, '2'], // Duplicate with first alert
            [1200, '2'],
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(1);
      // Should deduplicate the [1100, '2'] that appears in both alerts
      expect(result[0].values).toHaveLength(3); // [1000, 1100, 1200]

      // Verify the actual values
      const timestamps = result[0].values.map((v) => v[0]);
      expect(timestamps).toContain(1000);
      expect(timestamps).toContain(1100);
      expect(timestamps).toContain(1200);
    });
  });

  describe('gap splitting', () => {
    it('should split alert into two when gap exceeds 5 minutes', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1000, '2'],
            [1300, '2'], // 300s after first (no gap)
            [2000, '2'], // 700s after second (gap > 300s)
            [2300, '2'], // 300s after third (no gap)
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(2);
      expect(result[0].values).toEqual([
        [1000, '2'],
        [1300, '2'],
      ]);
      expect(result[1].values).toEqual([
        [2000, '2'],
        [2300, '2'],
      ]);
      // Both entries share the same alert identity
      expect(result[0].metric.alertname).toBe('Alert1');
      expect(result[1].metric.alertname).toBe('Alert1');
    });

    it('should split alert into multiple intervals with multiple gaps', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1000, '2'],
            [1300, '2'],
            [2000, '2'], // gap
            [3000, '2'], // gap
            [3300, '2'],
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(3);
      expect(result[0].values).toEqual([
        [1000, '2'],
        [1300, '2'],
      ]);
      expect(result[1].values).toEqual([[2000, '2']]);
      expect(result[2].values).toEqual([
        [3000, '2'],
        [3300, '2'],
      ]);
    });

    it('should not split when delta is exactly 300s (no gap)', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1000, '2'],
            [1300, '2'], // exactly 300s
            [1600, '2'], // exactly 300s
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(3);
    });

    it('should split when delta is 301s (just over threshold)', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1000, '2'],
            [1301, '2'], // 301s gap
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(2);
      expect(result[0].values).toEqual([[1000, '2']]);
      expect(result[1].values).toEqual([[1301, '2']]);
    });

    it('should split after merging values from multiple alerts with same key', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [1000, '2'],
            [1300, '2'],
          ],
        },
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [2000, '2'], // gap after merge
            [2300, '2'],
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(2);
      expect(result[0].values).toEqual([
        [1000, '2'],
        [1300, '2'],
      ]);
      expect(result[1].values).toEqual([
        [2000, '2'],
        [2300, '2'],
      ]);
    });

    it('should sort values by timestamp before gap detection', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [
            [2300, '2'],
            [1000, '2'], // out of order
            [2000, '2'],
            [1300, '2'],
          ],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(2);
      // Values should be sorted within each interval
      expect(result[0].values).toEqual([
        [1000, '2'],
        [1300, '2'],
      ]);
      expect(result[1].values).toEqual([
        [2000, '2'],
        [2300, '2'],
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = deduplicateAlerts([]);
      expect(result).toEqual([]);
    });

    it('should handle single alert with single value', () => {
      const alerts: PrometheusResult[] = [
        {
          metric: {
            alertname: 'Alert1',
            namespace: 'ns1',
            component: 'comp1',
            severity: 'critical',
            alertstate: 'firing',
          },
          values: [[1000, '2']],
        },
      ];

      const result = deduplicateAlerts(alerts);
      expect(result).toHaveLength(1);
      expect(result[0].metric).toEqual(alerts[0].metric);
      expect(result[0].values).toEqual(alerts[0].values);
    });
  });
});
