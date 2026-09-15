import type { DashboardResource } from '@perses-dev/client';

import {
  type DashboardRow,
  sortDashboardData,
} from '@/features/perses-dashboards/pages/dashboard-list-page/sort-dashboards';

const makeDashboard = (tags: string[]): DashboardResource =>
  ({ metadata: { tags } }) as unknown as DashboardResource;

const makeRow = (overrides: Partial<DashboardRow> & { id: string }): DashboardRow => ({
  name: { link: null, label: overrides.id },
  tags: null,
  project: '',
  created: null,
  modified: null,
  dashboard: makeDashboard([]),
  ...overrides,
});

const rowA = makeRow({
  id: 'a-dashboard',
  name: { link: null, label: 'Charlie' },
  project: 'project-b',
  createdAt: '2026-01-03T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  dashboard: makeDashboard(['one']),
});

const rowB = makeRow({
  id: 'b-dashboard',
  name: { link: null, label: 'Alpha' },
  project: 'project-a',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-03T00:00:00Z',
  dashboard: makeDashboard(['one', 'two', 'three']),
});

const rowC = makeRow({
  id: 'c-dashboard',
  name: { link: null, label: 'Bravo' },
  project: 'project-c',
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  dashboard: makeDashboard(['one', 'two']),
});

const rows = [rowA, rowB, rowC];

describe('sortDashboardData', () => {
  it('returns the data unchanged when sortBy is undefined', () => {
    expect(sortDashboardData(rows, undefined, 'asc')).toBe(rows);
  });

  it('returns the data unchanged when direction is undefined', () => {
    expect(sortDashboardData(rows, 'row-filter-name', undefined)).toBe(rows);
  });

  it('returns the data unchanged for an unrecognized sortBy', () => {
    expect(sortDashboardData(rows, 'row-filter-unknown', 'asc')).toBe(rows);
  });

  it('sorts by name ascending and descending', () => {
    const asc = sortDashboardData(rows, 'row-filter-name', 'asc');
    expect(asc.map((r) => r.name.label)).toEqual(['Alpha', 'Bravo', 'Charlie']);

    const desc = sortDashboardData(rows, 'row-filter-name', 'desc');
    expect(desc.map((r) => r.name.label)).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('sorts by id', () => {
    const asc = sortDashboardData(rows, 'row-filter-id', 'asc');
    expect(asc.map((r) => r.id)).toEqual(['a-dashboard', 'b-dashboard', 'c-dashboard']);
  });

  it('sorts by project', () => {
    const asc = sortDashboardData(rows, 'row-filter-project', 'asc');
    expect(asc.map((r) => r.project)).toEqual(['project-a', 'project-b', 'project-c']);
  });

  it('sorts by created date', () => {
    const asc = sortDashboardData(rows, 'row-filter-created', 'asc');
    expect(asc.map((r) => r.id)).toEqual(['b-dashboard', 'c-dashboard', 'a-dashboard']);
  });

  it('sorts by modified date', () => {
    const asc = sortDashboardData(rows, 'row-filter-modified', 'asc');
    expect(asc.map((r) => r.id)).toEqual(['a-dashboard', 'c-dashboard', 'b-dashboard']);
  });

  it('sorts by number of tags', () => {
    const asc = sortDashboardData(rows, 'row-filter-tags', 'asc');
    expect(asc.map((r) => r.id)).toEqual(['a-dashboard', 'c-dashboard', 'b-dashboard']);

    const desc = sortDashboardData(rows, 'row-filter-tags', 'desc');
    expect(desc.map((r) => r.id)).toEqual(['b-dashboard', 'c-dashboard', 'a-dashboard']);
  });

  it('does not mutate the original array', () => {
    const original = [...rows];
    sortDashboardData(rows, 'row-filter-name', 'desc');
    expect(rows).toEqual(original);
  });
});
