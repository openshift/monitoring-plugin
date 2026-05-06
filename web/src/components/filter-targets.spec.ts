jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

import { filterTargets } from './filter-targets';
import { TargetsFilterOptions, TargetsFilters } from './targets-page';
import { Target } from './types';

const emptyFilters: TargetsFilters = {
  [TargetsFilterOptions.NAME]: '',
  [TargetsFilterOptions.STATUS]: [],
  [TargetsFilterOptions.LABEL]: '',
  [TargetsFilterOptions.SOURCE]: [],
};

const makeTarget = (overrides: Partial<Target>): Target =>
  ({
    labels: {},
    health: 'up',
    scrapeUrl: 'http://localhost:9090/metrics',
    ...overrides,
  }) as unknown as Target;

const healthyTarget = makeTarget({
  scrapeUrl: 'http://service-a:8080/metrics',
  health: 'up',
  labels: {
    namespace: 'default',
    prometheus: 'openshift-monitoring/k8s',
    env: 'prod',
  },
});

const unhealthyTarget = makeTarget({
  scrapeUrl: 'http://service-b:8080/metrics',
  health: 'down',
  labels: {
    namespace: 'kube-system',
    env: 'staging',
  },
});

const otherTarget = makeTarget({
  scrapeUrl: 'http://service-c:9090/metrics',
  health: 'up',
  labels: {
    namespace: 'monitoring',
  },
});

const targets = [healthyTarget, unhealthyTarget, otherTarget];

describe('filterTargets', () => {
  it('should return empty array for null input', () => {
    expect(filterTargets(null as any, emptyFilters)).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    expect(filterTargets(undefined as any, emptyFilters)).toEqual([]);
  });

  it('should return all targets when no filters are set', () => {
    expect(filterTargets(targets, emptyFilters)).toHaveLength(3);
  });

  describe('name filter', () => {
    it('should match against scrapeUrl', () => {
      const filters = { ...emptyFilters, [TargetsFilterOptions.NAME]: 'service-a' };
      const result = filterTargets(targets, filters);
      expect(result).toHaveLength(1);
      expect(result[0].scrapeUrl).toBe('http://service-a:8080/metrics');
    });

    it('should match against namespace', () => {
      const filters = { ...emptyFilters, [TargetsFilterOptions.NAME]: 'kube-system' };
      const result = filterTargets(targets, filters);
      expect(result).toHaveLength(1);
      expect(result[0].labels.namespace).toBe('kube-system');
    });

    it('should be case insensitive', () => {
      const filters = { ...emptyFilters, [TargetsFilterOptions.NAME]: 'SERVICE-A' };
      const result = filterTargets(targets, filters);
      expect(result).toHaveLength(1);
    });
  });

  describe('status filter', () => {
    it('should filter by health status', () => {
      const filters = { ...emptyFilters, [TargetsFilterOptions.STATUS]: ['down'] };
      const result = filterTargets(targets, filters);
      expect(result).toHaveLength(1);
      expect(result[0].health).toBe('down');
    });

    it('should support multiple statuses', () => {
      const filters = { ...emptyFilters, [TargetsFilterOptions.STATUS]: ['up', 'down'] };
      expect(filterTargets(targets, filters)).toHaveLength(3);
    });
  });

  describe('source filter', () => {
    it('should filter by platform source', () => {
      const filters = { ...emptyFilters, [TargetsFilterOptions.SOURCE]: ['platform'] };
      const result = filterTargets(targets, filters);
      expect(result).toHaveLength(1);
      expect(result[0].labels.prometheus).toBe('openshift-monitoring/k8s');
    });
  });

  describe('label filter', () => {
    it('should filter by single label', () => {
      const filters = { ...emptyFilters, [TargetsFilterOptions.LABEL]: 'env=prod' };
      const result = filterTargets(targets, filters);
      expect(result).toHaveLength(1);
      expect(result[0].scrapeUrl).toBe('http://service-a:8080/metrics');
    });

    it('should filter by multiple comma-separated labels', () => {
      const filters = {
        ...emptyFilters,
        [TargetsFilterOptions.LABEL]: 'env=staging,namespace=kube-system',
      };
      const result = filterTargets(targets, filters);
      expect(result).toHaveLength(1);
      expect(result[0].labels.namespace).toBe('kube-system');
    });

    it('should exclude targets not matching all labels', () => {
      const filters = {
        ...emptyFilters,
        [TargetsFilterOptions.LABEL]: 'env=prod,namespace=kube-system',
      };
      expect(filterTargets(targets, filters)).toHaveLength(0);
    });

    it('should reject malformed label matchers', () => {
      const filters = { ...emptyFilters, [TargetsFilterOptions.LABEL]: 'noequalssign' };
      expect(filterTargets(targets, filters)).toHaveLength(0);
    });
  });

  describe('combined filters', () => {
    it('should apply name + status filters', () => {
      const filters: TargetsFilters = {
        [TargetsFilterOptions.NAME]: 'service',
        [TargetsFilterOptions.STATUS]: ['up'],
        [TargetsFilterOptions.LABEL]: '',
        [TargetsFilterOptions.SOURCE]: [],
      };
      const result = filterTargets(targets, filters);
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.health === 'up')).toBe(true);
    });
  });
});
