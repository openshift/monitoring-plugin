import {
  Alert,
  AlertSeverity,
  AlertStates,
  PrometheusAlert,
  PrometheusRule,
  PrometheusRulesResponse,
  Rule,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';
import type { LabelProps } from '@patternfly/react-core';
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
  t_global_text_color_regular,
} from '@patternfly/react-tokens';
import * as _ from 'lodash-es';
import { murmur3 } from 'murmurhash-js';

import { AggregatedAlert } from '@/shared/types/types';

export const getSeverityColors = (
  severity?: string | null,
): { labelColor: LabelProps['color']; textColor: string } => {
  switch (severity) {
    case AlertSeverity.Critical:
      return { labelColor: 'red', textColor: t_global_color_status_danger_default.var };
    case AlertSeverity.Warning:
      return { labelColor: 'orange', textColor: t_global_color_status_warning_default.var };
    case AlertSeverity.Info:
      return { labelColor: 'purple', textColor: t_global_color_status_info_default.var };
    default:
      return { labelColor: 'grey', textColor: t_global_text_color_regular.var };
  }
};

export const getAlertsAndRules = (
  data: PrometheusRulesResponse['data'],
): { alerts: Alert[]; rules: Rule[] } => {
  // Flatten the rules data to make it easier to work with, discard non-alerting rules since those
  // are the only ones we will be using and add a unique ID to each rule.
  const groups = _.get(data, 'groups') as PrometheusRulesResponse['data']['groups'];
  const rules = _.flatMap(groups, (g) => {
    const addID = (r: PrometheusRule): Rule => {
      const key = [
        g.file,
        g.name,
        r.name,
        r.duration,
        r.query,
        ..._.map(r.labels, (k, v) => `${k}=${v}`),
      ].join(',');
      return { ...r, id: String(murmur3(key, 'monitoring-salt')) };
    };

    return _.filter(g.rules, { type: 'alerting' }).map(addID);
  });

  // The console codebase and developer perspective actions don't expect the external labels to be
  // included on the alerts
  // Add external labels to all `rules[].alerts[].labels`
  rules.forEach((rule) => {
    rule.alerts.forEach((alert) => (alert.labels = { ...rule.labels, ...alert.labels }));
  });

  // Add `rule` object to each alert
  const alerts = _.flatMap(rules, (rule) => rule.alerts.map((a) => ({ rule, ...a })));

  return { alerts, rules };
};

export const alertState = (a: Alert): AlertStates => a?.state;
export const silenceState = (s: Silence): SilenceStates => s?.status?.state;
export const silenceCluster = (s: Silence): string =>
  s?.matchers.find((label) => label.name === 'cluster')?.value ?? '';

export const silenceMatcherEqualitySymbol = (isEqual: boolean, isRegex: boolean): string => {
  if (isRegex) {
    return isEqual ? '=~' : '!~';
  }
  return isEqual ? '=' : '!=';
};

export const getSilenceName = (silence: Silence) => {
  const name = _.get(_.find(silence.matchers, { name: 'alertname' }), 'value');
  return name
    ? name
    : // No alertname, so fall back to displaying the other matchers
      silence.matchers
        .map((m) => `${m.name}${silenceMatcherEqualitySymbol(m.isEqual, m.isRegex)}${m.value}`)
        .join(', ');
};

export const alertDescription = (alert: PrometheusAlert | Rule): string =>
  alert.annotations?.description || alert.annotations?.message || alert.labels?.alertname;

export const alertingRuleStateSort = (a: Rule, b: Rule): number => {
  const countsA = _.countBy(a.alerts, 'state');
  const countsB = _.countBy(b.alerts, 'state');
  for (const state of [AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced]) {
    const diff = (countsB[state] ?? 0) - (countsA[state] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

export const severitySort = (
  a: Alert | Rule | AggregatedAlert,
  b: Alert | Rule | AggregatedAlert,
): number => {
  const severityA = (('severity' in a ? a.severity : a.labels?.severity) ?? '').toLowerCase();
  const severityB = (('severity' in b ? b.severity : b.labels?.severity) ?? '').toLowerCase();

  const rank = new Map<string, number>([
    [AlertSeverity.None, 0],
    [AlertSeverity.Info, 1],
    [AlertSeverity.Warning, 2],
    [AlertSeverity.Critical, 3],
  ]);

  const rankA = rank.get(severityA) ?? -1;
  const rankB = rank.get(severityB) ?? -1;
  if (rankA !== rankB) return rankB - rankA;

  return severityA.localeCompare(severityB, undefined, { sensitivity: 'base' });
};
