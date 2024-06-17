import fuzzy from 'fuzzysearch';
import * as _ from 'lodash-es';
import { murmur3 } from 'murmurhash-js';
import { Dispatch } from 'react-redux';
import {
  Alert,
  AlertSeverity,
  AlertStates,
  consoleFetchJSON,
  PrometheusAlert,
  PrometheusLabels,
  PrometheusRule,
  PrometheusRulesResponse,
  Rule,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import { alertingErrored, alertingLoaded, alertingLoading } from '../actions/observe';
import { AlertSource, MonitoringResource, Target, TimeRange } from './types';

export const PROMETHEUS_BASE_PATH = window.SERVER_FLAGS.prometheusBaseURL;
export const QUERY_CHUNK_SIZE = 24 * 60 * 60 * 1000;

export const AlertResource: MonitoringResource = {
  kind: 'Alert',
  label: 'Alert',
  plural: '/monitoring/alerts',
  abbr: 'AL',
};

export const RuleResource: MonitoringResource = {
  kind: 'AlertRule',
  label: 'Alerting Rule',
  plural: '/monitoring/alertrules',
  abbr: 'AR',
};

export const SilenceResource: MonitoringResource = {
  kind: 'Silence',
  label: 'Silence',
  plural: '/monitoring/silences',
  abbr: 'SL',
};

export const fuzzyCaseInsensitive = (a: string, b: string): boolean =>
  fuzzy(_.toLower(a), _.toLower(b));

export const labelsToParams = (labels: PrometheusLabels) =>
  _.map(labels, (v, k) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

export const alertURL = (alert: PrometheusAlert, ruleID: string) =>
  `${AlertResource.plural}/${ruleID}?${labelsToParams(alert.labels)}`;

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

export const silenceMatcherEqualitySymbol = (isEqual: boolean, isRegex: boolean): string => {
  if (isRegex) {
    return isEqual ? '=~' : '!~';
  }
  return isEqual ? '=' : '!=';
};

const getSilenceName = (silence: Silence) => {
  const name = _.get(_.find(silence.matchers, { name: 'alertname' }), 'value');
  return name
    ? name
    : // No alertname, so fall back to displaying the other matchers
      silence.matchers
        .map((m) => `${m.name}${silenceMatcherEqualitySymbol(m.isEqual, m.isRegex)}${m.value}`)
        .join(', ');
};

export const refreshSilences = (dispatch: Dispatch): void => {
  const { alertManagerBaseURL } = window.SERVER_FLAGS;
  if (!alertManagerBaseURL) {
    return;
  }

  dispatch(alertingLoading('silences'));

  consoleFetchJSON(`${alertManagerBaseURL}/api/v2/silences`)
    .then((silences) => {
      // Set a name field on the Silence to make things easier
      _.each(silences, (s) => {
        s.name = getSilenceName(s);
      });
      dispatch(alertingLoaded('silences', silences));
    })
    .catch((e) => {
      dispatch(alertingErrored('silences', e));
    });
};

export const alertDescription = (alert: PrometheusAlert | Rule): string =>
  alert.annotations?.description || alert.annotations?.message || alert.labels?.alertname;

// Determine if an Alert is silenced by a Silence (if all of the Silence's matchers match one of the
// Alert's labels)
export const isSilenced = (alert: Alert, silence: Silence): boolean =>
  [AlertStates.Firing, AlertStates.Silenced].includes(alert.state) &&
  _.every(silence.matchers, (m) => {
    const alertValue = _.get(alert.labels, m.name, '');
    const isMatch = m.isRegex
      ? new RegExp(`^${m.value}$`).test(alertValue)
      : alertValue === m.value;
    return m.isEqual === false && alertValue ? !isMatch : isMatch;
  });

type ListOrder = (number | string)[];

// Severity sort order is "critical" > "warning" > (anything else in A-Z order) > "none"
export const alertSeverityOrder = (alert: Alert | Rule): ListOrder => {
  const { severity } = alert.labels;
  const order: number =
    {
      [AlertSeverity.Critical]: 1,
      [AlertSeverity.Warning]: 2,
      [AlertSeverity.None]: 4,
    }[severity] ?? 3;
  return [order, severity];
};

export const alertingRuleStateOrder = (rule: Rule): ListOrder => {
  const counts = _.countBy(rule.alerts, 'state');
  return [AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced].map(
    (state) => Number.MAX_SAFE_INTEGER - (counts[state] ?? 0),
  );
};

export const targetSource = (target: Target): AlertSource =>
  target.labels?.prometheus === 'openshift-monitoring/k8s'
    ? AlertSource.Platform
    : AlertSource.User;

export const isTimeoutError = (err: Error): boolean =>
  err.name === 'TimeoutError' || err.message.includes('timed out');

/**
 * This function is used to get the parameters needed to break a long time period down into smaller
 * chunks which won't timeout
 *
 * @param timespan Total length of time to cover
 */
export const getTimeRanges = (
  timespan: number,
  maxEndTime: number = Date.now(),
): Array<TimeRange> => {
  if (timespan < QUERY_CHUNK_SIZE * 7) {
    // If the query is smaller than a week, leave the the query the same since it won't timeout
    return [{ endTime: maxEndTime, duration: timespan }];
  }
  const startTime = maxEndTime - timespan;
  const timeRanges = [{ endTime: startTime + QUERY_CHUNK_SIZE, duration: QUERY_CHUNK_SIZE }];
  while (timeRanges.at(-1).endTime < maxEndTime) {
    const nextEndTime = timeRanges.at(-1).endTime + QUERY_CHUNK_SIZE;
    timeRanges.push({ endTime: nextEndTime, duration: QUERY_CHUNK_SIZE });
  }
  return timeRanges;
};
