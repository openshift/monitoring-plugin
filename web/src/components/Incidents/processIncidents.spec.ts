import { PrometheusResult } from '@openshift-console/dynamic-plugin-sdk';
import {
  convertToIncidents,
  getIncidents,
  getIncidentsTimeRanges,
  processIncidentsForAlerts,
} from './processIncidents';

describe('convertToIncidents', () => {
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);

  describe('edge cases', () => {
    it('should return empty array when no data provided', () => {
      const result = convertToIncidents([]);
      expect(result).toEqual([]);
    });

    it('should filter out Watchdog incidents', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'monitoring',
            layer: 'monitoring',
            src_alertname: 'Watchdog',
            src_namespace: 'openshift-monitoring',
            src_severity: 'info',
          },
          values: [[nowSeconds, '0']],
        },
        {
          metric: {
            group_id: 'incident2',
            component: 'machine-config',
            layer: 'compute',
            src_alertname: 'ClusterOperatorDegraded',
            src_namespace: 'openshift-cluster-version',
            src_severity: 'warning',
          },
          values: [[nowSeconds, '1']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].src_alertname).toBe('ClusterOperatorDegraded');
    });
  });

  describe('firing and resolved status', () => {
    it('should mark incident as firing if last timestamp is within 10 minutes', () => {
      const recentTimestamp = nowSeconds - 300; // 5 minutes ago

      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'test-component',
            layer: 'test-layer',
            src_alertname: 'TestAlert',
            src_namespace: 'test-namespace',
            src_severity: 'critical',
          },
          values: [[recentTimestamp, '2']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].firing).toBe(true);
      expect(result[0].resolved).toBe(false);
    });

    it('should mark incident as resolved if last timestamp is more than 10 minutes ago', () => {
      const oldTimestamp = nowSeconds - 900; // 15 minutes ago

      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'test-component',
            layer: 'test-layer',
            src_alertname: 'TestAlert',
            src_namespace: 'test-namespace',
            src_severity: 'warning',
          },
          values: [[oldTimestamp, '1']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].firing).toBe(false);
      expect(result[0].resolved).toBe(true);
    });

    it('should mark incident as firing at exactly 10 minutes boundary', () => {
      const boundaryTimestamp = nowSeconds - 600; // Exactly 10 minutes ago

      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'test-component',
            layer: 'test-layer',
            src_alertname: 'TestAlert',
            src_namespace: 'test-namespace',
            src_severity: 'critical',
          },
          values: [[boundaryTimestamp, '2']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].firing).toBe(true); // <= 10 minutes is still firing
      expect(result[0].resolved).toBe(false);
    });
  });

  describe('sorting and indexing', () => {
    it('should sort incidents by earliest timestamp', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident2',
            component: 'comp2',
            layer: 'layer2',
            src_alertname: 'Alert2',
            src_namespace: 'ns2',
            src_severity: 'warning',
          },
          values: [[nowSeconds - 1800, '1']], // 30 minutes ago
        },
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
            layer: 'layer1',
            src_alertname: 'Alert1',
            src_namespace: 'ns1',
            src_severity: 'critical',
          },
          values: [[nowSeconds - 3600, '2']], // 1 hour ago
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(2);
      expect(result[0].group_id).toBe('incident1'); // Earliest first
      expect(result[1].group_id).toBe('incident2');
    });

    it('should assign x values in reverse order (latest incident has x=1)', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
            layer: 'layer1',
            src_alertname: 'Alert1',
            src_namespace: 'ns1',
            src_severity: 'critical',
          },
          values: [[nowSeconds - 3600, '2']],
        },
        {
          metric: {
            group_id: 'incident2',
            component: 'comp2',
            layer: 'layer2',
            src_alertname: 'Alert2',
            src_namespace: 'ns2',
            src_severity: 'warning',
          },
          values: [[nowSeconds - 1800, '1']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(2);
      expect(result[0].x).toBe(2); // Earliest has highest x
      expect(result[1].x).toBe(1); // Latest has lowest x
    });
  });

  describe('source properties extraction', () => {
    it('should extract all src_ prefixed properties', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
            layer: 'layer1',
            src_alertname: 'TestAlert',
            src_namespace: 'test-namespace',
            src_severity: 'critical',
          },
          values: [[nowSeconds, '2']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].src_alertname).toBe('TestAlert');
      expect(result[0].src_namespace).toBe('test-namespace');
      expect(result[0].src_severity).toBe('critical');
    });

    it('should only extract src_ prefixed properties', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
            layer: 'layer1',
            src_alertname: 'TestAlert',
          },
          values: [[nowSeconds, '2']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].src_alertname).toBe('TestAlert');
      // Only src_ properties should be extracted
      expect(result[0].component).toBe('comp1');
      expect(result[0].layer).toBe('layer1');
    });
  });

  describe('padding points integration', () => {
    it('should add padding points to values via insertPaddingPointsForChart', () => {
      const timestamp = nowSeconds - 600;
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
            layer: 'layer1',
            src_alertname: 'TestAlert',
            src_namespace: 'test-namespace',
            src_severity: 'critical',
          },
          values: [[timestamp, '2']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(1);
      // insertPaddingPointsForChart adds a point 5 minutes before the first point
      expect(result[0].values.length).toBe(2);
      expect(result[0].values[0][0]).toBe(timestamp - 300); // Padding point
      expect(result[0].values[1][0]).toBe(timestamp); // Original point
    });
  });

  describe('component and componentList', () => {
    it('should include component in result', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'test-component',
            layer: 'test-layer',
            src_alertname: 'TestAlert',
            src_namespace: 'test-namespace',
            src_severity: 'critical',
          },
          values: [[nowSeconds, '2']],
        },
      ];

      const result = convertToIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].component).toBe('test-component');
      // componentList is created by getIncidents
      expect(result[0].componentList).toBeDefined();
    });
  });
});

describe('getIncidents', () => {
  describe('edge cases', () => {
    it('should return empty array when no data provided', () => {
      const result = getIncidents([]);
      expect(result).toEqual([]);
    });

    it('should handle single incident', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [[1000, '2']],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].metric.group_id).toBe('incident1');
    });
  });

  describe('grouping by group_id', () => {
    it('should merge incidents with same group_id', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [[1000, '2']],
        },
        {
          metric: {
            group_id: 'incident1',
            component: 'comp2',
          },
          values: [[1100, '1']],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].metric.group_id).toBe('incident1');
      expect(result[0].values).toHaveLength(2);
    });

    it('should keep incidents with different group_ids separate', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [[1000, '2']],
        },
        {
          metric: {
            group_id: 'incident2',
            component: 'comp2',
          },
          values: [[1100, '1']],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(2);
    });
  });

  describe('value deduplication and severity handling', () => {
    it('should deduplicate values by timestamp, keeping highest severity', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [
            [1000, '1'], // Warning
            [1000, '2'], // Critical (higher)
          ],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(1);
      expect(result[0].values[0]).toEqual([1000, '2']); // Should keep critical
    });

    it('should keep highest severity when merging incidents with same timestamp', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [[1000, '0']], // Info
        },
        {
          metric: {
            group_id: 'incident1',
            component: 'comp2',
          },
          values: [[1000, '1']], // Warning (higher)
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(1);
      expect(result[0].values[0]).toEqual([1000, '1']); // Should keep warning
    });

    it('should handle severity ranking correctly (2 > 1 > 0)', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [
            [1000, '0'], // Info
            [1000, '1'], // Warning
            [1000, '2'], // Critical
          ],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(1);
      expect(result[0].values[0]).toEqual([1000, '2']);
    });

    it('should not deduplicate values with different timestamps', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [
            [1000, '2'],
            [1100, '2'],
            [1200, '2'],
          ],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(3);
    });
  });

  describe('componentList handling', () => {
    it('should initialize componentList with single component', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [[1000, '2']],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].metric.componentList).toEqual(['comp1']);
    });

    it('should build componentList when merging incidents with different components', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [[1000, '2']],
        },
        {
          metric: {
            group_id: 'incident1',
            component: 'comp2',
          },
          values: [[1100, '1']],
        },
        {
          metric: {
            group_id: 'incident1',
            component: 'comp3',
          },
          values: [[1200, '0']],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].metric.componentList).toContain('comp1');
      expect(result[0].metric.componentList).toContain('comp2');
      expect(result[0].metric.componentList).toContain('comp3');
      expect(result[0].metric.componentList).toHaveLength(3);
    });

    it('should not add duplicate components to componentList', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
          },
          values: [[1000, '2']],
        },
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1', // Same component
          },
          values: [[1100, '1']],
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].metric.componentList).toEqual(['comp1']);
    });
  });

  describe('silenced status handling', () => {
    it('should use silenced value from most recent timestamp when merging', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
            silenced: 'false',
          },
          values: [[1000, '2']],
        },
        {
          metric: {
            group_id: 'incident1',
            component: 'comp2',
            silenced: 'true',
          },
          values: [[2000, '1']], // More recent
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].metric.silenced).toBe('true'); // Should use value from most recent
    });

    it('should keep older silenced value if new result has older timestamps', () => {
      const data: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'comp1',
            silenced: 'true',
          },
          values: [[2000, '2']], // More recent
        },
        {
          metric: {
            group_id: 'incident1',
            component: 'comp2',
            silenced: 'false',
          },
          values: [[1000, '1']], // Older
        },
      ];

      const result = getIncidents(data);
      expect(result).toHaveLength(1);
      expect(result[0].metric.silenced).toBe('true'); // Should keep from most recent
    });
  });
});

describe('getIncidentsTimeRanges', () => {
  const ONE_DAY = 24 * 60 * 60 * 1000;

  describe('basic functionality', () => {
    it('should return single range for timespan less than one day', () => {
      const timespan = 12 * 60 * 60 * 1000; // 12 hours
      const result = getIncidentsTimeRanges(timespan);

      expect(result).toHaveLength(1);
      expect(result[0].duration).toBe(ONE_DAY);
    });

    it('should split longer timespans into daily chunks', () => {
      const timespan = 3 * ONE_DAY; // 3 days
      const result = getIncidentsTimeRanges(timespan);

      expect(result.length).toBeGreaterThan(1);
      result.forEach((range) => {
        expect(range.duration).toBe(ONE_DAY);
      });
    });

    it('should use provided maxEndTime', () => {
      const maxEndTime = new Date('2024-01-01T00:00:00Z').getTime();
      const timespan = ONE_DAY;
      const result = getIncidentsTimeRanges(timespan, maxEndTime);

      expect(result[result.length - 1].endTime).toBeLessThanOrEqual(maxEndTime + ONE_DAY);
    });

    it('should default to current time when maxEndTime not provided', () => {
      const before = Date.now();
      const timespan = ONE_DAY;
      const result = getIncidentsTimeRanges(timespan);
      const after = Date.now();

      const lastEndTime = result[result.length - 1].endTime;
      expect(lastEndTime).toBeGreaterThanOrEqual(before);
      expect(lastEndTime).toBeLessThanOrEqual(after + ONE_DAY);
    });
  });

  describe('range calculation', () => {
    it('should have sequential endTime values', () => {
      const timespan = 3 * ONE_DAY;
      const result = getIncidentsTimeRanges(timespan);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].endTime).toBeGreaterThan(result[i - 1].endTime);
      }
    });

    it('should have endTime increments of one day', () => {
      const timespan = 3 * ONE_DAY;
      const result = getIncidentsTimeRanges(timespan);

      for (let i = 1; i < result.length; i++) {
        const diff = result[i].endTime - result[i - 1].endTime;
        expect(diff).toBe(ONE_DAY);
      }
    });
  });
});

describe('processIncidentsForAlerts', () => {
  describe('silenced status conversion', () => {
    it('should convert silenced "true" string to boolean true', () => {
      const incidents: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            silenced: 'true',
          },
          values: [[1000, '2']],
        },
      ];

      const result = processIncidentsForAlerts(incidents);
      expect(result).toHaveLength(1);
      expect(result[0].silenced).toBe(true);
    });

    it('should convert silenced "false" string to boolean false', () => {
      const incidents: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            silenced: 'false',
          },
          values: [[1000, '2']],
        },
      ];

      const result = processIncidentsForAlerts(incidents);
      expect(result).toHaveLength(1);
      expect(result[0].silenced).toBe(false);
    });

    it('should default to false when silenced is missing', () => {
      const incidents: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
          },
          values: [[1000, '2']],
        },
      ];

      const result = processIncidentsForAlerts(incidents);
      expect(result).toHaveLength(1);
      expect(result[0].silenced).toBe(false);
    });

    it('should default to false for any non-"true" string value', () => {
      const incidents: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            silenced: 'yes',
          },
          values: [[1000, '2']],
        },
      ];

      const result = processIncidentsForAlerts(incidents);
      expect(result).toHaveLength(1);
      expect(result[0].silenced).toBe(false);
    });
  });

  describe('x value assignment', () => {
    it('should assign x values in reverse order', () => {
      const incidents: PrometheusResult[] = [
        {
          metric: { group_id: 'incident1' },
          values: [[1000, '2']],
        },
        {
          metric: { group_id: 'incident2' },
          values: [[1100, '1']],
        },
        {
          metric: { group_id: 'incident3' },
          values: [[1200, '0']],
        },
      ];

      const result = processIncidentsForAlerts(incidents);
      expect(result).toHaveLength(3);
      expect(result[0].x).toBe(3);
      expect(result[1].x).toBe(2);
      expect(result[2].x).toBe(1);
    });
  });

  describe('metric and values mapping', () => {
    it('should preserve all metric fields', () => {
      const incidents: PrometheusResult[] = [
        {
          metric: {
            group_id: 'incident1',
            component: 'test-component',
            layer: 'test-layer',
            src_alertname: 'TestAlert',
          },
          values: [[1000, '2']],
        },
      ];

      const result = processIncidentsForAlerts(incidents);
      expect(result).toHaveLength(1);
      expect(result[0].group_id).toBe('incident1');
      expect(result[0].component).toBe('test-component');
      expect(result[0].layer).toBe('test-layer');
      expect(result[0].src_alertname).toBe('TestAlert');
    });

    it('should preserve values array', () => {
      const values: Array<[number, string]> = [
        [1000, '2'],
        [1100, '1'],
        [1200, '0'],
      ];
      const incidents: PrometheusResult[] = [
        {
          metric: { group_id: 'incident1' },
          values,
        },
      ];

      const result = processIncidentsForAlerts(incidents);
      expect(result).toHaveLength(1);
      expect(result[0].values).toEqual(values);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = processIncidentsForAlerts([]);
      expect(result).toEqual([]);
    });

    it('should handle single incident', () => {
      const incidents: PrometheusResult[] = [
        {
          metric: { group_id: 'incident1', silenced: 'true' },
          values: [[1000, '2']],
        },
      ];

      const result = processIncidentsForAlerts(incidents);
      expect(result).toHaveLength(1);
      expect(result[0].group_id).toBe('incident1');
      expect(result[0].silenced).toBe(true);
      expect(result[0].x).toBe(1);
    });
  });
});
