import { makeManagedRule as makeRule } from '@/features/alert-management-api/tests/utils/object-factories';
import {
  compareRuleFilterValues,
  defaultRuleSort,
  sortRules,
} from '@/features/alert-management-api/utils/sort-rules';

it.each([
  { column: 'name', first: 'Alpha', second: 'Zulu' },
  { column: 'scope', first: 'Cluster', second: 'Namespace' },
  { column: 'component', first: 'etcd', second: 'kube-apiserver' },
  { column: 'source', first: 'platform', second: 'user' },
  { column: 'namespace', first: 'payments', second: 'production' },
  { column: 'managedBy', first: 'gitops', second: 'operator' },
] as const)(
  'sorts $column in both directions without mutating input',
  ({ column, first, second }) => {
    const rules = [makeRule({ id: 'b', [column]: second }), makeRule({ id: 'a', [column]: first })];
    expect(sortRules(rules, { column, direction: 'asc' }).map((rule) => rule.id)).toEqual([
      'a',
      'b',
    ]);
    expect(sortRules(rules, { column, direction: 'desc' }).map((rule) => rule.id)).toEqual([
      'b',
      'a',
    ]);
    expect(rules.map((rule) => rule.id)).toEqual(['b', 'a']);
  },
);

it('sorts State by alert counts within the same enablement without mutating input', () => {
  const rules = [
    makeRule({ id: 'silenced', silencedAlertCount: 100 }),
    makeRule({ id: 'firing', firingAlertCount: 10 }),
    makeRule({ id: 'empty' }),
    makeRule({ id: 'pending', pendingAlertCount: 2 }),
    makeRule({ id: 'firing-pending', firingAlertCount: 2, pendingAlertCount: 10 }),
    makeRule({ id: 'pending-silenced', pendingAlertCount: 2, silencedAlertCount: 10 }),
    makeRule({ id: 'firing-silenced', firingAlertCount: 2, silencedAlertCount: 100 }),
    makeRule({
      id: 'mixed',
      firingAlertCount: 2,
      pendingAlertCount: 10,
      silencedAlertCount: 2,
    }),
  ];
  const original = structuredClone(rules);
  const expectedIds = [
    'firing',
    'mixed',
    'firing-pending',
    'firing-silenced',
    'pending-silenced',
    'pending',
    'silenced',
    'empty',
  ];
  expect(
    sortRules(rules, { column: 'enablement', direction: 'asc' }).map((rule) => rule.id),
  ).toEqual(expectedIds);
  expect(
    sortRules(rules, { column: 'enablement', direction: 'desc' }).map((rule) => rule.id),
  ).toEqual([...expectedIds].reverse());
  expect(rules).toEqual(original);
});

it('sorts Enabled, Disabled, then Unknown before comparing alert counts or names', () => {
  const rules = [
    makeRule({ id: 'unknown', name: 'Alpha', enablement: 'Unknown', firingAlertCount: 10 }),
    makeRule({ id: 'disabled', name: 'Bravo', enablement: 'Disabled', pendingAlertCount: 2 }),
    makeRule({ id: 'enabled', name: 'Zulu', enablement: 'Enabled' }),
  ];
  const original = structuredClone(rules);
  expect(
    sortRules(rules, { column: 'enablement', direction: 'asc' }).map((rule) => rule.id),
  ).toEqual(['enabled', 'disabled', 'unknown']);
  expect(
    sortRules(rules, { column: 'enablement', direction: 'desc' }).map((rule) => rule.id),
  ).toEqual(['unknown', 'disabled', 'enabled']);
  expect(rules).toEqual(original);
});

it('sorts severity by importance without mutating input', () => {
  const rules = ['info', 'critical', 'warning'].map((severity) => makeRule({ severity }));
  expect(
    sortRules(rules, { column: 'severity', direction: 'asc' }).map((rule) => rule.severity),
  ).toEqual(['critical', 'warning', 'info']);
  expect(
    sortRules(rules, { column: 'severity', direction: 'desc' }).map((rule) => rule.severity),
  ).toEqual(['info', 'warning', 'critical']);
  expect(rules[0].severity).toBe('info');
});

it.each(['severity', 'enablement'] as const)(
  'breaks %s ties by name and then ID in the selected direction',
  (column) => {
    const rules = [
      makeRule({ id: 'b', name: 'Alpha' }),
      makeRule({ id: 'c', name: 'Zulu' }),
      makeRule({ id: 'a', name: 'Alpha' }),
    ];
    const ascendingIds = sortRules(rules, { column, direction: 'asc' }).map((rule) => rule.id);
    const descendingIds = sortRules(rules, { column, direction: 'desc' }).map((rule) => rule.id);
    expect(ascendingIds).toEqual(['a', 'b', 'c']);
    expect(descendingIds).toEqual(['c', 'b', 'a']);
    expect(sortRules(rules, defaultRuleSort).map((rule) => rule.id)).toEqual(['a', 'b', 'c']);
  },
);

it.each([
  {
    key: 'enablement',
    values: ['Unknown', 'Disabled', 'Enabled'],
    expected: ['Enabled', 'Disabled', 'Unknown'],
  },
  {
    key: 'severity',
    values: ['info', 'none', 'warning', 'critical'],
    expected: ['critical', 'warning', 'info', 'none'],
  },
  {
    key: 'namespace',
    values: ['production', 'analytics', 'payments'],
    expected: ['analytics', 'payments', 'production'],
  },
] as const)('sorts $key filter values', ({ key, values, expected }) => {
  expect([...values].sort((a, b) => compareRuleFilterValues(key, a, b))).toEqual(expected);
  expect(compareRuleFilterValues(key, values[0], values[0])).toBe(0);
});

it('handles an empty list', () => {
  expect(sortRules([], defaultRuleSort)).toEqual([]);
});
