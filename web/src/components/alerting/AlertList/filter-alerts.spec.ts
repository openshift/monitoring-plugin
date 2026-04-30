jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

jest.mock('../AlertUtils', () => ({
  alertSource: (alert: any) =>
    alert.rule?.labels?.prometheus === 'openshift-monitoring/k8s' ? 'platform' : 'user',
}));

import { Alert, AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { filterAlerts } from './filter-alerts';
import { AlertFilterOptions, AggregatedAlertFilters } from '../AlertsPage';
import { ALL_NAMESPACES_KEY } from '../../utils';
import { AlertSource } from '../../types';

const emptyFilters: AggregatedAlertFilters = {
  [AlertFilterOptions.NAME]: '',
  [AlertFilterOptions.STATE]: [],
  [AlertFilterOptions.SEVERITY]: [],
  [AlertFilterOptions.LABEL]: '',
};

const makeAlert = (overrides: Partial<Alert>): Alert =>
  ({
    labels: {},
    state: AlertStates.Firing,
    rule: { labels: {} },
    ...overrides,
  }) as unknown as Alert;

const firingCritical = makeAlert({
  labels: {
    alertname: 'HighCPU',
    severity: 'critical',
    namespace: 'default',
    prometheus: 'openshift-monitoring/k8s',
    env: 'prod',
  },
  state: AlertStates.Firing,
  rule: { labels: { prometheus: 'openshift-monitoring/k8s' } } as any,
});

const pendingWarning = makeAlert({
  labels: {
    alertname: 'MemoryPressure',
    severity: 'warning',
    namespace: 'kube-system',
    env: 'staging',
  },
  state: AlertStates.Pending,
  rule: { labels: {} } as any,
});

const silencedInfo = makeAlert({
  labels: {
    alertname: 'InfoAlert',
    severity: 'info',
    namespace: 'default',
    cluster: 'cluster-a',
  },
  state: AlertStates.Silenced,
  rule: { labels: {} } as any,
});

const alerts = [firingCritical, pendingWarning, silencedInfo];

describe('filterAlerts', () => {
  it('should return empty array for null input', () => {
    expect(filterAlerts(null as any, emptyFilters, ALL_NAMESPACES_KEY, 'admin')).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    expect(filterAlerts(undefined as any, emptyFilters, ALL_NAMESPACES_KEY, 'admin')).toEqual([]);
  });

  it('should return all alerts when no filters are set', () => {
    expect(filterAlerts(alerts, emptyFilters, ALL_NAMESPACES_KEY, 'admin')).toHaveLength(3);
  });

  describe('namespace filtering', () => {
    it('should filter by namespace', () => {
      const result = filterAlerts(alerts, emptyFilters, 'default', 'admin');
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.labels.namespace === 'default')).toBe(true);
    });

    it('should return all alerts for ALL_NAMESPACES_KEY', () => {
      expect(filterAlerts(alerts, emptyFilters, ALL_NAMESPACES_KEY, 'admin')).toHaveLength(3);
    });
  });

  describe('name filter', () => {
    it('should filter by alert name (fuzzy, case insensitive)', () => {
      const filters = { ...emptyFilters, [AlertFilterOptions.NAME]: 'cpu' };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].labels.alertname).toBe('HighCPU');
    });
  });

  describe('state filter', () => {
    it('should filter by firing state', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.STATE]: [AlertStates.Firing],
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].state).toBe(AlertStates.Firing);
    });

    it('should filter by multiple states', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.STATE]: [AlertStates.Firing, AlertStates.Pending],
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(2);
    });
  });

  describe('severity filter', () => {
    it('should filter by severity', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.SEVERITY]: ['critical'],
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].labels.severity).toBe('critical');
    });
  });

  describe('source filter', () => {
    it('should filter by platform source', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.SOURCE]: [AlertSource.Platform],
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].labels.alertname).toBe('HighCPU');
    });
  });

  describe('label filter', () => {
    it('should filter by single label key=value', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.LABEL]: 'env=prod',
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].labels.alertname).toBe('HighCPU');
    });

    it('should filter by multiple comma-separated labels', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.LABEL]: 'env=prod,severity=critical',
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(1);
    });

    it('should exclude alerts that do not match all labels', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.LABEL]: 'env=prod,severity=warning',
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(0);
    });

    it('should reject malformed label matchers', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.LABEL]: 'badformat',
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(0);
    });
  });

  describe('cluster filter (acm)', () => {
    it('should filter by cluster in acm perspective', () => {
      const filters: AggregatedAlertFilters = {
        ...emptyFilters,
        [AlertFilterOptions.CLUSTER]: ['cluster-a'],
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'acm');
      expect(result).toHaveLength(1);
      expect(result[0].labels.alertname).toBe('InfoAlert');
    });

    it('should not apply cluster filter in non-acm perspective', () => {
      const filters: AggregatedAlertFilters = {
        ...emptyFilters,
        [AlertFilterOptions.CLUSTER]: ['cluster-a'],
      };
      const result = filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(3);
    });
  });

  describe('combined filters', () => {
    it('should apply namespace + state + severity', () => {
      const filters = {
        ...emptyFilters,
        [AlertFilterOptions.STATE]: [AlertStates.Firing],
        [AlertFilterOptions.SEVERITY]: ['critical'],
      };
      const result = filterAlerts(alerts, filters, 'default', 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].labels.alertname).toBe('HighCPU');
    });
  });
});
