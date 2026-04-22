import {
  createAlertsChartBars,
  getCurrentTime,
  insertPaddingPointsForChart,
  removeTrailingPaddingFromSeveritySegments,
  roundDateToInterval,
  roundTimestampToFiveMinutes,
} from './utils';
import { Alert, Incident } from './model';

describe('getCurrentTime', () => {
  it('should return current time rounded down to 5-minute boundary', () => {
    const result = getCurrentTime();
    const now = Date.now();
    const intervalMs = 300 * 1000; // 5 minutes in milliseconds
    const expected = Math.floor(now / intervalMs) * intervalMs;

    expect(result).toBe(expected);
    expect(result % intervalMs).toBe(0); // Should be on 5-minute boundary
  });

  it('should round down to nearest 5-minute boundary', () => {
    const mockTime = 1704067230 * 1000; // 2024-01-01 00:00:30 UTC (30 seconds past)
    jest.spyOn(Date, 'now').mockReturnValue(mockTime);

    const result = getCurrentTime();
    const expected = 1704067200 * 1000; // 2024-01-01 00:00:00 UTC (rounded down)

    expect(result).toBe(expected);

    jest.restoreAllMocks();
  });

  it('should return same value for times on 5-minute boundaries', () => {
    const mockTime = 1704067200 * 1000; // 2024-01-01 00:00:00 UTC (on boundary)
    jest.spyOn(Date, 'now').mockReturnValue(mockTime);

    const result = getCurrentTime();
    expect(result).toBe(mockTime);

    jest.restoreAllMocks();
  });
});

describe('roundTimestampToFiveMinutes', () => {
  it('should return same value when timestamp is already on 5-minute boundary', () => {
    const timestamp = 1704067200; // 2024-01-01 00:00:00 UTC
    const result = roundTimestampToFiveMinutes(timestamp);
    expect(result).toBe(1704067200);
  });

  it('should round down timestamp that is 30 seconds past boundary', () => {
    const timestamp = 1704067230; // 2024-01-01 00:00:30 UTC
    const result = roundTimestampToFiveMinutes(timestamp);
    expect(result).toBe(1704067200); // Rounded down to 00:00:00
  });

  it('should round down timestamp that is 4 minutes 59 seconds past boundary', () => {
    const timestamp = 1704067499; // 2024-01-01 00:04:59 UTC
    const result = roundTimestampToFiveMinutes(timestamp);
    expect(result).toBe(1704067200); // Rounded down to 00:00:00
  });

  it('should return next boundary when timestamp is exactly on next boundary', () => {
    const timestamp = 1704067500; // 2024-01-01 00:05:00 UTC
    const result = roundTimestampToFiveMinutes(timestamp);
    expect(result).toBe(1704067500); // Already on boundary
  });

  it('should round down timestamp that is 1 second past boundary', () => {
    const timestamp = 1704067201; // 2024-01-01 00:00:01 UTC
    const result = roundTimestampToFiveMinutes(timestamp);
    expect(result).toBe(1704067200); // Rounded down
  });

  it('should handle timestamps with large values', () => {
    const timestamp = 1735689600; // 2025-01-01 00:00:00 UTC
    const result = roundTimestampToFiveMinutes(timestamp);
    expect(result).toBe(1735689600);
  });

  it('should round down correctly for various offsets', () => {
    const base = 1704067200; // 2024-01-01 00:00:00 UTC

    expect(roundTimestampToFiveMinutes(base + 0)).toBe(base); // On boundary
    expect(roundTimestampToFiveMinutes(base + 1)).toBe(base); // 1 second
    expect(roundTimestampToFiveMinutes(base + 60)).toBe(base); // 1 minute
    expect(roundTimestampToFiveMinutes(base + 299)).toBe(base); // 4 min 59 sec
    expect(roundTimestampToFiveMinutes(base + 300)).toBe(base + 300); // 5 minutes (next boundary)
    expect(roundTimestampToFiveMinutes(base + 301)).toBe(base + 300); // 5 min 1 sec
  });
});

describe('insertPaddingPointsForChart', () => {
  describe('edge cases', () => {
    it('should return empty array when input is empty', () => {
      const currentTime = 2000 * 1000; // 2000 seconds in ms
      const result = insertPaddingPointsForChart([], currentTime);
      expect(result).toEqual([]);
    });

    it('should handle a single data point without after padding when currentTime < item + interval', () => {
      const input: Array<[number, string]> = [[1000, 'critical']];
      const currentTime = 1200 * 1000; // 1200 seconds in ms (< 1000 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Should add padding point 5 minutes (300 seconds) before the single point
      // No after padding since currentTime < 1000 + 300
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([700, 'critical']); // 1000 - 300 = 700
      expect(result[1]).toEqual([1000, 'critical']);
    });

    it('should handle a single data point with after padding when currentTime >= item + interval', () => {
      const input: Array<[number, string]> = [[1000, 'critical']];
      const currentTime = 1300 * 1000; // 1300 seconds in ms (>= 1000 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Should add padding point before and after
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([700, 'critical']); // 1000 - 300 = 700
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1300, 'critical']); // 1000 + 300 = 1300
    });
  });

  describe('continuous sequences (no gaps)', () => {
    it('should add padding before first point and after last point when currentTime allows', () => {
      const input: Array<[number, string]> = [
        [1000, 'warning'],
        [1100, 'warning'], // 100 seconds later (< 5 min)
        [1200, 'warning'], // 100 seconds later (< 5 min)
      ];
      const currentTime = 1500 * 1000; // 1500 seconds (>= 1200 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Should have 5 points: 1 padding before + 3 original + 1 padding after
      expect(result).toHaveLength(5);
      expect(result[0]).toEqual([700, 'warning']); // Padding before first
      expect(result[1]).toEqual([1000, 'warning']);
      expect(result[2]).toEqual([1100, 'warning']);
      expect(result[3]).toEqual([1200, 'warning']);
      expect(result[4]).toEqual([1500, 'warning']); // Padding after last
    });

    it('should add only before padding when currentTime < last + interval', () => {
      const input: Array<[number, string]> = [
        [1000, 'warning'],
        [1100, 'warning'], // 100 seconds later (< 5 min)
        [1200, 'warning'], // 100 seconds later (< 5 min)
      ];
      const currentTime = 1400 * 1000; // 1400 seconds (< 1200 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Should have 4 points: 1 padding before + 3 original (no after padding)
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([700, 'warning']); // Padding before first
      expect(result[1]).toEqual([1000, 'warning']);
      expect(result[2]).toEqual([1100, 'warning']);
      expect(result[3]).toEqual([1200, 'warning']);
    });

    it('should handle points exactly 5 minutes apart (at threshold)', () => {
      const input: Array<[number, string]> = [
        [1000, 'info'],
        [1300, 'info'], // Exactly 300 seconds (5 minutes)
      ];
      const currentTime = 1600 * 1000; // 1600 seconds (>= 1300 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // At threshold (300s), should NOT create a gap
      // Should have before padding, 2 original points, and after padding
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([700, 'info']); // Padding before first
      expect(result[1]).toEqual([1000, 'info']);
      expect(result[2]).toEqual([1300, 'info']);
      expect(result[3]).toEqual([1600, 'info']); // Padding after last
    });
  });

  describe('sequences with gaps', () => {
    it('should add padding point before and after a gap > 5 minutes', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [1500, 'critical'], // 500 seconds later (> 5 min threshold of 301s)
      ];
      const currentTime = 1800 * 1000; // 1800 seconds (>= 1500 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Should have: padding before first + first point + padding after first
      // + padding before second + second point + padding after second
      expect(result).toHaveLength(6);
      expect(result[0]).toEqual([700, 'critical']); // Padding before first
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1300, 'critical']); // Padding after first (gap with next)
      expect(result[3]).toEqual([1200, 'critical']); // Padding before second (gap)
      expect(result[4]).toEqual([1500, 'critical']);
      expect(result[5]).toEqual([1800, 'critical']); // Padding after last
    });

    it('should add padding point when gap is exactly threshold + 1 second', () => {
      const input: Array<[number, string]> = [
        [1000, 'warning'],
        [1302, 'warning'], // 302 seconds later (> threshold of 301)
      ];
      const currentTime = 1602 * 1000; // 1602 seconds (>= 1302 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Should detect gap since it's > threshold (301s)
      expect(result).toHaveLength(6);
      expect(result[0]).toEqual([700, 'warning']); // Padding before first
      expect(result[1]).toEqual([1000, 'warning']);
      expect(result[2]).toEqual([1300, 'warning']); // Padding after first (gap with next)
      expect(result[3]).toEqual([1002, 'warning']); // Padding before second (gap)
      expect(result[4]).toEqual([1302, 'warning']);
      expect(result[5]).toEqual([1602, 'warning']); // Padding after last
    });

    it('should NOT add padding after when gap is exactly at threshold (301s)', () => {
      const input: Array<[number, string]> = [
        [1000, 'warning'],
        [1301, 'warning'], // 301 seconds later (= threshold, not > threshold)
      ];
      const currentTime = 1601 * 1000; // 1601 seconds (>= 1301 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Should NOT detect gap since 301 is not > 301
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([700, 'warning']); // Padding before first
      expect(result[1]).toEqual([1000, 'warning']);
      expect(result[2]).toEqual([1301, 'warning']); // No padding before this
      expect(result[3]).toEqual([1601, 'warning']); // Padding after last
    });

    it('should handle multiple gaps in sequence', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [2000, 'critical'], // Gap of 1000s
        [2100, 'warning'], // No gap (100s)
        [3000, 'info'], // Gap of 900s
      ];
      const currentTime = 3300 * 1000; // 3300 seconds (>= 3000 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      expect(result).toHaveLength(10);
      expect(result[0]).toEqual([700, 'critical']); // Padding before first
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1300, 'critical']); // Padding after first (gap with next)
      expect(result[3]).toEqual([1700, 'critical']); // Padding before second (gap)
      expect(result[4]).toEqual([2000, 'critical']);
      expect(result[5]).toEqual([2100, 'warning']); // No padding (continuous)
      expect(result[6]).toEqual([2400, 'warning']); // Padding after warning (gap with next)
      expect(result[7]).toEqual([2700, 'info']); // Padding before info (gap)
      expect(result[8]).toEqual([3000, 'info']);
      expect(result[9]).toEqual([3300, 'info']); // Padding after last
    });
  });

  describe('severity handling', () => {
    it('should preserve severity values in padding points', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [2000, 'warning'],
      ];
      const currentTime = 2300 * 1000; // 2300 seconds (>= 2000 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Padding points should have same severity as the point they precede/follow
      expect(result[0][1]).toBe('critical'); // Padding before first critical
      expect(result[1][1]).toBe('critical'); // Original critical
      expect(result[2][1]).toBe('critical'); // Padding after critical (gap with next)
      expect(result[3][1]).toBe('warning'); // Padding before warning (due to gap)
      expect(result[4][1]).toBe('warning'); // Original warning
      expect(result[5][1]).toBe('warning'); // Padding after warning
    });

    it('should handle different severity types', () => {
      const input: Array<[number, string]> = [
        [1000, '2'], // Critical (numeric)
        [1100, '1'], // Warning (numeric)
        [1200, '0'], // Info (numeric)
      ];
      const currentTime = 1500 * 1000; // 1500 seconds (>= 1200 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      expect(result[0]).toEqual([700, '2']); // Padding before first
      expect(result[1]).toEqual([1000, '2']);
      expect(result[2]).toEqual([1100, '1']);
      expect(result[3]).toEqual([1200, '0']);
      expect(result[4]).toEqual([1500, '0']); // Padding after last
    });
  });

  describe('complex scenarios', () => {
    it('should handle alternating gaps and continuous sequences', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [1100, 'critical'], // Continuous (100s)
        [1200, 'critical'], // Continuous (100s)
        [2000, 'warning'], // Gap (800s)
        [2100, 'warning'], // Continuous (100s)
        [3000, 'info'], // Gap (900s)
      ];
      const currentTime = 3300 * 1000; // 3300 seconds (>= 3000 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      expect(result).toHaveLength(12);
      expect(result[0]).toEqual([700, 'critical']); // Initial padding
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1100, 'critical']);
      expect(result[3]).toEqual([1200, 'critical']);
      expect(result[4]).toEqual([1500, 'critical']); // Padding after critical (gap with next)
      expect(result[5]).toEqual([1700, 'warning']); // Padding before warning (gap)
      expect(result[6]).toEqual([2000, 'warning']);
      expect(result[7]).toEqual([2100, 'warning']);
      expect(result[8]).toEqual([2400, 'warning']); // Padding after warning (gap with next)
      expect(result[9]).toEqual([2700, 'info']); // Padding before info (gap)
      expect(result[10]).toEqual([3000, 'info']);
      expect(result[11]).toEqual([3300, 'info']); // Padding after last
    });

    it('should handle very large timestamps', () => {
      const input: Array<[number, string]> = [
        [1704067200, 'critical'], // 2024-01-01 00:00:00 UTC
        [1704067500, 'critical'], // 5 minutes later
      ];
      const currentTime = 1704067800 * 1000; // 5 minutes after last point
      const result = insertPaddingPointsForChart(input, currentTime);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([1704066900, 'critical']); // 5 min before first
      expect(result[1]).toEqual([1704067200, 'critical']);
      expect(result[2]).toEqual([1704067500, 'critical']);
      expect(result[3]).toEqual([1704067800, 'critical']); // 5 min after last
    });

    it('should preserve original array order', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [1100, 'warning'],
        [1200, 'info'],
      ];
      const currentTime = 1500 * 1000; // 1500 seconds (>= 1200 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      // Verify timestamps are in ascending order
      for (let i = 1; i < result.length; i++) {
        expect(result[i][0]).toBeGreaterThan(result[i - 1][0]);
      }
    });
  });

  describe('boundary conditions', () => {
    it('should handle points at minimum timestamp (0)', () => {
      const input: Array<[number, string]> = [[0, 'critical']];
      const currentTime = 300 * 1000; // 300 seconds (>= 0 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([-300, 'critical']); // Negative timestamp is valid
      expect(result[1]).toEqual([0, 'critical']);
      expect(result[2]).toEqual([300, 'critical']); // Padding after
    });

    it('should handle very small time differences', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [1001, 'critical'], // 1 second apart
      ];
      const currentTime = 1301 * 1000; // 1301 seconds (>= 1001 + 300)
      const result = insertPaddingPointsForChart(input, currentTime);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([700, 'critical']); // Padding before first
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1001, 'critical']);
      expect(result[3]).toEqual([1301, 'critical']); // Padding after last
    });
  });
});

describe('roundDateToInterval', () => {
  describe('exact 5-minute boundaries', () => {
    it('should return unchanged date for 23:55:00', () => {
      const date = new Date('2026-01-26T23:55:00.000Z');
      const rounded = roundDateToInterval(date);
      expect(rounded.getTime()).toBe(date.getTime());
    });
  });

  describe('rounding to nearest 5-minute boundary', () => {
    it('should round 22:57:00 down to 22:55:00', () => {
      const date = new Date('2026-01-26T22:57:00.000Z');
      const rounded = roundDateToInterval(date);
      const expected = new Date('2026-01-26T22:55:00.000Z');
      expect(rounded.getTime()).toBe(expected.getTime());
    });

    it('should round 22:59:00 up to 23:00:00', () => {
      const date = new Date('2026-01-26T22:59:00.000Z');
      const rounded = roundDateToInterval(date);
      const expected = new Date('2026-01-26T23:00:00.000Z');
      expect(rounded.getTime()).toBe(expected.getTime());
    });
  });
});

describe('removeTrailingPaddingFromSeveritySegments', () => {
  const makeIncident = (
    overrides: Partial<Incident> & { values: Array<[number, string]> },
  ): Incident => ({
    component: 'test-component',
    componentList: ['test-component'],
    layer: 'compute',
    firing: false,
    group_id: 'group-1',
    src_severity: 'critical',
    src_alertname: 'TestAlert',
    src_namespace: 'test-ns',
    severity: 'critical',
    silenced: false,
    x: 1,
    firstTimestamp: 1000,
    metric: { group_id: 'group-1', component: 'test-component' },
    ...overrides,
  });

  it('should return the group unchanged when it has a single incident', () => {
    const group = [
      makeIncident({
        values: [
          [1000, '2'],
          [1300, '2'],
          [1600, '2'],
        ],
      }),
    ];

    const result = removeTrailingPaddingFromSeveritySegments(group);

    expect(result).toEqual(group);
    expect(result[0].values).toHaveLength(3);
  });

  it('should remove the trailing value from non-last segments in a multi-segment group', () => {
    const group = [
      makeIncident({
        values: [
          [1000, '1'],
          [1300, '1'],
          [1600, '1'], // trailing padding — should be removed
        ],
      }),
      makeIncident({
        values: [
          [1300, '2'],
          [1600, '2'],
          [1900, '2'],
        ],
      }),
    ];

    const result = removeTrailingPaddingFromSeveritySegments(group);

    // First segment (non-last): trailing value removed
    expect(result[0].values).toEqual([
      [1000, '1'],
      [1300, '1'],
    ]);
    // Last segment: unchanged
    expect(result[1].values).toEqual([
      [1300, '2'],
      [1600, '2'],
      [1900, '2'],
    ]);
  });

  it('should not remove the trailing value from the last segment', () => {
    const group = [
      makeIncident({
        values: [
          [1000, '1'],
          [1300, '1'],
          [1600, '1'],
        ],
      }),
      makeIncident({
        values: [
          [1600, '2'],
          [1900, '2'],
          [2200, '2'],
        ],
      }),
    ];

    const result = removeTrailingPaddingFromSeveritySegments(group);

    // Last segment should keep all values
    const lastSegment = result[result.length - 1];
    expect(lastSegment.values).toHaveLength(3);
  });

  it('should not remove values from a non-last segment that has only one value', () => {
    const group = [
      makeIncident({
        values: [[1000, '1']], // single value — nothing to trim
      }),
      makeIncident({
        values: [
          [1300, '2'],
          [1600, '2'],
        ],
      }),
    ];

    const result = removeTrailingPaddingFromSeveritySegments(group);

    // Single-value segment should be unchanged
    expect(result[0].values).toEqual([[1000, '1']]);
    // Last segment unchanged
    expect(result[1].values).toEqual([
      [1300, '2'],
      [1600, '2'],
    ]);
  });

  it('should sort segments by their first timestamp before processing', () => {
    // Pass segments in reverse order to verify sorting
    const group = [
      makeIncident({
        values: [
          [2000, '2'],
          [2300, '2'],
          [2600, '2'],
        ],
      }),
      makeIncident({
        values: [
          [1000, '1'],
          [1300, '1'],
          [1600, '1'],
        ],
      }),
    ];

    const result = removeTrailingPaddingFromSeveritySegments(group);

    // After sorting, the segment starting at 1000 is first (non-last) and gets trimmed
    expect(result[0].values).toEqual([
      [1000, '1'],
      [1300, '1'],
    ]);
    // The segment starting at 2000 is last and stays unchanged
    expect(result[1].values).toEqual([
      [2000, '2'],
      [2300, '2'],
      [2600, '2'],
    ]);
  });

  it('should handle three severity segments, trimming only non-last ones', () => {
    const group = [
      makeIncident({
        values: [
          [1000, '0'],
          [1300, '0'],
          [1600, '0'],
        ],
      }),
      makeIncident({
        values: [
          [1600, '1'],
          [1900, '1'],
          [2200, '1'],
        ],
      }),
      makeIncident({
        values: [
          [2200, '2'],
          [2500, '2'],
          [2800, '2'],
        ],
      }),
    ];

    const result = removeTrailingPaddingFromSeveritySegments(group);

    // First segment: trimmed
    expect(result[0].values).toEqual([
      [1000, '0'],
      [1300, '0'],
    ]);
    // Second segment: trimmed (also non-last)
    expect(result[1].values).toEqual([
      [1600, '1'],
      [1900, '1'],
    ]);
    // Third (last) segment: unchanged
    expect(result[2].values).toEqual([
      [2200, '2'],
      [2500, '2'],
      [2800, '2'],
    ]);
  });

  it('should not mutate the original incident objects', () => {
    const original = makeIncident({
      values: [
        [1000, '1'],
        [1300, '1'],
        [1600, '1'],
      ],
    });
    const group = [
      original,
      makeIncident({
        values: [
          [1600, '2'],
          [1900, '2'],
        ],
      }),
    ];

    removeTrailingPaddingFromSeveritySegments(group);

    // Original incident should still have all 3 values
    expect(original.values).toHaveLength(3);
  });
});

describe('createAlertsChartBars - padding boundary gap detection', () => {
  const makeAlert = (
    overrides: Partial<Alert> & { values: Array<[number, string]>; firstTimestamp: number },
  ): Alert => ({
    alertname: 'TestAlert',
    alertsStartFiring: 0,
    alertsEndFiring: 0,
    alertstate: 'firing',
    component: 'test-component',
    layer: 'compute',
    name: 'TestAlert',
    namespace: 'test-ns',
    resolved: false,
    severity: 'critical',
    silenced: false,
    x: 1,
    ...overrides,
  });

  it('should detect gap between alerts whose padded values would overlap', () => {
    // Alert A: real data at [1000, 1300]. Padded: [700, 1000, 1300, 1600]
    // Alert B: real data at [2200, 2500]. Padded: [1900, 2200, 2500, 2800]
    // Real gap: 2200 - 1300 = 900s (15 min) — should be detected
    // Without fix: padded timestamps 1600 and 1900 are only 300s (5 min) apart — no gap
    const alertA = makeAlert({
      values: [
        [700, '2'],
        [1000, '2'],
        [1300, '2'],
        [1600, '2'],
      ],
      firstTimestamp: 700,
    });

    const alertB = makeAlert({
      values: [
        [1900, '2'],
        [2200, '2'],
        [2500, '2'],
        [2800, '2'],
      ],
      firstTimestamp: 1900,
    });

    const bars = createAlertsChartBars([alertA, alertB]);

    const dataBars = bars.filter((b) => !b.nodata);
    const nodataBars = bars.filter((b) => b.nodata);

    expect(dataBars.length).toBe(2);
    expect(nodataBars.length).toBe(1);
  });

  it('should merge alerts whose real data is within 5 minutes of each other', () => {
    // Alert A: real data at [1000, 1300]. Padded: [700, 1000, 1300, 1600]
    // Alert B: real data at [1500, 1800]. Padded: [1200, 1500, 1800, 2100]
    // Real gap: 1500 - 1300 = 200s (3.3 min) — should merge
    const alertA = makeAlert({
      values: [
        [700, '2'],
        [1000, '2'],
        [1300, '2'],
        [1600, '2'],
      ],
      firstTimestamp: 700,
    });

    const alertB = makeAlert({
      values: [
        [1200, '2'],
        [1500, '2'],
        [1800, '2'],
        [2100, '2'],
      ],
      firstTimestamp: 1200,
    });

    const bars = createAlertsChartBars([alertA, alertB]);

    const dataBars = bars.filter((b) => !b.nodata);
    expect(dataBars.length).toBe(1);
  });

  it('should handle alerts with only 2 values (single real point + padding)', () => {
    // Alert with 2 values: [pad, real]. Only the last (real) value is used.
    const alertA = makeAlert({
      values: [
        [700, '2'],
        [1000, '2'],
      ],
      firstTimestamp: 700,
    });

    const alertB = makeAlert({
      values: [
        [1900, '2'],
        [2200, '2'],
      ],
      firstTimestamp: 1900,
    });

    const bars = createAlertsChartBars([alertA, alertB]);

    const dataBars = bars.filter((b) => !b.nodata);
    const nodataBars = bars.filter((b) => b.nodata);

    // Real gap: 2200 - 1000 = 1200s (20 min) > 5 min — should detect gap
    expect(dataBars.length).toBe(2);
    expect(nodataBars.length).toBe(1);
  });

  it('should preserve firstTimestamp per interval after gap detection', () => {
    const alertA = makeAlert({
      values: [
        [700, '2'],
        [1000, '2'],
        [1300, '2'],
        [1600, '2'],
      ],
      firstTimestamp: 500,
    });

    const alertB = makeAlert({
      values: [
        [1900, '2'],
        [2200, '2'],
        [2500, '2'],
        [2800, '2'],
      ],
      firstTimestamp: 1700,
    });

    const bars = createAlertsChartBars([alertA, alertB]) as any[];

    const dataBars = bars.filter((b) => !b.nodata);
    expect(dataBars.length).toBe(2);

    const startDates = dataBars.map((b) => b.startDate.getTime() / 1000);
    expect(startDates).toContain(500);
    expect(startDates).toContain(1700);
  });

  it('should preserve last real data point for firing alerts without trailing padding', () => {
    // Firing alert where currentTime < lastReal + 300, so no trailing padding was added.
    // Padded values: [700, 1000, 1100, 1200] (leading pad only, no trailing).
    // The old slice(1, -1) would drop 1200. The fix keeps it.
    const alertA = makeAlert({
      values: [
        [700, '2'],
        [1000, '2'],
        [1100, '2'],
        [1200, '2'],
      ],
      firstTimestamp: 700,
      resolved: false,
    });

    // Second alert starts 20 minutes later — should be a separate interval
    const alertB = makeAlert({
      values: [
        [2100, '2'],
        [2400, '2'],
        [2500, '2'],
        [2600, '2'],
      ],
      firstTimestamp: 2100,
      resolved: false,
    });

    const bars = createAlertsChartBars([alertA, alertB]);

    const dataBars = bars.filter((b) => !b.nodata);
    expect(dataBars.length).toBe(2);

    // Verify the first interval ends at 1200 (last real point), not 1100
    const firstInterval = dataBars[0] as any;
    expect(firstInterval.y.getTime() / 1000).toBe(1200);
  });

  it('should strip trailing padding from resolved alerts for accurate gap detection', () => {
    // Resolved alert A: real data [1000, 1300], trailing pad at 1600
    // Resolved alert B: real data [1900, 2200], trailing pad at 2500
    // Real gap: 1900 - 1300 = 600s = 10 min — should be detected
    const alertA = makeAlert({
      values: [
        [700, '2'],
        [1000, '2'],
        [1300, '2'],
        [1600, '2'],
      ],
      firstTimestamp: 700,
      resolved: true,
      alertstate: 'resolved',
    });

    const alertB = makeAlert({
      values: [
        [1600, '2'],
        [1900, '2'],
        [2200, '2'],
        [2500, '2'],
      ],
      firstTimestamp: 1600,
      resolved: true,
      alertstate: 'resolved',
    });

    const bars = createAlertsChartBars([alertA, alertB]);

    const dataBars = bars.filter((b) => !b.nodata);
    const nodataBars = bars.filter((b) => b.nodata);

    expect(dataBars.length).toBe(2);
    expect(nodataBars.length).toBe(1);
  });
});
