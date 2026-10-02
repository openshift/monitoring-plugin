import { AlertSeverity, AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';

import { alertingRuleStateSort, parseLocalDateTime, severitySort } from '@/shared/utils/utils';

const makeRule = (alerts: { state: AlertStates }[]): Rule => ({ alerts }) as unknown as Rule;

describe('alertingRuleStateSort', () => {
  it('should return 0 for rules with identical alert counts', () => {
    const a = makeRule([{ state: AlertStates.Firing }]);
    const b = makeRule([{ state: AlertStates.Firing }]);
    expect(alertingRuleStateSort(a, b)).toBe(0);
  });

  it('should sort rules with more firing alerts first (negative)', () => {
    const moreFiring = makeRule([{ state: AlertStates.Firing }, { state: AlertStates.Firing }]);
    const lessFiring = makeRule([{ state: AlertStates.Firing }]);
    expect(alertingRuleStateSort(moreFiring, lessFiring)).toBeLessThan(0);
  });

  it('should tiebreak on pending when firing counts are equal', () => {
    const morePending = makeRule([
      { state: AlertStates.Firing },
      { state: AlertStates.Pending },
      { state: AlertStates.Pending },
    ]);
    const lessPending = makeRule([{ state: AlertStates.Firing }, { state: AlertStates.Pending }]);
    expect(alertingRuleStateSort(morePending, lessPending)).toBeLessThan(0);
  });

  it('should tiebreak on silenced when firing and pending are equal', () => {
    const moreSilenced = makeRule([
      { state: AlertStates.Firing },
      { state: AlertStates.Silenced },
      { state: AlertStates.Silenced },
    ]);
    const lessSilenced = makeRule([{ state: AlertStates.Firing }, { state: AlertStates.Silenced }]);
    expect(alertingRuleStateSort(moreSilenced, lessSilenced)).toBeLessThan(0);
  });

  it('should return 0 for two rules with no alerts', () => {
    expect(alertingRuleStateSort(makeRule([]), makeRule([]))).toBe(0);
  });

  it('should sort rule with alerts before rule without', () => {
    const withAlerts = makeRule([{ state: AlertStates.Firing }]);
    const withoutAlerts = makeRule([]);
    expect(alertingRuleStateSort(withAlerts, withoutAlerts)).toBeLessThan(0);
  });
});

describe('severitySort', () => {
  const makeSeverity = (severity: string) => ({ labels: { severity } }) as unknown as Rule;

  it('should return 0 for equal severities', () => {
    expect(severitySort(makeSeverity('critical'), makeSeverity('critical'))).toBe(0);
    expect(severitySort(makeSeverity('warning'), makeSeverity('warning'))).toBe(0);
  });

  it('should sort critical above warning', () => {
    expect(severitySort(makeSeverity('critical'), makeSeverity('warning'))).toBeLessThan(0);
    expect(severitySort(makeSeverity('warning'), makeSeverity('critical'))).toBeGreaterThan(0);
  });

  it('should sort warning above info', () => {
    expect(severitySort(makeSeverity('warning'), makeSeverity('info'))).toBeLessThan(0);
    expect(severitySort(makeSeverity('info'), makeSeverity('warning'))).toBeGreaterThan(0);
  });

  it('should sort critical above none', () => {
    expect(severitySort(makeSeverity('critical'), makeSeverity('none'))).toBeLessThan(0);
    expect(severitySort(makeSeverity('none'), makeSeverity('critical'))).toBeGreaterThan(0);
  });

  it('should sort info above none', () => {
    expect(severitySort(makeSeverity('info'), makeSeverity('none'))).toBeLessThan(0);
    expect(severitySort(makeSeverity('none'), makeSeverity('info'))).toBeGreaterThan(0);
  });

  it('should handle objects with severity property (AggregatedAlert shape)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = { severity: AlertSeverity.Critical } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = { severity: AlertSeverity.Warning } as any;
    expect(severitySort(a, b)).toBeLessThan(0);
  });

  it('should handle missing severity labels as empty string', () => {
    const noSeverity = { labels: {} } as unknown as Rule;
    const withSeverity = makeSeverity('critical');
    expect(severitySort(withSeverity, noSeverity)).toBeLessThan(0);
  });

  it('should produce a stable sort order across all known severities', () => {
    const items = [
      makeSeverity('none'),
      makeSeverity('critical'),
      makeSeverity('info'),
      makeSeverity('warning'),
    ];
    const sorted = [...items].sort(severitySort);
    const severities = sorted.map((i) => i.labels.severity);
    expect(severities).toEqual(['critical', 'warning', 'info', 'none']);
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
