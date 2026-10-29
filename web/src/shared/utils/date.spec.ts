import { formatSilenceDate, padNumber, parseLocalDateTime } from '@/shared/utils/date';

describe('date formatting', () => {
  it('pads numbers to two digits', () => {
    expect(padNumber(0)).toBe('00');
    expect(padNumber(7)).toBe('07');
    expect(padNumber(12)).toBe('12');
  });

  it('formats silence dates with padded date and time fields', () => {
    expect(formatSilenceDate(new Date(2026, 8, 3, 4, 5, 6))).toBe('2026/09/03 04:05:06');
  });
});

describe('parseLocalDateTime', () => {
  it('parses a YYYY-MM-DD date and HH:MM time into a local-time epoch', () => {
    const result = parseLocalDateTime('2024-03-15', '14:30');
    expect(result).toBe(new Date(2024, 2, 15, 14, 30, 0).getTime());
  });

  it('parses an HH:MM:SS time including seconds', () => {
    const result = parseLocalDateTime('2024-03-15', '14:30:45');
    expect(result).toBe(new Date(2024, 2, 15, 14, 30, 45).getTime());
  });

  it('handles midnight and end-of-day boundary times', () => {
    expect(parseLocalDateTime('2024-01-01', '00:00')).toBe(new Date(2024, 0, 1, 0, 0, 0).getTime());
    expect(parseLocalDateTime('2024-12-31', '23:59')).toBe(
      new Date(2024, 11, 31, 23, 59, 0).getTime(),
    );
  });

  it('parses a leap-day date', () => {
    expect(parseLocalDateTime('2024-02-29', '12:00')).toBe(
      new Date(2024, 1, 29, 12, 0, 0).getTime(),
    );
  });

  it('parses a 0-99 year as that year, not 1900-1999', () => {
    const expected = new Date(2000, 2, 15, 14, 30, 0);
    expected.setFullYear(99);
    const result = parseLocalDateTime('0099-03-15', '14:30');
    expect(result).toBe(expected.getTime());
    expect(new Date(result).getFullYear()).toBe(99);
  });

  it('does not use Date.parse of a locale/concatenated string (result is locale-agnostic)', () => {
    expect(parseLocalDateTime('2024-06-01', '09:05')).toBe(new Date(2024, 5, 1, 9, 5, 0).getTime());
  });

  it.each([
    ['empty date', '', '14:30'],
    ['empty time', '2024-03-15', ''],
    ['non-numeric date', 'March 15 2024', '14:30'],
    ['non-numeric time', '2024-03-15', '2:30 PM'],
    ['partial date', '2024-03', '14:30'],
    ['partial time', '2024-03-15', '14'],
    ['extra time field', '2024-03-15', '14:30:00:99'],
    ['day out of range (Feb 30)', '2024-02-30', '14:30'],
    ['non-leap Feb 29', '2023-02-29', '14:30'],
    ['month out of range', '2024-13-01', '14:30'],
    ['day out of range', '2024-01-32', '14:30'],
    ['hour out of range', '2024-03-15', '25:00'],
    ['minute out of range', '2024-03-15', '14:60'],
    ['second out of range', '2024-03-15', '14:30:60'],
  ])('returns NaN for invalid input (%s)', (_label, dateString, timeString) => {
    expect(parseLocalDateTime(dateString, timeString)).toBeNaN();
  });

  it('returns NaN when inputs are undefined', () => {
    expect(
      parseLocalDateTime(undefined as unknown as string, undefined as unknown as string),
    ).toBeNaN();
  });
});
