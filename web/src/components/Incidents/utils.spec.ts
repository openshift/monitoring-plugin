import {
  getCurrentTime,
  insertPaddingPointsForChart, roundDateToInterval,
  matchTimestampMetricForIncident,
  roundTimestampToFiveMinutes,
} from './utils';

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
    // Mock Date.now() to return a specific time
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

describe('matchTimestampMetricForIncident', () => {
  it('should match timestamp metric when all labels match', () => {
    const incident = {
      group_id: 'group1',
      src_alertname: 'TestAlert',
      src_namespace: 'test-namespace',
      component: 'test-component',
      src_severity: 'critical',
    };

    const timestamps = [
      {
        metric: {
          group_id: 'group1',
          src_alertname: 'TestAlert',
          src_namespace: 'test-namespace',
          component: 'test-component',
          src_severity: 'critical',
        },
        value: [1704067200, '1704067200'],
      },
      {
        metric: {
          group_id: 'group2',
          src_alertname: 'OtherAlert',
          src_namespace: 'other-namespace',
          component: 'other-component',
          src_severity: 'warning',
        },
        value: [1704067300, '1704067300'],
      },
    ];

    const result = matchTimestampMetricForIncident(incident, timestamps);
    expect(result).toBe(timestamps[0]);
  });

  it('should return undefined when no match is found', () => {
    const incident = {
      group_id: 'group1',
      src_alertname: 'TestAlert',
      src_namespace: 'test-namespace',
      component: 'test-component',
      src_severity: 'critical',
    };

    const timestamps = [
      {
        metric: {
          group_id: 'group2',
          src_alertname: 'OtherAlert',
          src_namespace: 'other-namespace',
          component: 'other-component',
          src_severity: 'warning',
        },
        value: [1704067300, '1704067300'],
      },
    ];

    const result = matchTimestampMetricForIncident(incident, timestamps);
    expect(result).toBeUndefined();
  });

  const incident = {
    group_id: 'group1',
    src_alertname: 'Alert1',
    src_namespace: 'ns1',
    component: 'comp1',
    src_severity: 'warning',
  };

  const timestamps = [
    {
      metric: {
        group_id: 'group1',
        src_alertname: 'Alert1',
        src_namespace: 'ns1',
        component: 'comp1',
        src_severity: 'warning',
      },
      value: [1704067200, '1704067200'],
    },
  ];

  const result = matchTimestampMetricForIncident(incident, timestamps);
  expect(result).toBe(timestamps[0]);
});

it('should not match when group_id differs', () => {
  const incident = {
    group_id: 'group1',
    src_alertname: 'TestAlert',
    src_namespace: 'test-namespace',
    component: 'test-component',
    src_severity: 'critical',
  };

  const timestamps = [
    {
      metric: {
        group_id: 'group2', // Different
        src_alertname: 'TestAlert',
        src_namespace: 'test-namespace',
        component: 'test-component',
        src_severity: 'critical',
      },
      value: [1704067200, '1704067200'],
    },
  ];

  const result = matchTimestampMetricForIncident(incident, timestamps);
  expect(result).toBeUndefined();
});

it('should not match when src_alertname differs', () => {
  const incident = {
    group_id: 'group1',
    src_alertname: 'TestAlert',
    src_namespace: 'test-namespace',
    component: 'test-component',
    src_severity: 'critical',
  };

  const timestamps = [
    {
      metric: {
        group_id: 'group1',
        src_alertname: 'OtherAlert', // Different
        src_namespace: 'test-namespace',
        component: 'test-component',
        src_severity: 'critical',
      },
      value: [1704067200, '1704067200'],
    },
  ];

  const result = matchTimestampMetricForIncident(incident, timestamps);
  expect(result).toBeUndefined();
});

it('should not match when component differs', () => {
  const incident = {
    group_id: 'group1',
    src_alertname: 'TestAlert',
    src_namespace: 'test-namespace',
    component: 'test-component',
    src_severity: 'critical',
  };

  const timestamps = [
    {
      metric: {
        group_id: 'group1',
        src_alertname: 'TestAlert',
        src_namespace: 'test-namespace',
        component: 'other-component', // Different
        src_severity: 'critical',
      },
      value: [1704067200, '1704067200'],
    },
  ];

  const result = matchTimestampMetricForIncident(incident, timestamps);
  expect(result).toBeUndefined();
});

it('should handle empty timestamps array', () => {
  const incident = {
    group_id: 'group1',
    src_alertname: 'TestAlert',
    src_namespace: 'test-namespace',
    component: 'test-component',
    src_severity: 'critical',
  };

  const result = matchTimestampMetricForIncident(incident, []);
  expect(result).toBeUndefined();
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
