import {
  DateFormat,
  dateToFormat,
  getBrowserTimezone,
  getTimezoneOffset,
  normalizeTimezone,
  parseInTimezone,
} from '@/features/logging/date-utils';

const mockDate = new Date('2023-02-22T08:38:36Z');
const mockDateWithMillis = new Date('2023-02-22T08:38:36.001Z');
const mockDateWithValuesUnderTen = new Date('2023-02-02T08:08:06.001Z');
const invalidDate = new Date('2023-02-22T24:38:36.001Z');

describe('date utils', () => {
  it('should format a date correctly', () => {
    [
      { format: DateFormat.DateMed, output: '2023-02-22' },
      { format: DateFormat.Full, output: 'Feb 22, 2023, 08:38:36.000' },
      { format: DateFormat.TimeFull, output: '08:38:36.000' },
      { format: DateFormat.TimeMed, output: '08:38:36' },
      { format: DateFormat.TimeShort, output: '08:38' },
    ].forEach(({ format, output }) => {
      expect(dateToFormat(mockDate, format, 'UTC')).toEqual(output);
    });
  });

  it('should format a date with milliseconds correctly', () => {
    [
      { format: DateFormat.DateMed, output: '2023-02-22' },
      { format: DateFormat.Full, output: 'Feb 22, 2023, 08:38:36.001' },
      { format: DateFormat.TimeFull, output: '08:38:36.001' },
      { format: DateFormat.TimeMed, output: '08:38:36' },
      { format: DateFormat.TimeShort, output: '08:38' },
    ].forEach(({ format, output }) => {
      expect(dateToFormat(mockDateWithMillis, format, 'UTC')).toEqual(output);
    });
  });

  it('should format a date with values lower than 10 correctly', () => {
    [
      { format: DateFormat.DateMed, output: '2023-02-02' },
      { format: DateFormat.Full, output: 'Feb 2, 2023, 08:08:06.001' },
      { format: DateFormat.TimeFull, output: '08:08:06.001' },
      { format: DateFormat.TimeMed, output: '08:08:06' },
      { format: DateFormat.TimeShort, output: '08:08' },
    ].forEach(({ format, output }) => {
      expect(dateToFormat(mockDateWithValuesUnderTen, format, 'UTC')).toEqual(output);
    });
  });

  it('should return invalid date when the date is invalid', () => {
    expect(dateToFormat(invalidDate, DateFormat.DateMed)).toEqual('invalid date');
  });

  it('should format a date in a specific timezone', () => {
    // 08:38:36 UTC = 03:38:36 in America/New_York (EST, UTC-5)
    const utcDate = new Date('2023-02-22T08:38:36Z');
    expect(dateToFormat(utcDate, DateFormat.TimeMed, 'America/New_York')).toEqual('03:38:36');
    expect(dateToFormat(utcDate, DateFormat.TimeMed, 'UTC')).toEqual('08:38:36');

    // 08:38:36 UTC = 14:08:36 in Asia/Kolkata (IST, UTC+5:30)
    expect(dateToFormat(utcDate, DateFormat.TimeMed, 'Asia/Kolkata')).toEqual('14:08:36');
  });

  it('should format DateMed in a specific timezone', () => {
    // 2023-02-22T02:00:00 UTC = 2023-02-21 21:00 in America/New_York
    const utcDate = new Date('2023-02-22T02:00:00Z');
    expect(dateToFormat(utcDate, DateFormat.DateMed, 'America/New_York')).toEqual('2023-02-21');
    expect(dateToFormat(utcDate, DateFormat.DateMed, 'UTC')).toEqual('2023-02-22');
  });
});

describe('normalizeTimezone', () => {
  it('should return undefined for empty string', () => {
    expect(normalizeTimezone('')).toBeUndefined();
  });

  it('should return undefined for whitespace-only string', () => {
    expect(normalizeTimezone('   ')).toBeUndefined();
  });

  it('should return undefined for undefined input', () => {
    expect(normalizeTimezone(undefined)).toBeUndefined();
  });

  it('should return the timezone for valid string', () => {
    expect(normalizeTimezone('UTC')).toEqual('UTC');
    expect(normalizeTimezone('America/New_York')).toEqual('America/New_York');
  });

  it('should trim whitespace from valid timezone', () => {
    expect(normalizeTimezone('  UTC  ')).toEqual('UTC');
  });
});

describe('getBrowserTimezone', () => {
  it('should return a non-empty string', () => {
    const tz = getBrowserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  it('should return a valid IANA timezone identifier', () => {
    const tz = getBrowserTimezone();
    // Valid IANA timezones contain a slash (e.g., "America/New_York") or are "UTC"
    expect(tz === 'UTC' || tz.includes('/')).toBe(true);
  });
});

describe('getTimezoneOffset', () => {
  const testDate = new Date('2023-02-22T12:00:00Z');

  it('should return offset for UTC', () => {
    const result = getTimezoneOffset('UTC', testDate);
    expect(result.offsetMinutes).toEqual(0);
    expect(result.label).toMatch(/GMT|UTC/);
  });

  it('should return negative offset for America/New_York (EST)', () => {
    const result = getTimezoneOffset('America/New_York', testDate);
    // EST is UTC-5 = -300 minutes
    expect(result.offsetMinutes).toEqual(-300);
    expect(result.label).toMatch(/GMT-0?5(:00)?/);
  });

  it('should return positive offset for Asia/Kolkata', () => {
    const result = getTimezoneOffset('Asia/Kolkata', testDate);
    // IST is UTC+5:30 = +330 minutes
    expect(result.offsetMinutes).toEqual(330);
    expect(result.label).toMatch(/GMT\+0?5:30/);
  });

  it('should return positive offset for Europe/Paris (CET)', () => {
    const result = getTimezoneOffset('Europe/Paris', testDate);
    // CET is UTC+1 = +60 minutes (in February, no DST)
    expect(result.offsetMinutes).toEqual(60);
  });

  it('should return empty result for empty timezone', () => {
    const result = getTimezoneOffset('');
    expect(result.label).toEqual('');
    expect(result.offsetMinutes).toEqual(0);
  });

  it('should return empty result for invalid timezone', () => {
    const result = getTimezoneOffset('Invalid/Timezone');
    expect(result.label).toEqual('');
    expect(result.offsetMinutes).toEqual(0);
  });
});

describe('parseInTimezone', () => {
  it('should return NaN for invalid date string', () => {
    expect(parseInTimezone('invalid', '12:00:00', 'UTC')).toBeNaN();
    expect(parseInTimezone('2023-02-22', 'invalid', 'UTC')).toBeNaN();
  });

  it('should parse date/time in UTC correctly', () => {
    const result = parseInTimezone('2023-02-22', '12:00:00', 'UTC');
    const expected = new Date('2023-02-22T12:00:00Z').getTime();
    expect(result).toEqual(expected);
  });

  it('should parse date/time in America/New_York correctly', () => {
    // 12:00 in New York (EST, UTC-5) = 17:00 UTC
    const result = parseInTimezone('2023-02-22', '12:00:00', 'America/New_York');
    const expected = new Date('2023-02-22T17:00:00Z').getTime();
    expect(result).toEqual(expected);
  });

  it('should parse date/time in Asia/Kolkata correctly', () => {
    // 12:00 in Kolkata (IST, UTC+5:30) = 06:30 UTC
    const result = parseInTimezone('2023-02-22', '12:00:00', 'Asia/Kolkata');
    const expected = new Date('2023-02-22T06:30:00Z').getTime();
    expect(result).toEqual(expected);
  });

  it('should handle milliseconds in time string', () => {
    const result = parseInTimezone('2023-02-22', '12:00:00.500', 'UTC');
    const expected = new Date('2023-02-22T12:00:00.500Z').getTime();
    expect(result).toEqual(expected);
  });

  it('should use browser timezone when timezone is empty', () => {
    const browserTz = getBrowserTimezone();
    const resultEmpty = parseInTimezone('2023-02-22', '12:00:00', '');
    const resultBrowser = parseInTimezone('2023-02-22', '12:00:00', browserTz);
    expect(resultEmpty).toEqual(resultBrowser);
  });

  it('should handle date boundaries correctly', () => {
    // 01:00 in New York (EST, UTC-5) = 06:00 UTC same day
    const result1 = parseInTimezone('2023-02-22', '01:00:00', 'America/New_York');
    const expected1 = new Date('2023-02-22T06:00:00Z').getTime();
    expect(result1).toEqual(expected1);

    // 23:00 in Kolkata (IST, UTC+5:30) = 17:30 UTC same day
    const result2 = parseInTimezone('2023-02-22', '23:00:00', 'Asia/Kolkata');
    const expected2 = new Date('2023-02-22T17:30:00Z').getTime();
    expect(result2).toEqual(expected2);
  });
});
