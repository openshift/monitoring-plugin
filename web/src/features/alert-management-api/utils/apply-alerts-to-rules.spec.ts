import { AlertStates, RuleStates } from '@openshift-console/dynamic-plugin-sdk';

import {
  makePrometheusAlert,
  makeRule,
} from '@/features/alert-management-api/tests/utils/object-factories';
import { applyAlertsToRules } from '@/features/alert-management-api/utils/apply-alerts-to-rules';
import { PrometheusAlert } from '@/shared/clients/alert-management-api/generated/api';

const labels = { alertname: 'Example', namespace: 'production', pod: 'pod-1' };

const makeApplyTestRule = () =>
  makeRule({
    sourceId: 'platform',
    labels: { openshift_io_alert_rule_id: 'rid_example' },
    state: RuleStates.Firing,
    alerts: [
      { labels: { ...labels }, annotations: {}, state: AlertStates.Firing },
      { labels: { ...labels, pod: 'pod-2' }, annotations: {}, state: AlertStates.Firing },
      { labels: { ...labels, pod: 'pod-3' }, annotations: {}, state: AlertStates.Pending },
    ],
  });

const makeAlert = (overrides: Partial<PrometheusAlert> = {}) =>
  makePrometheusAlert({
    labels: { ...labels, openshift_io_alert_source: 'platform' },
    state: 'silenced',
    alertRuleId: 'rid_example',
    ...overrides,
  });

it('marks only matching instances as silenced and leaves the rule state unchanged', () => {
  const rule = makeApplyTestRule();
  const alerts = [makeAlert()];
  const originalRules = structuredClone([rule]);
  const originalAlerts = structuredClone(alerts);

  const result = applyAlertsToRules([rule], alerts);

  expect(result[0].alerts.map((alert) => alert.state)).toEqual(['silenced', 'firing', 'pending']);
  expect(result[0].state).toBe('firing');
  expect([rule]).toEqual(originalRules);
  expect(alerts).toEqual(originalAlerts);
});

it('never marks the rule itself silenced, even when all its instances are silenced', () => {
  const rule = makeApplyTestRule();
  rule.alerts = [rule.alerts[0]];
  const result = applyAlertsToRules([rule], [makeAlert()]);
  expect(result[0].state).toBe('firing');
  expect(result[0].alerts[0].state).toBe('silenced');
});

it('ignores unmatched alerts without adding rules or instances', () => {
  const rules = [makeApplyTestRule()];
  const result = applyAlertsToRules(rules, [makeAlert({ labels: { ...labels, pod: 'missing' } })]);
  expect(result).toEqual(rules);
});

it('preserves pending instances even if the other response contains a stale silenced match', () => {
  const rules = [makeApplyTestRule()];
  const result = applyAlertsToRules(rules, [makeAlert({ labels: { ...labels, pod: 'pod-3' } })]);
  expect(result).toEqual(rules);
});

it('compares complete instance labels independently of order and backend metadata', () => {
  const rule = makeApplyTestRule();
  rule.alerts[0].labels = {
    ...labels,
    openshift_io_prometheus_rule_namespace: 'openshift-monitoring',
    openshift_io_prometheus_rule_name: 'example-rules',
    openshift_io_alerting_rule_name: 'example',
    openshift_io_rule_managed_by: 'operator',
    openshift_io_relabel_config_managed_by: 'operator',
    openshift_io_alert_rule_component: 'Compute',
    openshift_io_alert_rule_layer: 'cluster',
    openshift_io_alert_rule_component_from: 'component',
    openshift_io_alert_rule_layer_from: 'layer',
    openshift_io_alert_rule_classification_managed_by: 'monitoring-plugin',
  };
  const alert = makeAlert({
    labels: {
      pod: 'pod-1',
      namespace: 'production',
      alertname: 'Example',
      openshift_io_alert_backend: 'alertmanager',
    },
  });
  expect(applyAlertsToRules([rule], [alert])[0].alerts[0].state).toBe('silenced');
});

it('matches identical unlisted openshift_io labels', () => {
  const rule = makeApplyTestRule();
  const instanceLabels = { ...labels, openshift_io_custom_identity: 'instance-1' };
  rule.alerts[0].labels = instanceLabels;

  const result = applyAlertsToRules([rule], [makeAlert({ labels: { ...instanceLabels } })]);

  expect(result[0].alerts[0].state).toBe('silenced');
});

it.each([{ ...labels, openshift_io_custom_identity: 'instance-2' }, { ...labels }])(
  'does not discard unlisted openshift_io labels when matching: %j',
  (otherLabels) => {
    const rule = makeApplyTestRule();
    rule.alerts[0].labels = { ...labels, openshift_io_custom_identity: 'instance-1' };

    expect(applyAlertsToRules([rule], [makeAlert({ labels: otherLabels })])).toEqual([rule]);
  },
);

it.each([
  { ...labels, namespace: 'other' },
  { ...labels, cluster: 'other' },
  { alertname: 'Example', namespace: 'production' },
])('does not match a different complete label set: %j', (otherLabels) => {
  const rules = [makeApplyTestRule()];
  expect(applyAlertsToRules(rules, [makeAlert({ labels: otherLabels })])).toEqual(rules);
});

it('does not match identical labels from a different rule or source', () => {
  const rules = [makeApplyTestRule()];
  expect(applyAlertsToRules(rules, [makeAlert({ alertRuleId: 'other-rule' })])).toEqual(rules);
  expect(
    applyAlertsToRules(rules, [
      makeAlert({ labels: { ...labels, openshift_io_alert_source: 'user' } }),
    ]),
  ).toEqual(rules);
});

it('can use a stable rule ID label or fall back to instance labels when IDs are unavailable', () => {
  const rule = makeApplyTestRule();
  expect(
    applyAlertsToRules([rule], [makeAlert({ alertRuleId: undefined })])[0].alerts[0].state,
  ).toBe('silenced');
  expect(
    applyAlertsToRules(
      [rule],
      [
        makeAlert({
          alertRuleId: undefined,
          labels: { ...labels, openshift_io_alert_rule_id: 'other-rule' },
        }),
      ],
    ),
  ).toEqual([rule]);
  delete rule.labels.openshift_io_alert_rule_id;
  expect(applyAlertsToRules([rule], [makeAlert()])[0].alerts[0].state).toBe('silenced');
});

it('ignores non-silenced results and handles empty responses', () => {
  const rules = [makeApplyTestRule()];
  expect(applyAlertsToRules(rules, [makeAlert({ state: 'firing' })])).toEqual(rules);
  expect(applyAlertsToRules(rules, [])).toEqual(rules);
  expect(applyAlertsToRules([], [makeAlert()])).toEqual([]);
});
