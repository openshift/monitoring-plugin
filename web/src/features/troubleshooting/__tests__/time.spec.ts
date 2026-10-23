import {
  copyTime,
  Duration,
  END_NOW_TOLERANCE_MS,
  formatDate,
  isValidDate,
  parseRange,
  periodFrom,
  Range,
  SECOND,
  setTime,
  Unit,
  units,
} from '../time';

describe('Range', () => {
  it('constructs', () => {
    const [start, end] = [new Date(1969, 3, 21), new Date(1969, 3, 22)];
    const range = new Range(start, end);
    expect(range.startEnd()).toEqual([start, end]);
  });

  it('swaps start/end if reversed', () => {
    const [start, end] = [new Date(1969, 3, 22), new Date(1969, 3, 21)];
    const range = new Range(start, end);
    expect(range.startEnd()).toEqual([end, start]);
  });
});

describe('parseRange', () => {
  it('parses start and end millisecond timestamps', () => {
    const range = parseRange('1000', '2000');
    expect(range).toEqual(new Range(new Date(1000), new Date(2000)));
  });

  it('defaults end to now when omitted', () => {
    const before = Date.now();
    const range = parseRange('1000');
    const after = Date.now();
    expect(range?.start).toEqual(new Date(1000));
    expect(range?.end.getTime()).toBeGreaterThanOrEqual(before);
    expect(range?.end.getTime()).toBeLessThanOrEqual(after);
  });

  it('applies a scale factor, e.g. seconds to milliseconds', () => {
    const range = parseRange('1', '2', 1000);
    expect(range).toEqual(new Range(new Date(1000), new Date(2000)));
  });

  it('returns undefined when start is missing', () => {
    expect(parseRange(undefined, '2000')).toBeUndefined();
    expect(parseRange('', '2000')).toBeUndefined();
  });

  it('returns undefined when start or end is not numeric', () => {
    expect(parseRange('not-a-number', '2000')).toBeUndefined();
    expect(parseRange('1000', 'not-a-number')).toBeUndefined();
  });
});

describe('periodFrom', () => {
  it('returns undefined when start is missing', () => {
    expect(periodFrom(undefined as unknown as Date, new Date())).toBeUndefined();
  });

  it('returns undefined when end is before start', () => {
    const start = new Date(2024, 0, 2);
    const end = new Date(2024, 0, 1);
    expect(periodFrom(start, end)).toBeUndefined();
  });

  it('returns a Duration to now when end is omitted', () => {
    const start = new Date(Date.now() - 10 * Unit.MINUTE);
    const period = periodFrom(start, undefined as unknown as Date);
    expect(Duration.isDuration(period!)).toBe(true);
  });

  it('returns a Duration when end is within tolerance of now', () => {
    const end = new Date(Date.now() - (END_NOW_TOLERANCE_MS - 1000));
    const start = new Date(end.getTime() - Unit.HOUR);
    const period = periodFrom(start, end);
    expect(Duration.isDuration(period!)).toBe(true);
  });

  it('returns a Range when end is not close to now', () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 2);
    expect(periodFrom(start, end)).toEqual(new Range(start, end));
  });
});

describe('Duration', () => {
  it('constructs', () => {
    const duration = new Duration(1000, Unit.SECOND);
    const [start, end] = duration.startEnd();
    const now = Date.now();
    expect(duration.duration()).toEqual(1000 * SECOND);
    expect(end.getTime() - start.getTime()).toEqual(1000 * SECOND);
    expect(Math.floor(end.getTime() / 100)).toEqual(Math.floor(now / 100));
  });

  describe('parse', () => {
    it('parses seconds', () => {
      const d = Duration.parse('30s');
      expect(d).toBeDefined();
      expect(d!.count).toEqual(30);
      expect(d!.unit).toEqual(Unit.SECOND);
    });

    it('parses minutes', () => {
      const d = Duration.parse('5m');
      expect(d).toBeDefined();
      expect(d!.count).toEqual(5);
      expect(d!.unit).toEqual(Unit.MINUTE);
    });

    it('parses hours', () => {
      const d = Duration.parse('2h');
      expect(d).toBeDefined();
      expect(d!.count).toEqual(2);
      expect(d!.unit).toEqual(Unit.HOUR);
    });

    it('parses days', () => {
      const d = Duration.parse('7d');
      expect(d).toBeDefined();
      expect(d!.count).toEqual(7);
      expect(d!.unit).toEqual(Unit.DAY);
    });

    it('parses weeks', () => {
      const d = Duration.parse('2w');
      expect(d).toBeDefined();
      expect(d!.count).toEqual(2);
      expect(d!.unit).toEqual(Unit.WEEK);
    });

    it('parses with spaces between number and unit', () => {
      const d = Duration.parse('10 s');
      expect(d).toBeDefined();
      expect(d!.count).toEqual(10);
      expect(d!.unit).toEqual(Unit.SECOND);
    });

    it('returns undefined for empty string', () => {
      expect(Duration.parse('')).toBeUndefined();
    });

    it('returns undefined for null/undefined', () => {
      expect(Duration.parse(undefined as unknown as string)).toBeUndefined();
      expect(Duration.parse(null as unknown as string)).toBeUndefined();
    });

    it('returns undefined for invalid unit', () => {
      expect(Duration.parse('30x')).toBeUndefined();
    });

    it('returns undefined for no numeric value', () => {
      expect(Duration.parse('s')).toBeUndefined();
    });
  });

  describe('toString', () => {
    it.each([
      [1, Unit.SECOND, '1s'],
      [5, Unit.MINUTE, '5m'],
      [2, Unit.HOUR, '2h'],
      [7, Unit.DAY, '7d'],
      [2, Unit.WEEK, '2w'],
    ])('renders %d %s as %s', (count, unit, expected) => {
      expect(new Duration(count, unit).toString()).toEqual(expected);
    });

    it('round-trips through parse', () => {
      const d = new Duration(3, Unit.HOUR);
      expect(Duration.parse(d.toString())).toEqual(d);
    });
  });

  describe('milliseconds', () => {
    it('picks the largest unit that divides evenly', () => {
      expect(Duration.fromMilliseconds(2 * Unit.WEEK)).toEqual(new Duration(2, Unit.WEEK));
      expect(Duration.fromMilliseconds(3 * Unit.DAY)).toEqual(new Duration(3, Unit.DAY));
      expect(Duration.fromMilliseconds(90 * Unit.MINUTE)).toEqual(new Duration(90, Unit.MINUTE));
    });

    it('falls back to seconds, rounded, when nothing divides evenly', () => {
      expect(Duration.fromMilliseconds(1500)).toEqual(new Duration(2, Unit.SECOND));
    });
  });

  describe('since', () => {
    it('returns a Duration from start until now', () => {
      const start = new Date(Date.now() - 5 * Unit.MINUTE);
      const d = Duration.since(start);
      expect(d).toBeDefined();
      expect(d!.duration()).toBeGreaterThanOrEqual(5 * Unit.MINUTE - 1000);
    });

    it('returns undefined for no start', () => {
      expect(Duration.since(undefined as unknown as Date)).toBeUndefined();
    });
  });

  describe('isDuration', () => {
    it('distinguishes Duration from Range', () => {
      expect(Duration.isDuration(new Duration(1, Unit.HOUR))).toBe(true);
      expect(Duration.isDuration(new Range(new Date(0), new Date(1)))).toBe(false);
    });
  });
});

describe('Unit', () => {
  it('has correct values', () => {
    expect(Unit.SECOND).toEqual(1000);
    expect(Unit.MINUTE).toEqual(60 * 1000);
    expect(Unit.HOUR).toEqual(60 * 60 * 1000);
    expect(Unit.DAY).toEqual(24 * 60 * 60 * 1000);
    expect(Unit.WEEK).toEqual(7 * 24 * 60 * 60 * 1000);
  });

  it('units array contains all units in order', () => {
    expect(units).toEqual([Unit.SECOND, Unit.MINUTE, Unit.HOUR, Unit.DAY, Unit.WEEK]);
  });
});

describe('setTime', () => {
  it('sets time-of-day fields', () => {
    const date = new Date(2024, 5, 15, 0, 0, 0, 0);
    setTime(date, 10, 30, 45, 500);
    expect(date.getHours()).toEqual(10);
    expect(date.getMinutes()).toEqual(30);
    expect(date.getSeconds()).toEqual(45);
    expect(date.getMilliseconds()).toEqual(500);
  });

  it('defaults to midnight', () => {
    const date = new Date(2024, 5, 15, 13, 45, 30, 999);
    setTime(date);
    expect(date.getHours()).toEqual(0);
    expect(date.getMinutes()).toEqual(0);
    expect(date.getSeconds()).toEqual(0);
    expect(date.getMilliseconds()).toEqual(0);
  });

  it('returns the modified date', () => {
    const date = new Date(2024, 5, 15);
    const result = setTime(date, 8);
    expect(result).toBe(date);
  });

  it('does not modify an invalid date', () => {
    const invalid = new Date('invalid');
    const result = setTime(invalid, 10, 30);
    expect(result).toBe(invalid);
    expect(isNaN(result.getTime())).toBe(true);
  });
});

describe('copyTime', () => {
  it('copies time-of-day from one date to another', () => {
    const to = new Date(2024, 5, 15, 0, 0, 0, 0);
    const from = new Date(2020, 0, 1, 14, 25, 50, 123);
    copyTime(to, from);
    expect(to.getFullYear()).toEqual(2024);
    expect(to.getMonth()).toEqual(5);
    expect(to.getDate()).toEqual(15);
    expect(to.getHours()).toEqual(14);
    expect(to.getMinutes()).toEqual(25);
    expect(to.getSeconds()).toEqual(50);
    expect(to.getMilliseconds()).toEqual(123);
  });
});

describe('isValidDate', () => {
  it('returns true for valid dates', () => {
    expect(isValidDate(new Date())).toBe(true);
    expect(isValidDate(new Date(0))).toBe(true);
    expect(isValidDate(new Date(2024, 0, 1))).toBe(true);
  });

  it('returns false for invalid dates', () => {
    expect(isValidDate(new Date('invalid'))).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe('formatDate', () => {
  it('formats date as YYYY-MM-DD HH:MM', () => {
    const date = new Date(2024, 0, 5, 9, 3);
    expect(formatDate(date)).toEqual('2024-01-05 09:03');
  });

  it('pads single-digit values', () => {
    const date = new Date(2024, 2, 1, 1, 2);
    expect(formatDate(date)).toEqual('2024-03-01 01:02');
  });

  it('handles end of year', () => {
    const date = new Date(2024, 11, 31, 23, 59);
    expect(formatDate(date)).toEqual('2024-12-31 23:59');
  });
});
