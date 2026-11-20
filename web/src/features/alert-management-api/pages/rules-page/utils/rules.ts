import { AlertSeverity, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { TFunction } from 'i18next';

import {
  ManagedRule,
  RuleFilterKey,
  RuleFilters,
  RuleWithEnablement,
} from '@/features/alert-management-api/types/types';
import { parseTableColumns } from '@/features/alert-management-api/utils/table-columns';
import { alertingRuleSource } from '@/shared/utils/alerts/alert-source';

export const ruleColumns = [
  { key: 'name', label: 'Alert rule name' },
  { key: 'enablement', label: 'State' },
  { key: 'severity', label: 'Severity' },
  { key: 'scope', label: 'Alert scope' },
  { key: 'component', label: 'Affected component' },
  { key: 'source', label: 'Source' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'managedBy', label: 'Managed by' },
] as const;

export function ruleLabel(value: string, t: TFunction): string {
  const labels: Record<string, string> = {
    'Alert rule name': t('Alert rule name'),
    'Rule labels': t('Rule labels'),
    State: t('State'),
    Enabled: t('Enabled'),
    Disabled: t('Disabled'),
    Firing: t('Firing'),
    Silenced: t('Silenced'),
    Pending: t('Pending'),
    'Alert states': t('Alert states'),
    Unknown: t('Unknown'),
    Severity: t('Severity'),
    'Alert scope': t('Alert scope'),
    'Affected component': t('Affected component'),
    Source: t('Source'),
    'Managed by': t('Managed by'),
    operator: t('Operator'),
    gitops: t('GitOps'),
    Cluster: t('Cluster'),
    Namespace: t('Namespace'),
    platform: t('Platform'),
    user: t('User'),
  };
  return labels[value] ?? value;
}

export type RuleColumn = (typeof ruleColumns)[number]['key'];
export const defaultRuleColumns: RuleColumn[] = [
  'name',
  'enablement',
  'severity',
  'scope',
  'component',
  'source',
];
export const requiredRuleColumns: RuleColumn[] = ['name', 'enablement', 'severity'];

export const ruleFilterLabels = {
  labels: 'Rule labels',
  enablement: 'State',
  alertStates: 'Alert states',
  severity: 'Severity',
  scope: 'Alert scope',
  component: 'Affected component',
  source: 'Source',
  namespace: 'Namespace',
  managedBy: 'Managed by',
} satisfies Record<RuleFilterKey, string>;
export const defaultRuleFilters: RuleFilters = {
  name: '',
  labels: [],
  enablement: [],
  alertStates: [],
  severity: [],
  scope: [],
  component: [],
  source: [],
  namespace: [],
  managedBy: [],
};

export function toManagedRule(rule: RuleWithEnablement): ManagedRule {
  const source = alertingRuleSource(rule);
  const labels = rule.labels ?? {};
  const layer = labels.openshift_io_alert_rule_layer || labels.openshift_io_alert_layer;

  // if layer isn't set fallback to source scope
  let scope = source === 'platform' ? 'Cluster' : 'Namespace';
  if (layer === 'cluster') {
    scope = 'Cluster';
  } else if (layer === 'namespace') {
    scope = 'Namespace';
  }

  const firingAlertCount = rule.alerts.filter((alert) => alert.state === 'firing').length;
  const silencedAlertCount = rule.alerts.filter((alert) => alert.state === 'silenced').length;
  const pendingAlertCount = rule.alerts.filter((alert) => alert.state === 'pending').length;

  let enablement: ManagedRule['enablement'] = 'Unknown';
  if (rule.alertingRuleEnabled === true) {
    enablement = 'Enabled';
  } else if (rule.alertingRuleEnabled === false) {
    enablement = 'Disabled';
  }

  return {
    ...rule,
    scope,
    source,
    enablement,
    firingAlertCount,
    silencedAlertCount,
    pendingAlertCount,
    severity: labels.severity || AlertSeverity.None,
    namespace: labels.openshift_io_prometheus_rule_namespace || '',
    managedBy: labels.openshift_io_rule_managed_by || 'Unknown',
    component:
      labels.openshift_io_alert_rule_component ||
      labels.openshift_io_alert_component ||
      labels.component ||
      'Others',
  };
}

export function getRuleLabelValues(rule: Pick<Rule, 'labels'>): string[] {
  return Object.entries(rule.labels ?? {})
    .filter(([key]) => key !== 'alertname' && !key.startsWith('openshift_io_'))
    .map(([key, value]) => `${key}=${value}`);
}

export function getRuleAlertStateValues(rule: ManagedRule): string[] {
  const values: string[] = [];
  if (rule.firingAlertCount > 0) {
    values.push('Firing');
  }
  if (rule.silencedAlertCount > 0) {
    values.push('Silenced');
  }
  if (rule.pendingAlertCount > 0) {
    values.push('Pending');
  }
  return values;
}

export function filterRules(rules: ManagedRule[], filters: RuleFilters) {
  return rules.filter(
    (rule) =>
      rule.name.toLocaleLowerCase().includes(filters.name.toLocaleLowerCase()) &&
      (Object.keys(ruleFilterLabels) as RuleFilterKey[]).every((key) => {
        if (key === 'labels') {
          const labels = getRuleLabelValues(rule);
          return filters.labels.every((label) => labels.includes(label));
        }
        if (key === 'alertStates') {
          return (
            filters.alertStates.length === 0 ||
            getRuleAlertStateValues(rule).some((value) => filters.alertStates.includes(value))
          );
        }
        return filters[key].length === 0 || filters[key].includes(rule[key]);
      }),
  );
}

export function parseRuleColumns(value: string | null): RuleColumn[] {
  return parseTableColumns(value, ruleColumns, defaultRuleColumns, requiredRuleColumns);
}
