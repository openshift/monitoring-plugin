import { TFunction } from 'i18next';

import { getRuleFilterOptions } from '@/features/alert-management-api/pages/rules-page/utils/rule-filter-options';
import { ruleFilterLabels } from '@/features/alert-management-api/pages/rules-page/utils/rules';
import { makeManagedRule } from '@/features/alert-management-api/tests/utils/object-factories';

const t = ((key: string) => key) as TFunction;

it('computes all option counts together without mutating rules', () => {
  const rules = [
    makeManagedRule({
      enablement: 'Enabled',
      firingAlertCount: 3,
      pendingAlertCount: 1,
      silencedAlertCount: 2,
      labels: {
        alertname: 'Example',
        team: 'payments',
        environment: 'production',
        openshift_io_alert_rule_component: 'etcd',
      },
      severity: 'warning',
      namespace: 'production',
      scope: 'Cluster',
      component: 'etcd',
      source: 'platform',
      managedBy: 'operator',
    }),
    makeManagedRule({
      enablement: 'Enabled',
      firingAlertCount: 1,
      labels: { team: 'payments' },
      severity: 'critical',
      namespace: 'payments',
      scope: 'Namespace',
      component: 'api',
      source: 'user',
      managedBy: 'gitops',
    }),
    makeManagedRule({
      enablement: 'Disabled',
      severity: 'info',
      namespace: '',
      scope: 'Namespace',
      component: '',
      source: 'user',
      managedBy: 'Unknown',
    }),
  ];
  const original = structuredClone(rules);
  const options = getRuleFilterOptions(rules, t);

  expect(options).toEqual({
    labels: [
      { value: 'environment=production', label: 'environment=production', count: 1 },
      { value: 'team=payments', label: 'team=payments', count: 2 },
    ],
    enablement: [
      { value: 'Enabled', label: 'Enabled', count: 2 },
      { value: 'Disabled', label: 'Disabled', count: 1 },
    ],
    alertStates: [
      { value: 'Firing', label: 'Firing', count: 2 },
      { value: 'Pending', label: 'Pending', count: 1 },
      { value: 'Silenced', label: 'Silenced', count: 1 },
    ],
    severity: [
      { value: 'critical', label: 'critical', count: 1 },
      { value: 'warning', label: 'warning', count: 1 },
      { value: 'info', label: 'info', count: 1 },
    ],
    scope: [
      { value: 'Cluster', label: 'Cluster', count: 1 },
      { value: 'Namespace', label: 'Namespace', count: 2 },
    ],
    component: [
      { value: 'api', label: 'api', count: 1 },
      { value: 'etcd', label: 'etcd', count: 1 },
    ],
    source: [
      { value: 'platform', label: 'Platform', count: 1 },
      { value: 'user', label: 'User', count: 2 },
    ],
    namespace: [
      { value: 'payments', label: 'payments', count: 1 },
      { value: 'production', label: 'production', count: 1 },
    ],
    managedBy: [
      { value: 'gitops', label: 'GitOps', count: 1 },
      { value: 'operator', label: 'Operator', count: 1 },
      { value: 'Unknown', label: 'Unknown', count: 1 },
    ],
  });
  expect(rules).toEqual(original);
});

it('sorts enablement and severity by their custom orders', () => {
  const rules = [
    makeManagedRule({ enablement: 'Disabled', severity: 'info' }),
    makeManagedRule({ enablement: 'Unknown', severity: 'none' }),
    makeManagedRule({ enablement: 'Enabled', severity: 'warning' }),
    makeManagedRule({ severity: 'critical' }),
    makeManagedRule({ severity: 'custom' }),
  ];
  const options = getRuleFilterOptions(rules, t);
  expect(options.enablement.map(({ value }) => value)).toEqual(['Enabled', 'Disabled', 'Unknown']);
  expect(options.severity.map(({ value }) => value)).toEqual([
    'critical',
    'warning',
    'info',
    'none',
    'custom',
  ]);
});

it('translates display labels without translating values, rule labels or namespaces', () => {
  const translated = ((key: string) => `translated:${key}`) as TFunction;
  const options = getRuleFilterOptions(
    [
      makeManagedRule({
        enablement: 'Enabled',
        pendingAlertCount: 1,
        labels: { team: 'payments' },
        namespace: 'production',
        managedBy: 'gitops',
        source: 'platform',
      }),
    ],
    translated,
  );
  expect(options.enablement).toEqual([{ value: 'Enabled', label: 'translated:Enabled', count: 1 }]);
  expect(options.alertStates).toEqual([
    { value: 'Pending', label: 'translated:Pending', count: 1 },
  ]);
  expect(options.managedBy).toEqual([{ value: 'gitops', label: 'translated:GitOps', count: 1 }]);
  expect(options.source).toEqual([{ value: 'platform', label: 'translated:Platform', count: 1 }]);
  expect(options.labels).toEqual([{ value: 'team=payments', label: 'team=payments', count: 1 }]);
  expect(options.namespace).toEqual([{ value: 'production', label: 'production', count: 1 }]);
});

it.each(['Others', 'component', 'Source', 'Unknown', 'constructor'])(
  'preserves component name %s without translating it',
  (component) => {
    const translated = ((key: string) => `translated:${key}`) as TFunction;
    const options = getRuleFilterOptions([makeManagedRule({ component })], translated);

    expect(options.component).toEqual([{ value: component, label: component, count: 1 }]);
  },
);

it('returns an empty options array for every filter when there are no rules', () => {
  const options = getRuleFilterOptions([], t);
  expect(Object.keys(options)).toEqual(Object.keys(ruleFilterLabels));
  Object.values(options).forEach((values) => expect(values).toEqual([]));
});
