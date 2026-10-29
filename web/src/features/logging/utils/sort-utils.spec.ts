import { bigIntDifference, numericComparator } from '@/features/logging/utils/sort-utils';

describe('numericComparator', () => {
  it('should return -1 when a < b with positive multiplier', () => {
    expect(numericComparator(1, 2, 1)).toBe(-1);
  });

  it('should return 1 when a > b with positive multiplier', () => {
    expect(numericComparator(2, 1, 1)).toBe(1);
  });

  it('should return 0 when a === b', () => {
    expect(numericComparator(1, 1, 1)).toBe(0);
  });

  it('should invert result with negative multiplier (descending sort)', () => {
    expect(numericComparator(1, 2, -1)).toBe(1);
    expect(numericComparator(2, 1, -1)).toBe(-1);
  });

  it('should use fallback comparison when values are equal', () => {
    expect(numericComparator(5, 5, 1, 3)).toBe(3);
    expect(numericComparator(5, 5, 1, -2)).toBe(-2);
  });

  it('should apply direction multiplier to fallback comparison', () => {
    expect(numericComparator(5, 5, -1, 3)).toBe(-3);
    expect(numericComparator(5, 5, -1, -2)).toBe(2);
  });

  it('should ignore fallback when values are not equal', () => {
    expect(numericComparator(1, 2, 1, 100)).toBe(-1);
    expect(numericComparator(2, 1, 1, 100)).toBe(1);
  });

  it('should work with timestamps', () => {
    const timestamp1 = 1679000000000;
    const timestamp2 = 1679000000001;
    expect(numericComparator(timestamp1, timestamp2, 1)).toBe(-1);
    expect(numericComparator(timestamp2, timestamp1, 1)).toBe(1);
    expect(numericComparator(timestamp1, timestamp1, 1)).toBe(0);
  });

  it('should use logIndex as tiebreaker for equal timestamps in ascending sort', () => {
    const timestamp = 1679000000000;
    const logs = [
      { timestamp, logIndex: 0 },
      { timestamp, logIndex: 1 },
      { timestamp, logIndex: 2 },
    ];

    const sortedAsc = [...logs].sort((a, b) =>
      numericComparator(a.timestamp, b.timestamp, 1, a.logIndex - b.logIndex),
    );
    expect(sortedAsc.map((l) => l.logIndex)).toEqual([0, 1, 2]);
  });

  it('should use logIndex as tiebreaker for equal timestamps in descending sort', () => {
    const timestamp = 1679000000000;
    const logs = [
      { timestamp, logIndex: 0 },
      { timestamp, logIndex: 1 },
      { timestamp, logIndex: 2 },
    ];

    const sortedDesc = [...logs].sort((a, b) =>
      numericComparator(a.timestamp, b.timestamp, -1, a.logIndex - b.logIndex),
    );
    expect(sortedDesc.map((l) => l.logIndex)).toEqual([2, 1, 0]);
  });
});

describe('observedTimestampDifference', () => {
  it('should return the numeric difference for small bigints', () => {
    expect(bigIntDifference(10n, 3n)).toBe(7);
    expect(bigIntDifference(3n, 10n)).toBe(-7);
  });

  it('should return 0 when both values are equal', () => {
    expect(bigIntDifference(42n, 42n)).toBe(0);
  });

  it('should clamp to MIN_SAFE_INTEGER when difference is too negative', () => {
    const a = 0n;
    const b = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(bigIntDifference(a, b)).toBe(Number.MIN_SAFE_INTEGER);
  });

  it('should clamp to MAX_SAFE_INTEGER when difference is too positive', () => {
    const a = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    const b = 0n;
    expect(bigIntDifference(a, b)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should not clamp when difference is exactly MAX_SAFE_INTEGER', () => {
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    expect(bigIntDifference(maxSafe, 0n)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should not clamp when difference is exactly MIN_SAFE_INTEGER', () => {
    const minSafe = BigInt(Number.MIN_SAFE_INTEGER);
    expect(bigIntDifference(minSafe, 0n)).toBe(Number.MIN_SAFE_INTEGER);
  });

  it('should clamp when difference is one past MAX_SAFE_INTEGER', () => {
    const pastMax = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(bigIntDifference(pastMax, 0n)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should clamp when difference is one past MIN_SAFE_INTEGER', () => {
    const pastMin = BigInt(Number.MIN_SAFE_INTEGER) - 1n;
    expect(bigIntDifference(pastMin, 0n)).toBe(Number.MIN_SAFE_INTEGER);
  });

  it('should handle realistic nanosecond timestamp differences', () => {
    const ts1 = 1679000000000000000n;
    const ts2 = 1679000000000000001n;
    expect(bigIntDifference(ts2, ts1)).toBe(1);
    expect(bigIntDifference(ts1, ts2)).toBe(-1);
  });

  it('should clamp when nanosecond timestamps are far apart', () => {
    const ts1 = 1679000000000000000n;
    const ts2 = 1579000000000000000n;
    expect(bigIntDifference(ts1, ts2)).toBe(Number.MAX_SAFE_INTEGER);
    expect(bigIntDifference(ts2, ts1)).toBe(Number.MIN_SAFE_INTEGER);
  });
});
