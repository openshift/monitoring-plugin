import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';

import {
  AlertGroupBy,
  groupAlerts,
  paginateAlertGroups,
} from '@/features/alert-management-api/pages/alerts-page/utils/group-alerts';
import { ManagedAlert } from '@/features/alert-management-api/types/types';
import { aggregateAlerts, getAlertStableKey } from '@/features/alert-management-api/utils/alerts';
import { defaultAlertSort, sortAlerts } from '@/features/alert-management-api/utils/sort-alerts';

const alert = (name: string, overrides: Partial<ManagedAlert> = {}): ManagedAlert => ({
  labels: { alertname: name, severity: 'warning' },
  annotations: {},
  activeAt: '2026-01-01T00:00:00Z',
  state: AlertStates.Firing,
  rule: { id: name, name } as ManagedAlert['rule'],
  alertScope: 'Cluster',
  component: 'api',
  source: 'platform',
  ...overrides,
});

describe('groupAlerts', () => {
  it.each([
    [
      AlertGroupBy.Severity,
      { labels: { alertname: 'Same', severity: 'critical' } },
      ['critical', 'warning'],
    ],
    [AlertGroupBy.Scope, { alertScope: 'Namespace' }, ['Cluster', 'Namespace']],
    [AlertGroupBy.Component, { component: 'storage' }, ['api', 'storage']],
  ])(
    'keeps aggregates within %s boundaries',
    (groupBy: AlertGroupBy, overrides: Partial<ManagedAlert>, values: string[]) => {
      const first = alert('Same');
      const second = alert('Same', overrides);
      const groups = groupAlerts([second, first, first, second], groupBy, true, defaultAlertSort);

      expect(
        groups.map(({ value }) => value),
        `alerts should be separated into distinct ${groupBy} groups`,
      ).toEqual(values);
      expect(
        new Set(groups.map(({ key }) => key)).size,
        `each ${groupBy} group should have a distinct key`,
      ).toBe(2);
      groups.forEach((group) => {
        expect(group.rows, `each ${groupBy} group should contain one aggregate row`).toHaveLength(
          1,
        );
        expect(
          group.rows[0].alerts,
          `each ${groupBy} aggregate should retain both matching alerts`,
        ).toHaveLength(2);
      });
      expect(
        groups.flatMap(({ rows }) => rows.flatMap(({ alerts }) => alerts)),
        `grouping by ${groupBy} should retain every alert instance`,
      ).toHaveLength(4);
    },
  );

  it('keeps displayed rows and their alert instances distinct', () => {
    const alerts = [
      alert('Same'),
      alert('Same'),
      alert('Other'),
      alert('Critical', { labels: { alertname: 'Critical', severity: 'critical' } }),
    ];

    const [aggregatedGroup] = groupAlerts(alerts, AlertGroupBy.Scope, true, defaultAlertSort);
    expect(
      aggregatedGroup.rows,
      'aggregation should produce three distinct alert rows',
    ).toHaveLength(3);
    expect(
      aggregatedGroup.rows.map(({ severity }) => severity),
      'aggregated rows should be sorted by severity',
    ).toEqual(['critical', 'warning', 'warning']);
    expect(
      aggregatedGroup.rows.flatMap(({ alerts }) => alerts),
      'aggregated rows should retain all four alert instances',
    ).toHaveLength(4);
    const [group] = groupAlerts(alerts, AlertGroupBy.Scope, false, defaultAlertSort);
    expect(group.rows, 'unaggregated grouping should produce one row per alert').toHaveLength(4);
    expect(
      group.rows.map(({ severity }) => severity),
      'unaggregated rows should be sorted by severity',
    ).toEqual(['critical', 'warning', 'warning', 'warning']);
    expect(
      group.rows.every(({ alerts }) => alerts.length === 1),
      'each unaggregated row should contain exactly one alert',
    ).toBe(true);
    expect(
      new Set(group.rows.map(({ key }) => key)).size,
      'each unaggregated alert row should have a distinct key',
    ).toBe(4);
  });

  it('assigns distinct row keys to alerts sharing a selection key across input and sort changes', () => {
    const alerts = [alert('Same'), alert('Same', { activeAt: '2026-01-02T00:00:00Z' })];
    const first = groupAlerts(alerts, AlertGroupBy.None, false, defaultAlertSort)[0];
    const second = groupAlerts([...alerts].reverse(), AlertGroupBy.None, false, {
      column: 'firingSince',
      direction: 'desc',
    })[0];

    const selectionKey = getAlertStableKey(alerts[0]);
    expect(
      first.rows.map(({ key }) => key),
      'duplicate selection keys should receive stable distinct row keys',
    ).toEqual([selectionKey, `${selectionKey}:1`]);
    expect(
      second.rows.map(({ key }) => key),
      'row keys should remain stable after input order and sort changes',
    ).toEqual([selectionKey, `${selectionKey}:1`]);
    expect(
      second.rows.map(({ alerts: [rowAlert] }) => rowAlert.activeAt),
      'rows should follow the requested firing-time order after reordering',
    ).toEqual([...alerts].reverse().map(({ activeAt }) => activeAt));
  });

  it('orders severity groups independently of row sorting, including missing and unknown values', () => {
    const alerts = ['zeta', 'none', 'info', 'warning', 'alpha', 'critical', undefined].map(
      (severity) =>
        alert('Same', {
          labels: severity === undefined ? { alertname: 'Same' } : { alertname: 'Same', severity },
        }),
    );
    const groups = groupAlerts(alerts, AlertGroupBy.Severity, true, {
      column: 'severity',
      direction: 'desc',
    });

    expect(
      groups.map(({ value }) => value),
      'severity groups should follow known severity order before unknown values',
    ).toEqual(['critical', 'warning', 'info', 'none', 'alpha', 'zeta']);
    expect(groups[3].rows, 'the None severity group should contain one aggregate row').toHaveLength(
      1,
    );
    expect(
      groups[3].rows[0].alerts,
      'the None severity aggregate should contain both alerts without severity labels',
    ).toHaveLength(2);
  });

  it.each([true, false])('sorts rows within alphabetical groups (aggregated: %s)', (aggregated) => {
    const alerts = [
      alert('Alpha', { component: 'storage' }),
      alert('Zulu'),
      alert('Alpha'),
      alert('Zulu', { component: 'storage' }),
    ];
    const snapshot = structuredClone(alerts);
    const sort = { column: 'name', direction: 'desc' } as const;
    const groups = groupAlerts(alerts, AlertGroupBy.Component, aggregated, sort);

    expect(
      groups.map(({ value }) => value),
      'component groups should be ordered alphabetically',
    ).toEqual(['api', 'storage']);
    groups.forEach(({ rows }) => {
      expect(
        rows.map(({ name }) => name),
        'rows should follow the requested descending name order',
      ).toEqual(['Zulu', 'Alpha']);
      expect(rows, 'grouped rows should match the alert sorting utility').toEqual(
        sortAlerts(rows, sort),
      );
    });
    expect(alerts, 'grouping and sorting should not mutate the input alerts').toEqual(snapshot);
  });

  it('returns one ungrouped aggregate list', () => {
    const alerts = [alert('Zulu'), alert('Alpha'), alert('Alpha')];
    expect(
      groupAlerts(alerts, AlertGroupBy.None, true, defaultAlertSort),
      'ungrouped aggregation should return one group with all sorted aggregate rows',
    ).toEqual([
      {
        key: 'none',
        value: '',
        rows: sortAlerts(aggregateAlerts(alerts), defaultAlertSort),
      },
    ]);
  });

  it('handles empty input', () => {
    expect(
      groupAlerts([], AlertGroupBy.None, true, defaultAlertSort),
      'empty ungrouped input should return an empty default group',
    ).toEqual([{ key: 'none', value: '', rows: [] }]);
    expect(
      groupAlerts([], AlertGroupBy.Severity, false, defaultAlertSort),
      'empty grouped input should return no groups',
    ).toEqual([]);
  });
});

describe('paginateAlertGroups', () => {
  const groups = groupAlerts(
    [
      alert('Alpha'),
      alert('Alpha'),
      alert('Bravo'),
      alert('Charlie'),
      alert('Delta', { component: 'storage' }),
      alert('Echo', { component: 'storage' }),
    ],
    AlertGroupBy.Component,
    true,
    { column: 'name', direction: 'asc' },
  );

  it('slices across groups without splitting aggregates', () => {
    const snapshot = structuredClone(groups);
    const first = paginateAlertGroups(groups, 1, 2);
    const second = paginateAlertGroups(groups, 2, 2);
    const third = paginateAlertGroups(groups, 3, 2);

    expect(first, 'the first page should contain the first two rows from the first group').toEqual([
      { ...groups[0], rows: groups[0].rows.slice(0, 2) },
    ]);
    expect(first[0].rows[0].alerts, 'pagination should not split an aggregate row').toHaveLength(2);
    expect(second, 'the second page should continue across groups without splitting rows').toEqual([
      { ...groups[0], rows: groups[0].rows.slice(2) },
      { ...groups[1], rows: groups[1].rows.slice(0, 1) },
    ]);
    expect(third, 'the third page should contain the remaining row in the second group').toEqual([
      { ...groups[1], rows: groups[1].rows.slice(1) },
    ]);
    expect(
      second[0].rows,
      'the second page should take the remaining row from the first group',
    ).toHaveLength(1);
    expect(first[0], 'pagination should return a new group object').not.toBe(groups[0]);
    expect(groups, 'pagination should not mutate the original groups').toEqual(snapshot);
  });

  it('handles exact group boundaries, oversized pages, and empty pages', () => {
    expect(
      paginateAlertGroups(groups, 1, 3),
      'a page ending at the group boundary should contain only the first group',
    ).toEqual([groups[0]]);
    expect(
      paginateAlertGroups(groups, 2, 3),
      'the next page should start with the next group at an exact boundary',
    ).toEqual([groups[1]]);
    expect(
      paginateAlertGroups(groups, 1, 10),
      'a page larger than the result should return every group',
    ).toEqual(groups);
    expect(
      paginateAlertGroups(groups, 4, 2),
      'a page beyond the available results should be empty',
    ).toEqual([]);
    expect(
      paginateAlertGroups([], 1, 2),
      'paginating an empty group list should return no groups',
    ).toEqual([]);
    expect(
      paginateAlertGroups(groupAlerts([], AlertGroupBy.None, true, defaultAlertSort), 1, 2),
      'paginating an empty default group should omit groups with no rows',
    ).toEqual([]);
  });
});
