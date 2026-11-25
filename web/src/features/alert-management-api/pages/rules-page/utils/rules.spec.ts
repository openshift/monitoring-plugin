import { Rule } from '@openshift-console/dynamic-plugin-sdk';

import {
  defaultRuleColumns,
  defaultRuleFilters,
  filterRules,
  getRuleAlertStateValues,
  getRuleLabelValues,
  parseRuleColumns,
  toManagedRule,
} from '@/features/alert-management-api/pages/rules-page/utils/rules';
import { makeRule } from '@/features/alert-management-api/tests/utils/object-factories';

it('retains inactive rules with no alert instances and uses valid static overrides', () => {
  const result = toManagedRule(
    makeRule({
      sourceId: 'platform',
      labels: {
        openshift_io_alert_rule_layer: 'namespace',
        openshift_io_alert_rule_component: ' etcd ',
        severity: 'warning',
      },
    }),
  );
  expect(result).toMatchObject({
    id: 'rid_example',
    scope: 'Namespace',
    component: 'etcd',
    alerts: [],
    source: 'platform',
    severity: 'warning',
  });
});

it('uses enriched alert classification when static overrides are invalid', () => {
  const rule = makeRule({
    sourceId: 'user',
    labels: {
      openshift_io_alert_rule_component: 'invalid component',
      openshift_io_alert_rule_layer: 'CLUSTER',
    },
    alerts: [
      {
        labels: { alertname: 'Example' },
        annotations: {},
        state: 'firing' as Rule['alerts'][number]['state'],
        alertComponent: 'compute',
        alertLayer: 'cluster',
      },
    ],
  });
  expect(toManagedRule(rule)).toMatchObject({ scope: 'Cluster', component: 'compute' });
  expect(toManagedRule({ ...rule, alerts: [] })).toMatchObject({
    scope: 'Namespace',
    component: 'Others',
  });
});

it('uses agreed dynamic values but falls back to static overrides for conflicting instances', () => {
  const rule = makeRule({
    sourceId: 'platform',
    labels: {
      openshift_io_alert_rule_component: 'version',
      openshift_io_alert_rule_component_from: 'name',
      openshift_io_alert_rule_layer: 'cluster',
      openshift_io_alert_rule_layer_from: 'scope',
    },
    alerts: [
      {
        labels: { alertname: 'Example', name: 'network', scope: 'namespace' },
        annotations: {},
        state: 'firing' as Rule['alerts'][number]['state'],
        alertComponent: 'network',
        alertLayer: 'namespace',
      },
    ],
  });
  expect(toManagedRule(rule)).toMatchObject({ scope: 'Namespace', component: 'network' });
  const otherAlert = { ...rule.alerts[0], alertComponent: 'monitoring' };
  expect(toManagedRule({ ...rule, alerts: [...rule.alerts, otherAlert] })).toMatchObject({
    scope: 'Namespace',
    component: 'version',
  });
  expect(
    toManagedRule({
      ...rule,
      labels: {
        openshift_io_alert_rule_component: 'version',
        openshift_io_alert_rule_layer: 'cluster',
      },
    }),
  ).toMatchObject({ scope: 'Cluster', component: 'version' });
});

it('uses rule resource metadata for namespace and management rather than alert labels', () => {
  const rule = makeRule({
    labels: {
      openshift_io_prometheus_rule_namespace: 'rule-namespace',
      openshift_io_rule_managed_by: 'operator',
      namespace: 'target-namespace',
    },
    alerts: [
      {
        labels: { alertname: 'Example', namespace: 'instance-namespace' },
        annotations: {},
        state: 'firing' as Rule['alerts'][number]['state'],
      },
    ],
  });
  expect(toManagedRule(rule)).toMatchObject({ namespace: 'rule-namespace', managedBy: 'operator' });
  expect(toManagedRule(makeRule({ labels: { namespace: 'target-namespace' } }))).toMatchObject({
    namespace: '',
    managedBy: 'None',
  });
});

it('filters namespaces and managers with OR within a category and AND across categories', () => {
  const rules = [
    { id: 'platform', namespace: 'openshift-monitoring', managedBy: 'operator' },
    { id: 'production', namespace: 'production', managedBy: 'gitops' },
    { id: 'payments', namespace: 'payments', managedBy: 'gitops' },
    { id: 'unmanaged', namespace: '', managedBy: '' },
  ].map(({ id, namespace, managedBy }) =>
    toManagedRule(
      makeRule({
        id,
        labels: {
          openshift_io_prometheus_rule_namespace: namespace,
          openshift_io_rule_managed_by: managedBy,
        },
      }),
    ),
  );
  expect(
    filterRules(rules, { ...defaultRuleFilters, namespace: ['production', 'payments'] }).map(
      (rule) => rule.id,
    ),
  ).toEqual(['production', 'payments']);
  expect(
    filterRules(rules, { ...defaultRuleFilters, managedBy: ['operator', 'gitops'] }).map(
      (rule) => rule.id,
    ),
  ).toEqual(['platform', 'production', 'payments']);
  expect(
    filterRules(rules, {
      ...defaultRuleFilters,
      namespace: ['production'],
      managedBy: ['gitops'],
    }).map((rule) => rule.id),
  ).toEqual(['production']);
  expect(
    filterRules(rules, {
      ...defaultRuleFilters,
      namespace: ['production'],
      managedBy: ['operator'],
    }),
  ).toEqual([]);
  expect(
    filterRules(rules, { ...defaultRuleFilters, managedBy: ['None'] }).map((rule) => rule.id),
  ).toEqual(['unmanaged']);
});

it('falls back to source-based scope and Others rather than a fabricated component', () => {
  expect(toManagedRule(makeRule({ sourceId: 'platform' }))).toMatchObject({
    scope: 'Cluster',
    component: 'Others',
    severity: 'none',
  });
  expect(
    toManagedRule(makeRule({ sourceId: 'user', labels: { component: 'unclassified' } })),
  ).toMatchObject({ scope: 'Namespace', component: 'Others' });
  expect(
    toManagedRule(
      makeRule({ labels: { openshift_io_prometheus_rule_namespace: 'openshift-monitoring' } }),
    ).scope,
  ).toBe('Cluster');
  expect(
    toManagedRule(makeRule({ labels: { prometheus: 'openshift-monitoring/other' } })).scope,
  ).toBe('Cluster');
});

it('derives enablement from the API flag for rules with no alert instances', () => {
  expect(toManagedRule(makeRule({ alertingRuleEnabled: true })).enablement).toBe('Enabled');
  expect(toManagedRule(makeRule({ alertingRuleEnabled: false })).enablement).toBe('Disabled');
  expect(toManagedRule(makeRule()).enablement).toBe('Unknown');
});

it('does not infer enablement from alert instances', () => {
  for (const alerts of [
    [],
    [
      {
        labels: { alertname: 'Example' },
        annotations: {},
        state: 'silenced',
      } as Rule['alerts'][number],
    ],
  ]) {
    const rule = makeRule({ alerts });
    expect(toManagedRule({ ...rule, alertingRuleEnabled: true }).enablement).toBe('Enabled');
    expect(toManagedRule(rule).enablement).toBe('Unknown');
    expect(toManagedRule({ ...rule, alertingRuleEnabled: null }).enablement).toBe('Unknown');
  }
});

it('counts firing alert instances without changing rule enablement', () => {
  const alert = {
    annotations: {},
    labels: { alertname: 'Example' },
    state: 'firing',
  } as Rule['alerts'][number];
  const rule = makeRule({
    alerts: [alert],
    alertingRuleEnabled: true,
  });
  expect(toManagedRule(rule)).toMatchObject({ enablement: 'Enabled', firingAlertCount: 1 });
});

it('counts firing, silenced and pending instances separately', () => {
  const rule = makeRule({
    alertingRuleEnabled: true,
    alerts: ['firing', 'pending', 'silenced', 'firing'].map((state, index) => ({
      labels: { alertname: 'Example', pod: `pod-${index}` },
      annotations: {},
      state: state as Rule['alerts'][number]['state'],
    })),
  });
  expect(toManagedRule(rule)).toMatchObject({
    enablement: 'Enabled',
    firingAlertCount: 2,
    silencedAlertCount: 1,
    pendingAlertCount: 1,
  });
  expect(toManagedRule(makeRule())).toMatchObject({
    firingAlertCount: 0,
    silencedAlertCount: 0,
    pendingAlertCount: 0,
  });
});

it('filters enablement independently of firing activity', () => {
  const rules = [
    toManagedRule(makeRule({ id: 'enabled', alertingRuleEnabled: true })),
    toManagedRule(makeRule({ id: 'disabled', alertingRuleEnabled: false })),
    toManagedRule(
      makeRule({
        id: 'firing',
        alertingRuleEnabled: true,
        alerts: [
          {
            labels: { alertname: 'Example' },
            annotations: {},
            state: 'firing' as Rule['alerts'][number]['state'],
          },
        ],
      }),
    ),
    toManagedRule(makeRule({ id: 'unknown' })),
  ];
  expect(
    filterRules(rules, { ...defaultRuleFilters, enablement: ['Enabled'] }).map(({ id }) => id),
  ).toEqual(['enabled', 'firing']);
  expect(
    filterRules(rules, { ...defaultRuleFilters, enablement: ['Disabled'] }).map(({ id }) => id),
  ).toEqual(['disabled']);
  expect(
    filterRules(rules, { ...defaultRuleFilters, alertStates: ['Firing'] }).map(({ id }) => id),
  ).toEqual(['firing']);
  expect(filterRules(rules, { ...defaultRuleFilters, enablement: ['Firing'] })).toEqual([]);
  expect(
    filterRules(rules, { ...defaultRuleFilters, enablement: ['Unknown'] }).map(({ id }) => id),
  ).toEqual(['unknown']);
});

it('matches alert states by instance counts independently of rule enablement', () => {
  const rules = [
    { id: 'mixed', states: ['firing', 'firing', 'silenced', 'pending'] },
    { id: 'firing', states: ['firing'] },
    { id: 'silenced', states: ['silenced', 'silenced'] },
    { id: 'pending', states: ['pending'] },
    { id: 'empty', states: [] },
    { id: 'disabled', states: [] },
  ].map(({ id, states }) =>
    toManagedRule(
      makeRule({
        id,
        alertingRuleEnabled: id !== 'disabled',
        labels: { severity: id === 'mixed' ? 'critical' : 'warning' },
        alerts: states.map((state, index) => ({
          labels: { alertname: 'Example', pod: `pod-${index}` },
          annotations: {},
          state: state as Rule['alerts'][number]['state'],
        })),
      }),
    ),
  );

  expect(getRuleAlertStateValues(rules[0])).toEqual(['Firing', 'Silenced', 'Pending']);
  expect(getRuleAlertStateValues(rules[3])).toEqual(['Pending']);
  expect(getRuleAlertStateValues(rules[4])).toEqual([]);
  expect(getRuleAlertStateValues(rules[5])).toEqual([]);
  expect(
    filterRules(rules, { ...defaultRuleFilters, alertStates: ['Firing'] }).map((rule) => rule.id),
  ).toEqual(['mixed', 'firing']);
  expect(
    filterRules(rules, { ...defaultRuleFilters, alertStates: ['Silenced'] }).map((rule) => rule.id),
  ).toEqual(['mixed', 'silenced']);
  expect(
    filterRules(rules, { ...defaultRuleFilters, alertStates: ['Pending'] }).map((rule) => rule.id),
  ).toEqual(['mixed', 'pending']);
  expect(
    filterRules(rules, { ...defaultRuleFilters, alertStates: ['Firing', 'Silenced'] }).map(
      (rule) => rule.id,
    ),
  ).toEqual(['mixed', 'firing', 'silenced']);
  expect(
    filterRules(rules, { ...defaultRuleFilters, alertStates: ['Pending', 'Silenced'] }).map(
      (rule) => rule.id,
    ),
  ).toEqual(['mixed', 'silenced', 'pending']);
  expect(
    filterRules(rules, {
      ...defaultRuleFilters,
      alertStates: ['Silenced'],
      severity: ['critical'],
    }).map((rule) => rule.id),
  ).toEqual(['mixed']);
  expect(
    filterRules(rules, {
      ...defaultRuleFilters,
      alertStates: ['Silenced'],
      enablement: ['Disabled'],
    }),
  ).toEqual([]);
  expect(
    filterRules(rules, {
      ...defaultRuleFilters,
      alertStates: ['Pending'],
      enablement: ['Enabled'],
    }).map((rule) => rule.id),
  ).toEqual(['mixed', 'pending']);
});

it('combines filter categories with AND and values within a category with OR', () => {
  const rules = ['critical', 'warning', 'info'].map((severity, index) =>
    toManagedRule(
      makeRule({
        id: String(index),
        name: `Example${index}`,
        labels: { severity },
        sourceId: index === 2 ? 'user' : 'platform',
      }),
    ),
  );
  expect(
    filterRules(rules, {
      ...defaultRuleFilters,
      name: 'EXAMPLE',
      severity: ['critical', 'info'],
      source: ['platform'],
    }).map(({ id }) => id),
  ).toEqual(['0']);
  expect(filterRules(rules, { ...defaultRuleFilters, component: ['etcd'] })).toEqual([]);
});

it('exposes definition labels without internal metadata or instance-only labels', () => {
  const rule = makeRule({
    labels: {
      team: 'payments',
      expression: 'a=b',
      severity: 'warning',
      namespace: 'production',
      alertname: 'Example',
      openshift_io_alert_rule_id: 'rid_example',
      openshift_io_alert_rule_component: 'etcd',
    },
    alerts: [
      {
        labels: { alertname: 'Example', pod: 'instance-only' },
        annotations: {},
        state: 'firing',
      } as Rule['alerts'][number],
    ],
  });
  expect(getRuleLabelValues(rule)).toEqual([
    'team=payments',
    'expression=a=b',
    'severity=warning',
    'namespace=production',
  ]);
  expect(getRuleLabelValues(makeRule())).toEqual([]);
});

it('requires every selected label to match and combines them with other filters', () => {
  const rules = [
    toManagedRule(
      makeRule({
        id: 'both',
        labels: {
          team: 'payments',
          environment: 'production',
          expression: 'a=b',
          severity: 'critical',
        },
      }),
    ),
    toManagedRule(
      makeRule({ id: 'team-only', labels: { team: 'payments', severity: 'critical' } }),
    ),
    toManagedRule(makeRule({ id: 'environment-only', labels: { environment: 'production' } })),
    toManagedRule(makeRule({ id: 'no-labels' })),
  ];
  const filters = { ...defaultRuleFilters, labels: ['team=payments', 'environment=production'] };
  expect(filterRules(rules, filters).map(({ id }) => id)).toEqual(['both']);
  expect(filterRules(rules, { ...filters, severity: ['warning'] })).toEqual([]);
  expect(
    filterRules(rules, { ...defaultRuleFilters, labels: ['expression=a=b'] }).map(({ id }) => id),
  ).toEqual(['both']);
  expect(filterRules(rules, { ...defaultRuleFilters, labels: ['team=pay'] })).toEqual([]);
  expect(filterRules(rules, { ...defaultRuleFilters, labels: ['unknown=value'] })).toEqual([]);
});

it('validates URL column configuration and preserves valid order without duplicates', () => {
  for (const value of [
    null,
    'invalid',
    '[]',
    '["name","severity"]',
    '["name","enablement"]',
    '["enablement","severity"]',
    '["name","severity","cluster"]',
    '["name","severity","managementState"]',
  ]) {
    expect(parseRuleColumns(value)).toEqual(defaultRuleColumns);
  }
  expect(
    parseRuleColumns('["source","severity","name","name","enablement","namespace","managedBy"]'),
  ).toEqual(['source', 'severity', 'name', 'enablement', 'namespace', 'managedBy']);
  expect(defaultRuleColumns).toContain('enablement');
  expect(defaultRuleColumns).not.toContain('namespace');
  expect(defaultRuleColumns).not.toContain('managedBy');
});
