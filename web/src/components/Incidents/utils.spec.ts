import { insertPaddingPointsForChart } from './utils';

describe('insertPaddingPointsForChart', () => {
  describe('edge cases', () => {
    it('should return empty array when input is empty', () => {
      const result = insertPaddingPointsForChart([]);
      expect(result).toEqual([]);
    });

    it('should handle a single data point', () => {
      const input: Array<[number, string]> = [[1000, 'critical']];
      const result = insertPaddingPointsForChart(input);

      // Should add padding point 5 minutes (300 seconds) before the single point
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([700, 'critical']); // 1000 - 300 = 700
      expect(result[1]).toEqual([1000, 'critical']);
    });
  });

  describe('continuous sequences (no gaps)', () => {
    it('should only add padding before first point when all points are within 5 minutes', () => {
      const input: Array<[number, string]> = [
        [1000, 'warning'],
        [1100, 'warning'], // 100 seconds later (< 5 min)
        [1200, 'warning'], // 100 seconds later (< 5 min)
      ];
      const result = insertPaddingPointsForChart(input);

      // Should have 4 points: 1 padding + 3 original
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
      const result = insertPaddingPointsForChart(input);

      // At threshold (300s), should NOT create a gap
      // Only padding before first point
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([700, 'info']); // Padding before first
      expect(result[1]).toEqual([1000, 'info']);
      expect(result[2]).toEqual([1300, 'info']);
    });
  });

  describe('sequences with gaps', () => {
    it('should add padding point before a gap > 5 minutes', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [1500, 'critical'], // 500 seconds later (> 5 min threshold of 301s)
      ];
      const result = insertPaddingPointsForChart(input);

      // Should have: padding before first + first point + padding before gap + second point
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([700, 'critical']); // Padding before first
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1200, 'critical']); // Padding before gap: 1500 - 300
      expect(result[3]).toEqual([1500, 'critical']);
    });

    it('should add padding point when gap is exactly threshold + 1 second', () => {
      const input: Array<[number, string]> = [
        [1000, 'warning'],
        [1302, 'warning'], // 302 seconds later (> threshold of 301)
      ];
      const result = insertPaddingPointsForChart(input);

      // Should detect gap since it's > threshold (301s)
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([700, 'warning']); // Padding before first
      expect(result[1]).toEqual([1000, 'warning']);
      expect(result[2]).toEqual([1002, 'warning']); // Padding before gap: 1302 - 300
      expect(result[3]).toEqual([1302, 'warning']);
    });

    it('should NOT add padding when gap is exactly at threshold (301s)', () => {
      const input: Array<[number, string]> = [
        [1000, 'warning'],
        [1301, 'warning'], // 301 seconds later (= threshold, not > threshold)
      ];
      const result = insertPaddingPointsForChart(input);

      // Should NOT detect gap since 301 is not > 301
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([700, 'warning']); // Padding before first
      expect(result[1]).toEqual([1000, 'warning']);
      expect(result[2]).toEqual([1301, 'warning']); // No padding before this
    });

    it('should handle multiple gaps in sequence', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [2000, 'critical'], // Gap of 1000s
        [2100, 'warning'], // No gap (100s)
        [3000, 'info'], // Gap of 900s
      ];
      const result = insertPaddingPointsForChart(input);

      expect(result).toHaveLength(7);
      expect(result[0]).toEqual([700, 'critical']); // Padding before first
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1700, 'critical']); // Padding before first gap
      expect(result[3]).toEqual([2000, 'critical']);
      expect(result[4]).toEqual([2100, 'warning']); // No padding (continuous)
      expect(result[5]).toEqual([2700, 'info']); // Padding before second gap
      expect(result[6]).toEqual([3000, 'info']);
    });
  });

  describe('severity handling', () => {
    it('should preserve severity values in padding points', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [2000, 'warning'],
      ];
      const result = insertPaddingPointsForChart(input);

      // Padding points should have same severity as the point they precede
      expect(result[0][1]).toBe('critical'); // Padding before first critical
      expect(result[1][1]).toBe('critical'); // Original critical
      expect(result[2][1]).toBe('warning'); // Padding before warning (due to gap)
      expect(result[3][1]).toBe('warning'); // Original warning
    });

    it('should handle different severity types', () => {
      const input: Array<[number, string]> = [
        [1000, '2'], // Critical (numeric)
        [1100, '1'], // Warning (numeric)
        [1200, '0'], // Info (numeric)
      ];
      const result = insertPaddingPointsForChart(input);

      expect(result[0]).toEqual([700, '2']); // Padding preserves severity
      expect(result[1]).toEqual([1000, '2']);
      expect(result[2]).toEqual([1100, '1']);
      expect(result[3]).toEqual([1200, '0']);
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
      const result = insertPaddingPointsForChart(input);

      expect(result).toHaveLength(9);
      expect(result[0]).toEqual([700, 'critical']); // Initial padding
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1100, 'critical']);
      expect(result[3]).toEqual([1200, 'critical']);
      expect(result[4]).toEqual([1700, 'warning']); // Padding before gap
      expect(result[5]).toEqual([2000, 'warning']);
      expect(result[6]).toEqual([2100, 'warning']);
      expect(result[7]).toEqual([2700, 'info']); // Padding before gap
      expect(result[8]).toEqual([3000, 'info']);
    });

    it('should handle very large timestamps', () => {
      const input: Array<[number, string]> = [
        [1704067200, 'critical'], // 2024-01-01 00:00:00 UTC
        [1704067500, 'critical'], // 5 minutes later
      ];
      const result = insertPaddingPointsForChart(input);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([1704066900, 'critical']); // 5 min before first
      expect(result[1]).toEqual([1704067200, 'critical']);
      expect(result[2]).toEqual([1704067500, 'critical']);
    });

    it('should preserve original array order', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [1100, 'warning'],
        [1200, 'info'],
      ];
      const result = insertPaddingPointsForChart(input);

      // Verify timestamps are in ascending order
      for (let i = 1; i < result.length; i++) {
        expect(result[i][0]).toBeGreaterThan(result[i - 1][0]);
      }
    });
  });

  describe('boundary conditions', () => {
    it('should handle points at minimum timestamp (0)', () => {
      const input: Array<[number, string]> = [[0, 'critical']];
      const result = insertPaddingPointsForChart(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([-300, 'critical']); // Negative timestamp is valid
      expect(result[1]).toEqual([0, 'critical']);
    });

    it('should handle very small time differences', () => {
      const input: Array<[number, string]> = [
        [1000, 'critical'],
        [1001, 'critical'], // 1 second apart
      ];
      const result = insertPaddingPointsForChart(input);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([700, 'critical']); // Only initial padding
      expect(result[1]).toEqual([1000, 'critical']);
      expect(result[2]).toEqual([1001, 'critical']);
    });
  });
});
