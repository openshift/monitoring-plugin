jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

import { AlertSeverity, AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { alertingRuleStateSort, severitySort } from './utils';

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
    expect(severitySort(makeSeverity('critical'), makeSeverity('warning'))).toBeGreaterThan(0);
    expect(severitySort(makeSeverity('warning'), makeSeverity('critical'))).toBeLessThan(0);
  });

  it('should sort warning above info', () => {
    expect(severitySort(makeSeverity('warning'), makeSeverity('info'))).toBeGreaterThan(0);
    expect(severitySort(makeSeverity('info'), makeSeverity('warning'))).toBeLessThan(0);
  });

  it('should sort critical above none', () => {
    expect(severitySort(makeSeverity('critical'), makeSeverity('none'))).toBeGreaterThan(0);
    expect(severitySort(makeSeverity('none'), makeSeverity('critical'))).toBeLessThan(0);
  });

  it('should sort info above none', () => {
    expect(severitySort(makeSeverity('info'), makeSeverity('none'))).toBeGreaterThan(0);
    expect(severitySort(makeSeverity('none'), makeSeverity('info'))).toBeLessThan(0);
  });

  it('should handle objects with severity property (AggregatedAlert shape)', () => {
    const a = { severity: AlertSeverity.Critical } as any;
    const b = { severity: AlertSeverity.Warning } as any;
    expect(severitySort(a, b)).toBeGreaterThan(0);
  });

  it('should handle missing severity labels as empty string', () => {
    const noSeverity = { labels: {} } as unknown as Rule;
    const withSeverity = makeSeverity('critical');
    expect(severitySort(withSeverity, noSeverity)).toBeGreaterThan(0);
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
    expect(severities).toEqual(['none', 'info', 'warning', 'critical']);
  });
});
