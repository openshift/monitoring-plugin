import {
  parseFilterParams,
  serializeFilterParams,
} from '@/features/alert-management-api/utils/filter-params';

const filterKeys = ['severity', 'labels'] as const;
const defaults = {
  name: '',
  severity: [] as string[],
  labels: [] as string[],
  firingTime: '',
};

describe('parseFilterParams', () => {
  it('restores the name and all repeated filter values in order', () => {
    const params = new URLSearchParams(
      'name=HighCPU&severity=warning&severity=critical&labels=team%3Dplatform&labels=env%3Dprod',
    );

    expect(parseFilterParams(params, defaults, filterKeys)).toEqual({
      ...defaults,
      name: 'HighCPU',
      severity: ['warning', 'critical'],
      labels: ['team=platform', 'env=prod'],
    });
    expect(defaults).toEqual({ name: '', severity: [], labels: [], firingTime: '' });
  });

  it('uses an empty name and arrays for absent filters, preserving other defaults', () => {
    const customDefaults = {
      name: 'default',
      severity: ['critical'],
      labels: ['team=platform'],
      firingTime: '1h',
    };

    const filters = parseFilterParams(new URLSearchParams('page=2'), customDefaults, filterKeys);

    expect(filters).toEqual({ ...defaults, firingTime: '1h' });
    expect(customDefaults.severity).toEqual(['critical']);
    expect(customDefaults.labels).toEqual(['team=platform']);
  });

  it('only parses configured filter keys and uses the first name value', () => {
    const params = new URLSearchParams('name=first&name=second&severity=critical&firingTime=2h');

    expect(parseFilterParams(params, defaults, ['severity'])).toEqual({
      ...defaults,
      name: 'first',
      severity: ['critical'],
    });
  });
});

describe('serializeFilterParams', () => {
  it('replaces repeated filters and the name without changing the original parameters', () => {
    const current = new URLSearchParams(
      'name=old&name=duplicate&severity=info&severity=none&labels=old',
    );
    const original = current.toString();

    const next = serializeFilterParams(
      current,
      {
        ...defaults,
        name: 'HighCPU',
        severity: ['critical', 'warning'],
        labels: ['team=platform'],
      },
      filterKeys,
    );

    expect(next.getAll('name')).toEqual(['HighCPU']);
    expect(next.getAll('severity')).toEqual(['critical', 'warning']);
    expect(next.getAll('labels')).toEqual(['team=platform']);
    expect(current.toString()).toBe(original);
  });

  it('removes empty filters and preserves unrelated parameters, including repeated values', () => {
    const current = new URLSearchParams(
      'name=old&severity=critical&labels=old&page=3&sort=name&sortDirection=desc&columns=%5B%22name%22%5D&refreshInterval=30000&timeRange=3600000&endTime=1790000000000&extra=one&extra=two',
    );

    const next = serializeFilterParams(current, defaults, filterKeys);

    for (const key of ['name', ...filterKeys]) {
      expect(next.has(key)).toBe(false);
    }
    for (const key of [
      'page',
      'sort',
      'sortDirection',
      'columns',
      'refreshInterval',
      'timeRange',
      'endTime',
      'extra',
    ]) {
      expect(next.getAll(key)).toEqual(current.getAll(key));
    }
  });

  it('leaves filters outside the configured keys unchanged', () => {
    const next = serializeFilterParams(
      new URLSearchParams('severity=critical&labels=team%3Dplatform'),
      defaults,
      ['severity'],
    );

    expect(next.has('severity')).toBe(false);
    expect(next.getAll('labels')).toEqual(['team=platform']);
  });

  it('round-trips names and labels containing spaces, Unicode, and reserved characters', () => {
    const filters = {
      ...defaults,
      name: 'CPU + memory / 使用率?',
      severity: ['critical'],
      labels: ['team=platform & ops', 'expression=a+b=c%20'],
    };

    const serialized = serializeFilterParams(new URLSearchParams(), filters, filterKeys);
    const parsed = parseFilterParams(
      new URLSearchParams(serialized.toString()),
      defaults,
      filterKeys,
    );

    expect(parsed).toEqual(filters);
  });
});
