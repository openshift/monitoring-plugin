import { AlertStates, RuleStates } from '@openshift-console/dynamic-plugin-sdk';

import { RuleWithEnablement } from '@/features/alert-management-api/types/types';
import {
  GetAlertsResponse,
  GetRulesResponse,
  PrometheusAlert,
} from '@/shared/clients/alert-management-api/generated/api';
import { getAlertsAndRules } from '@/shared/utils/alerts/formatting';

const ALERT_BACKEND_LABEL = 'openshift_io_alert_backend';
const ALERT_RULE_ID_LABEL = 'openshift_io_alert_rule_id';
const ALERT_SOURCE_LABEL = 'openshift_io_alert_source';

const metadataLabels = new Set([
  ALERT_RULE_ID_LABEL,
  ALERT_SOURCE_LABEL,
  ALERT_BACKEND_LABEL,
  'openshift_io_prometheus_rule_name',
  'openshift_io_prometheus_rule_namespace',
  'openshift_io_alerting_rule_name',
  'openshift_io_rule_managed_by',
  'openshift_io_relabel_config_managed_by',
  'openshift_io_alert_rule_component',
  'openshift_io_alert_rule_layer',
  'openshift_io_alert_rule_component_from',
  'openshift_io_alert_rule_layer_from',
  'openshift_io_alert_rule_classification_managed_by',
]);

const instanceLabels = (labels: Record<string, string>) =>
  Object.entries(labels).filter(([name]) => !metadataLabels.has(name));

const labelsMatch = (labels: [string, string][], candidate: Record<string, string>) =>
  labels.every(([name, value]) => candidate[name] === value);

const deduplicateAlerts = (alerts: PrometheusAlert[]) => {
  const uniqueAlerts = new Map<string, PrometheusAlert>();

  alerts.forEach((alert) => {
    const key = JSON.stringify(
      instanceLabels(alert.labels).sort(([first], [second]) => first.localeCompare(second)),
    );

    // prioritize alert from alertmanager since it will have accurate silence information
    if (!uniqueAlerts.has(key) || alert.labels[ALERT_BACKEND_LABEL] === 'alertmanager') {
      uniqueAlerts.set(key, alert);
    }
  });

  const instances = [...uniqueAlerts.values()];
  const alertmanagerAlerts = instances.filter(
    (alert) => alert.labels[ALERT_BACKEND_LABEL] === 'alertmanager',
  );

  // prefer alertmanager instances with additional external labels
  return instances.filter(
    (alert) =>
      alert.labels[ALERT_BACKEND_LABEL] === 'alertmanager' ||
      alertmanagerAlerts.filter((candidate) =>
        labelsMatch(instanceLabels(alert.labels), candidate.labels),
      ).length !== 1,
  );
};

export const combineAlertsAndRules = (
  rulesResponse: GetRulesResponse,
  alertsResponse: GetAlertsResponse,
): RuleWithEnablement[] => {
  const rulesWithEnablement = getRules(rulesResponse);

  const rulesById = new Map<string, RuleWithEnablement[]>();
  const rulesByName = new Map<string, RuleWithEnablement[]>();

  rulesWithEnablement.forEach((rule) => {
    rulesById.set(rule.id, [...(rulesById.get(rule.id) ?? []), rule]);
    rulesByName.set(rule.name, [...(rulesByName.get(rule.name) ?? []), rule]);
  });

  const alertsByRule = new Map<RuleWithEnablement, PrometheusAlert[]>();

  alertsResponse.data.alerts.forEach((alert) => {
    const ruleId = alert.alertRuleId || alert.labels[ALERT_RULE_ID_LABEL];
    const candidates = ruleId
      ? (rulesById.get(ruleId) ?? [])
      : (rulesByName.get(alert.labels.alertname) ?? []).filter((rule) =>
          labelsMatch(instanceLabels(rule.labels), alert.labels),
        );

    const source = alert.labels[ALERT_SOURCE_LABEL];
    const matches = candidates.filter(
      (rule) => !source || !rule.sourceId || source === rule.sourceId,
    );

    if (matches.length !== 1 || matches[0].alertingRuleEnabled === false) {
      return;
    }

    const rule = matches[0];
    let bucket = alertsByRule.get(rule);
    if (!bucket) {
      bucket = [];
      alertsByRule.set(rule, bucket);
    }
    bucket.push(alert);
  });

  return rulesWithEnablement.map((rule) => ({
    ...rule,
    alerts: deduplicateAlerts(alertsByRule.get(rule) ?? []).map((alert) => ({
      ...alert,
      state: alert.state as AlertStates,
      labels: { alertname: rule.name, ...alert.labels },
    })),
  }));
};

const getRules = (rulesResponse: GetRulesResponse): RuleWithEnablement[] => {
  const groups = structuredClone(rulesResponse.data.groups).map((group) => ({
    ...group,
    rules: group.rules
      .filter((rule) => rule.type === 'alerting')
      .map((rule) => ({
        ...rule,
        state: rule.state as RuleStates,
        alerts: rule.alerts.map((alert) => ({
          ...alert,
          state: alert.state as AlertStates,
          labels: { alertname: rule.name, ...alert.labels },
        })),
      })),
  }));
  return getAlertsAndRules({ groups }).rules.map((rule) => ({
    ...rule,
    id: rule.labels[ALERT_RULE_ID_LABEL] || rule.id,
    sourceId: rule.labels[ALERT_SOURCE_LABEL] || rule.sourceId,
  }));
};
