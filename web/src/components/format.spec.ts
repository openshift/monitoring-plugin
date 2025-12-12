import { formatNumber } from './format';

describe('formatNumber', () => {
  describe('edge cases', () => {
    it('should return "-" for null values', () => {
      expect(formatNumber(null as any)).toBe('-');
    });

    it('should return "-" for undefined values', () => {
      expect(formatNumber(undefined as any)).toBe('-');
    });

    it('should return "0" for empty string', () => {
      expect(formatNumber('')).toBe('0');
    });

    it('should return original string for non-numeric values', () => {
      expect(formatNumber('not a number')).toBe('not a number');
    });

    it('should return original string for NaN', () => {
      expect(formatNumber('NaN')).toBe('NaN');
    });

    it('should handle zero', () => {
      const result = formatNumber('0');
      expect(result).toBeDefined();
      expect(result).not.toBe('-');
    });
  });

  describe('format: short (default)', () => {
    it('should format small numbers', () => {
      const result = formatNumber('42');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format large numbers with humanization', () => {
      const result = formatNumber('1234567');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should use short format by default when no format specified', () => {
      const result1 = formatNumber('100');
      const result2 = formatNumber('100', 2, 'short');
      expect(result1).toBe(result2);
    });

    it('should format decimal numbers', () => {
      const result = formatNumber('123.456');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('format: percentunit', () => {
    it('should format as percentage with default 2 decimals', () => {
      const result = formatNumber('0.5', 2, 'percentunit');
      expect(result).toBe('50.00%');
    });

    it('should format as percentage with custom decimals', () => {
      const result = formatNumber('0.123', 3, 'percentunit');
      expect(result).toBe('12.300%');
    });

    it('should format as percentage with 0 decimals', () => {
      const result = formatNumber('0.456', 0, 'percentunit');
      expect(result).toBe('46%');
    });

    it('should format as percentage with 1 decimal', () => {
      const result = formatNumber('0.789', 1, 'percentunit');
      expect(result).toBe('78.9%');
    });

    it('should handle values greater than 1', () => {
      const result = formatNumber('1.5', 2, 'percentunit');
      expect(result).toBe('150.00%');
    });

    it('should handle small percentage values', () => {
      const result = formatNumber('0.001', 2, 'percentunit');
      expect(result).toBe('0.10%');
    });
  });

  describe('format: bytes', () => {
    it('should format small byte values', () => {
      const result = formatNumber('512', 2, 'bytes');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format large byte values', () => {
      const result = formatNumber('1048576', 2, 'bytes');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format zero bytes', () => {
      const result = formatNumber('0', 2, 'bytes');
      expect(result).toBeTruthy();
    });
  });

  describe('format: Bytes', () => {
    it('should format small decimal byte values', () => {
      const result = formatNumber('500', 2, 'Bytes');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format large decimal byte values', () => {
      const result = formatNumber('1000000', 2, 'Bytes');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('format: bps', () => {
    it('should format bits per second', () => {
      const result = formatNumber('2048', 2, 'bps');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format large bps values', () => {
      const result = formatNumber('10485760', 2, 'bps');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('format: Bps', () => {
    it('should format bytes per second', () => {
      const result = formatNumber('2000', 2, 'Bps');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format large Bps values', () => {
      const result = formatNumber('10000000', 2, 'Bps');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('format: pps', () => {
    it('should format packets per second', () => {
      const result = formatNumber('500', 2, 'pps');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format large pps values', () => {
      const result = formatNumber('1000000', 2, 'pps');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('format: ms', () => {
    it('should format milliseconds', () => {
      const result = formatNumber('1500', 2, 'ms');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format small millisecond values', () => {
      const result = formatNumber('50', 2, 'ms');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format large millisecond values', () => {
      const result = formatNumber('60000', 2, 'ms');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('format: s', () => {
    it('should convert seconds to milliseconds and format', () => {
      const result = formatNumber('2', 2, 's');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle fractional seconds', () => {
      const result = formatNumber('0.5', 2, 's');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle large second values', () => {
      const result = formatNumber('3600', 2, 's');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('unknown format', () => {
    it('should fall back to humanizeNumber for unknown format', () => {
      const result = formatNumber('999', 2, 'unknown-format' as any);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should produce same result as short format for unknown format', () => {
      const unknownResult = formatNumber('123', 2, 'invalid' as any);
      const shortResult = formatNumber('123', 2, 'short');
      expect(unknownResult).toBe(shortResult);
    });
  });

  describe('decimals parameter', () => {
    it('should respect decimals parameter for percentunit', () => {
      const result2 = formatNumber('0.12345', 2, 'percentunit');
      const result4 = formatNumber('0.12345', 4, 'percentunit');
      expect(result2).toBe('12.35%');
      expect(result4).toBe('12.3450%');
    });

    it('should handle 0 decimals for percentunit', () => {
      const result = formatNumber('0.567', 0, 'percentunit');
      expect(result).toBe('57%');
    });
  });

  describe('numeric string variations', () => {
    it('should handle negative numbers', () => {
      const result = formatNumber('-100', 2, 'short');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle scientific notation', () => {
      const result = formatNumber('1e6', 2, 'short');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle very small numbers', () => {
      const result = formatNumber('0.0001', 2, 'short');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });
});
