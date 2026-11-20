import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';

import { PrometheusAlert } from '@/shared/clients/alert-management-api/generated/api';
import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';

const ruleIdLabel = 'openshift_io_alert_rule_id';
const sourceLabel = 'openshift_io_alert_source';

export function applyAlertsToRules(rules: Rule[], alerts: PrometheusAlert[]): Rule[] {
  const silencedByInstance = new Map<string, PrometheusAlert[]>();
  alerts.forEach((alert) => {
    if (alert.state !== 'silenced') {
      return;
    }
    const key = computeAlertFingerprint(alert.labels, true);
    const instances = silencedByInstance.get(key) ?? [];
    instances.push(alert);
    silencedByInstance.set(key, instances);
  });

  return rules.map((rule) => ({
    ...rule,
    // Silencing changes notification state, not the rule's evaluation state.
    alerts: rule.alerts.map((alert) => {
      if (alert.state !== AlertStates.Firing) {
        return alert;
      }
      const key = computeAlertFingerprint(alert.labels, true);
      const silenced = silencedByInstance.get(key)?.some((candidate) => {
        // Fingerprints exclude source and rule ID; compare them when both sides provide them.
        const candidateRuleId = candidate.alertRuleId || candidate.labels[ruleIdLabel];
        const ruleId = rule.labels[ruleIdLabel];
        if (candidateRuleId && ruleId && candidateRuleId !== ruleId) {
          return false;
        }
        const candidateSource = candidate.labels[sourceLabel];
        const ruleSource = rule.sourceId || rule.labels[sourceLabel];
        return !candidateSource || !ruleSource || candidateSource === ruleSource;
      });
      return silenced ? { ...alert, state: AlertStates.Silenced } : alert;
    }),
  }));
}
