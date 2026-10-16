import {
  capitalize,
  durationFromTimestamp,
  getPaginationRange,
  millisecondsFromDuration,
  msToNs,
  notEmptyString,
  ONE_HOUR_IN_NS,
  valueWithScalePrefix,
} from '@/features/logging/value-utils';

describe('value utils', () => {
  it('should add the propoer prefix to the value', () => {
    expect(valueWithScalePrefix(90)).toBe('90');
    expect(valueWithScalePrefix(1000)).toBe('1k');
    expect(valueWithScalePrefix(1000000)).toBe('1M');
    expect(valueWithScalePrefix(1100000)).toBe('1.1M');
    expect(valueWithScalePrefix(2340)).toBe('2.3k');
  });

  it('should create a duration value from a timestamp', () => {
    expect(durationFromTimestamp(1000)).toBe('1s');
    expect(durationFromTimestamp(60000)).toBe('1m');
    expect(durationFromTimestamp(6730000000)).toBe('11w 21h 26m 40s');
    expect(durationFromTimestamp(-1)).toBe('');
  });

  it('should return milliseconds of a duration', () => {
    expect(millisecondsFromDuration('1s')).toBe(1000);
    expect(millisecondsFromDuration('1m')).toBe(60000);
    expect(millisecondsFromDuration('11w 21h 26m 40s')).toBe(6730000000);
    expect(millisecondsFromDuration('-1')).toBe(0);
    expect(millisecondsFromDuration('1x')).toBe(0);
  });

  it('should validate a notEmptyString', () => {
    expect(notEmptyString('foo')).toBe(true);
    expect(notEmptyString('')).toBe(false);
    expect(notEmptyString(undefined)).toBe(false);
  });

  it('should capitalize a string', () => {
    expect(capitalize('foo')).toBe('Foo');
    expect(capitalize('')).toBe('');
    expect(capitalize('123')).toBe('123');
    expect(capitalize()).toBe('');
  });

  it('should convert milliseconds to nanosecond strings', () => {
    expect(msToNs(0)).toBe('0');
    expect(msToNs(1)).toBe('1000000');
    expect(msToNs(1000)).toBe('1000000000');
    expect(msToNs(1666003060000)).toBe('1666003060000000000');
    expect(msToNs(1000.7)).toBe('1001000000');
    expect(msToNs(1000.3)).toBe('1000000000');
  });

  describe('getPaginationRange', () => {
    const lastTs = '1666003060000000000';
    const last = BigInt(lastTs);

    it('uses an exclusive upper bound when paginating backward to avoid overlap', () => {
      const { startNs, endNs } = getPaginationRange(lastTs, 'backward');

      // end must exclude the oldest visible entry (last - 1ns), not re-include it
      expect(endNs).toBe(String(last - 1n));
      expect(startNs).toBe(String(last - ONE_HOUR_IN_NS));
    });

    it('uses an exclusive lower bound when paginating forward to avoid overlap', () => {
      const { startNs, endNs } = getPaginationRange(lastTs, 'forward');

      expect(startNs).toBe(String(last + 1n));
      expect(endNs).toBe(String(last + ONE_HOUR_IN_NS));
    });

    it('honors a custom span', () => {
      const span = 2n * ONE_HOUR_IN_NS;
      expect(getPaginationRange(lastTs, 'backward', span).startNs).toBe(String(last - span));
      expect(getPaginationRange(lastTs, 'forward', span).endNs).toBe(String(last + span));
    });
  });
});
