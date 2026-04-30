jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

import { Silence, SilenceStates } from '@openshift-console/dynamic-plugin-sdk';
import { filterSilences } from './filter-silences';
import { SilenceFilterOptions, SilenceFilters } from './SilencesPage';
import { ALL_NAMESPACES_KEY } from '../utils';

const emptyFilters: SilenceFilters = {
  [SilenceFilterOptions.NAME]: '',
  [SilenceFilterOptions.STATE]: [],
};

const makeSilence = (overrides: Partial<Silence> & { name: string }): Silence =>
  ({
    matchers: [],
    status: { state: SilenceStates.Active },
    ...overrides,
  }) as unknown as Silence;

const activeSilence = makeSilence({
  name: 'silence-cpu',
  matchers: [
    { name: 'namespace', value: 'default', isRegex: false },
    { name: 'alertname', value: 'HighCPU', isRegex: false },
  ],
  status: { state: SilenceStates.Active },
});

const pendingSilence = makeSilence({
  name: 'silence-memory',
  matchers: [{ name: 'namespace', value: 'kube-system', isRegex: false }],
  status: { state: SilenceStates.Pending },
});

const expiredSilence = makeSilence({
  name: 'old-silence',
  matchers: [],
  status: { state: SilenceStates.Expired },
});

const clusterSilence = makeSilence({
  name: 'cluster-silence',
  matchers: [{ name: 'cluster', value: 'cluster-a', isRegex: false }],
  status: { state: SilenceStates.Active },
});

const silences = [activeSilence, pendingSilence, expiredSilence, clusterSilence];

describe('filterSilences', () => {
  it('should return empty array for null input', () => {
    expect(filterSilences(null as any, emptyFilters, ALL_NAMESPACES_KEY, 'admin')).toEqual([]);
  });

  it('should return all silences when no filters are set and all namespaces', () => {
    expect(filterSilences(silences, emptyFilters, ALL_NAMESPACES_KEY, 'admin')).toHaveLength(4);
  });

  describe('namespace filtering', () => {
    it('should return only silences matching the namespace', () => {
      const result = filterSilences(silences, emptyFilters, 'default', 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('silence-cpu');
    });

    it('should exclude silences without a namespace matcher', () => {
      const result = filterSilences(silences, emptyFilters, 'default', 'admin');
      expect(result.find((s) => s.name === 'old-silence')).toBeUndefined();
    });

    it('should return all silences for ALL_NAMESPACES_KEY', () => {
      const result = filterSilences(silences, emptyFilters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(4);
    });
  });

  describe('name filter', () => {
    it('should filter by name (fuzzy, case insensitive)', () => {
      const filters = { ...emptyFilters, [SilenceFilterOptions.NAME]: 'cpu' };
      const result = filterSilences(silences, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('silence-cpu');
    });

    it('should return all when name filter is empty', () => {
      const filters = { ...emptyFilters, [SilenceFilterOptions.NAME]: '' };
      expect(filterSilences(silences, filters, ALL_NAMESPACES_KEY, 'admin')).toHaveLength(4);
    });
  });

  describe('state filter', () => {
    it('should filter by active state', () => {
      const filters = {
        ...emptyFilters,
        [SilenceFilterOptions.STATE]: [SilenceStates.Active],
      };
      const result = filterSilences(silences, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result.every((s) => s.status?.state === SilenceStates.Active)).toBe(true);
    });

    it('should filter by multiple states', () => {
      const filters = {
        ...emptyFilters,
        [SilenceFilterOptions.STATE]: [SilenceStates.Active, SilenceStates.Pending],
      };
      const result = filterSilences(silences, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(3);
    });
  });

  describe('cluster filter (acm)', () => {
    it('should filter by cluster in acm perspective', () => {
      const filters: SilenceFilters = {
        ...emptyFilters,
        [SilenceFilterOptions.CLUSTER]: ['cluster-a'],
      };
      const result = filterSilences(silences, filters, ALL_NAMESPACES_KEY, 'acm');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('cluster-silence');
    });

    it('should not apply cluster filter in non-acm perspective', () => {
      const filters: SilenceFilters = {
        ...emptyFilters,
        [SilenceFilterOptions.CLUSTER]: ['cluster-a'],
      };
      const result = filterSilences(silences, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(4);
    });
  });

  describe('combined filters', () => {
    it('should apply name + state filters together', () => {
      const filters: SilenceFilters = {
        [SilenceFilterOptions.NAME]: 'silence',
        [SilenceFilterOptions.STATE]: [SilenceStates.Active],
      };
      const result = filterSilences(silences, filters, ALL_NAMESPACES_KEY, 'admin');
      expect(result).toHaveLength(2);
    });

    it('should apply namespace + state filters together', () => {
      const filters = {
        ...emptyFilters,
        [SilenceFilterOptions.STATE]: [SilenceStates.Pending],
      };
      const result = filterSilences(silences, filters, 'kube-system', 'admin');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('silence-memory');
    });
  });
});
