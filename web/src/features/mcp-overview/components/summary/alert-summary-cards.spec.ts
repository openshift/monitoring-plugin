jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

jest.mock('@patternfly/react-core', () => ({
  FlexItem: 'FlexItem',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/mcp-overview/components/summary/SummaryCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/shared/hooks/useAlerts', () => ({
  useAlerts: jest.fn(() => ({
    alerts: [],
    rules: [],
    rulesAlertLoading: { loaded: false },
  })),
}));

jest.mock('@/shared/hooks/usePerspective', () => ({
  usePerspective: jest.fn(() => ({
    perspective: 'admin',
    defaultAlertTenant: ['platform'],
  })),
  getAlertRulesUrl: jest.fn(() => '/monitoring/alertrules'),
  getAlertsUrl: jest.fn(() => '/monitoring/alerts'),
}));

import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import type { Alert, Rule } from '@openshift-console/dynamic-plugin-sdk';

import {
  getAlertsError,
  getAlertSummaryState,
  getFiringAlerts,
} from '@/features/mcp-overview/components/summary/AlertSummaryCards';
import { AlertSource } from '@/shared/types/types';

/** Minimal rule shape needed for tenant/source classification in fixtures. */
type AlertRuleFixture = Pick<Alert['rule'], 'labels' | 'sourceId'>;

type AlertFixture = Omit<Partial<Alert>, 'rule'> & {
  rule?: AlertRuleFixture;
};

const makeRule = (overrides: Partial<Rule> = {}): Rule =>
  ({
    alerts: [],
    labels: {},
    ...overrides,
  }) as unknown as Rule;

const platformRule = (overrides: Partial<Rule> = {}): Rule =>
  makeRule({
    labels: { prometheus: 'openshift-monitoring/k8s' },
    ...overrides,
  });

const userRule = (overrides: Partial<Rule> = {}): Rule =>
  makeRule({
    labels: {},
    ...overrides,
  });

const makeAlert = (overrides: AlertFixture = {}): Alert =>
  ({
    labels: {},
    state: AlertStates.Firing,
    rule: { labels: {} } satisfies AlertRuleFixture,
    ...overrides,
  }) as unknown as Alert;

const platformFiring = makeAlert({
  labels: {
    alertname: 'HighCPU',
    prometheus: 'openshift-monitoring/k8s',
  },
  state: AlertStates.Firing,
  rule: { labels: { prometheus: 'openshift-monitoring/k8s' } },
});

const userFiring = makeAlert({
  labels: { alertname: 'UserAlert' },
  state: AlertStates.Firing,
  rule: { labels: {} },
});

const pendingAlert = makeAlert({
  labels: {
    alertname: 'PendingAlert',
    prometheus: 'openshift-monitoring/k8s',
  },
  state: AlertStates.Pending,
  rule: { labels: { prometheus: 'openshift-monitoring/k8s' } },
});

describe('getAlertsError', () => {
  it('should return undefined when there is no load error', () => {
    expect(getAlertsError({ loaded: true })).toBeUndefined();
    expect(getAlertsError(undefined)).toBeUndefined();
  });

  it('should unwrap Error message from loadError', () => {
    expect(getAlertsError({ loaded: true, loadError: new Error('fetch failed') })).toBe(
      'fetch failed',
    );
  });

  it('should stringify string loadError values', () => {
    expect(getAlertsError({ loaded: true, loadError: 'boom' })).toBe('boom');
  });
});

describe('getFiringAlerts', () => {
  it('should return an empty list while loading', () => {
    expect(
      getFiringAlerts({
        alerts: [platformFiring],
        loaded: false,
        defaultAlertTenant: [AlertSource.Platform],
        perspective: 'admin',
      }),
    ).toEqual([]);
  });

  it('should return an empty list when there is an error', () => {
    expect(
      getFiringAlerts({
        alerts: [platformFiring],
        alertsError: 'fetch failed',
        loaded: true,
        defaultAlertTenant: [AlertSource.Platform],
        perspective: 'admin',
      }),
    ).toEqual([]);
  });

  it('should keep only firing alerts for the default tenant', () => {
    const firing = getFiringAlerts({
      alerts: [platformFiring, userFiring, pendingAlert],
      loaded: true,
      defaultAlertTenant: [AlertSource.Platform],
      perspective: 'admin',
    });

    expect(firing).toHaveLength(1);
    expect(firing[0].labels?.alertname).toBe('HighCPU');
  });
});

describe('getAlertSummaryState', () => {
  it('should report loading when useAlerts has not finished', () => {
    expect(
      getAlertSummaryState({
        alerts: [platformFiring],
        rules: [platformRule()],
        rulesAlertLoading: { loaded: false },
        defaultAlertTenant: [AlertSource.Platform],
        perspective: 'admin',
      }),
    ).toEqual({
      loading: true,
      error: undefined,
      rulesCount: 1,
      firingAlertsCount: 0,
    });
  });

  it('should report error state from useAlerts loadError', () => {
    expect(
      getAlertSummaryState({
        alerts: [platformFiring],
        rules: [platformRule(), platformRule()],
        rulesAlertLoading: { loaded: true, loadError: new Error('unavailable') },
        defaultAlertTenant: [AlertSource.Platform],
        perspective: 'admin',
      }),
    ).toEqual({
      loading: false,
      error: 'unavailable',
      rulesCount: 2,
      firingAlertsCount: 0,
    });
  });

  it('should report alert-rule and firing-alert counts when loaded', () => {
    expect(
      getAlertSummaryState({
        alerts: [platformFiring, userFiring, pendingAlert],
        rules: [platformRule(), platformRule(), platformRule()],
        rulesAlertLoading: { loaded: true },
        defaultAlertTenant: [AlertSource.Platform],
        perspective: 'admin',
      }),
    ).toEqual({
      loading: false,
      error: undefined,
      rulesCount: 3,
      firingAlertsCount: 1,
    });
  });

  it('should count only defaultAlertTenant rules among mixed platform and user rules', () => {
    expect(
      getAlertSummaryState({
        alerts: [],
        rules: [platformRule(), userRule(), platformRule(), userRule()],
        rulesAlertLoading: { loaded: true },
        defaultAlertTenant: [AlertSource.Platform],
        perspective: 'admin',
      }),
    ).toEqual({
      loading: false,
      error: undefined,
      rulesCount: 2,
      firingAlertsCount: 0,
    });
  });

  it('should fall back to zero when rules are undefined', () => {
    expect(
      getAlertSummaryState({
        alerts: [],
        rules: undefined,
        rulesAlertLoading: { loaded: true },
        defaultAlertTenant: [AlertSource.Platform],
        perspective: 'admin',
      }),
    ).toEqual({
      loading: false,
      error: undefined,
      rulesCount: 0,
      firingAlertsCount: 0,
    });
  });
});
