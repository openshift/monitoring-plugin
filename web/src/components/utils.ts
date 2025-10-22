import fuzzy from 'fuzzysearch';
import * as _ from 'lodash-es';
import { murmur3 } from 'murmurhash-js';
import {
  Alert,
  AlertSeverity,
  AlertStates,
  PrometheusAlert,
  PrometheusEndpoint,
  PrometheusLabels,
  PrometheusRule,
  PrometheusRulesResponse,
  Rule,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import { AlertSource, MonitoringResource, Target, TimeRange } from './types';
import { QueryParams } from './query-params';

export const QUERY_CHUNK_SIZE = 24 * 60 * 60 * 1000;

export const PROMETHEUS_BASE_PATH = window.SERVER_FLAGS.prometheusBaseURL;
const PROMETHEUS_TENANCY_BASE_PATH = window.SERVER_FLAGS.prometheusTenancyBaseURL;
const PROMETHEUS_PROXY_PATH = '/api/proxy/plugin/monitoring-console-plugin/thanos-proxy';

export const ALERTMANAGER_BASE_PATH = window.SERVER_FLAGS.alertManagerBaseURL;
export const ALERTMANAGER_TENANCY_BASE_PATH = '/api/alertmanager-tenancy'; // remove it once it get added to SERVER_FLAGS
export const ALERTMANAGER_PROXY_PATH =
  '/api/proxy/plugin/monitoring-console-plugin/alertmanager-proxy';

export const AlertResource: MonitoringResource = {
  group: 'monitoring.coreos.com',
  resource: 'alertingrules',
  kind: 'Alert',
  label: 'Alert',
  url: '/monitoring/alerts',
  virtUrl: '/virt-monitoring/alerts',
  abbr: 'AL',
};

export const RuleResource: MonitoringResource = {
  group: 'monitoring.coreos.com',
  resource: 'alertingrules',
  kind: 'AlertRule',
  label: 'Alerting Rule',
  url: '/monitoring/alertrules',
  virtUrl: '/virt-monitoring/alertrules',
  abbr: 'AR',
};

export const SilenceResource: MonitoringResource = {
  group: 'monitoring.coreos.com',
  resource: 'alertmanagers',
  kind: 'Silence',
  label: 'Silence',
  url: '/monitoring/silences',
  virtUrl: '/virt-monitoring/silences',
  abbr: 'SL',
};

export const fuzzyCaseInsensitive = (a: string, b: string): boolean =>
  fuzzy(_.toLower(a), _.toLower(b));

export const labelsToParams = (labels: PrometheusLabels) =>
  _.map(labels, (v, k) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

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

export type ListOrder = (number | string)[];

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

export type MonitoringPlugins = 'monitoring-plugin' | 'monitoring-console-plugin';

export const ALL_NAMESPACES_KEY = '#ALL_NS#';

const DEFAULT_PROMETHEUS_SAMPLES = 60;
const DEFAULT_PROMETHEUS_TIMESPAN = 60 * 60 * 1000;

export type Prometheus = 'acm' | 'cmo';

// Range vector queries require end, start, and step search params
const getRangeVectorSearchParams = (
  endTime: number = Date.now(),
  samples: number = DEFAULT_PROMETHEUS_SAMPLES,
  timespan: number = DEFAULT_PROMETHEUS_TIMESPAN,
): URLSearchParams => {
  const params = new URLSearchParams();
  params.append('start', `${(endTime - timespan) / 1000}`);
  params.append('end', `${endTime / 1000}`);
  params.append('step', `${Math.ceil(timespan / samples / 1000)}`);
  return params;
};

const getSearchParams = ({
  endpoint,
  endTime,
  timespan,
  samples,
  ...params
}: PrometheusURLProps): URLSearchParams => {
  const searchParams =
    endpoint === PrometheusEndpoint.QUERY_RANGE
      ? getRangeVectorSearchParams(endTime, samples, timespan)
      : new URLSearchParams();
  _.each(params, (value, key) => value && searchParams.append(key, value.toString()));
  if (searchParams.get(QueryParams.Namespace) === ALL_NAMESPACES_KEY) {
    searchParams.delete(QueryParams.Namespace);
  }
  return searchParams;
};

export const getPrometheusBasePath = ({
  prometheus,
  namespace,
  basePathOverride,
}: {
  prometheus?: Prometheus;
  namespace?: string;
  basePathOverride?: string;
}) => {
  if (basePathOverride) {
    return basePathOverride;
  }

  if (prometheus === 'acm') {
    return PROMETHEUS_PROXY_PATH;
  } else if (namespace && namespace !== ALL_NAMESPACES_KEY) {
    return PROMETHEUS_TENANCY_BASE_PATH;
  } else {
    return PROMETHEUS_BASE_PATH;
  }
};

export const buildPrometheusUrl = ({
  prometheusUrlProps,
  basePath,
}: {
  prometheusUrlProps: PrometheusURLProps;
  basePath: string;
}): string | null => {
  if (prometheusUrlProps.endpoint !== PrometheusEndpoint.RULES && !prometheusUrlProps.query) {
    // Empty query provided, skipping API call
    return null;
  }

  const params = getSearchParams(prometheusUrlProps);
  return `${basePath}/${prometheusUrlProps.endpoint}?${params.toString()}`;
};

type PrometheusURLProps = {
  endpoint: PrometheusEndpoint;
  endTime?: number;
  namespace?: string;
  query?: string;
  samples?: number;
  timeout?: string;
  timespan?: number;
};

export const getAlertmanagerSilencesUrl = ({
  prometheus,
  namespace,
}: {
  prometheus: Prometheus;
  namespace?: string;
}) => {
  if (prometheus === 'acm') {
    return `${ALERTMANAGER_PROXY_PATH}/api/v2/silences`;
  } else if (namespace && namespace !== ALL_NAMESPACES_KEY) {
    return `${ALERTMANAGER_TENANCY_BASE_PATH}/api/v2/silences?namespace=${namespace}`;
  } else {
    return `${ALERTMANAGER_BASE_PATH}/api/v2/silences`;
  }
};

type AlertingContextId = 'observe-alerting' | 'dev-observe-alerting' | 'acm-observe-alerting';

export const getAlertingContextId = ({
  prometheus,
  namespace,
}: {
  prometheus: Prometheus;
  namespace?: string;
}): AlertingContextId => {
  if (prometheus === 'acm') {
    return 'acm-observe-alerting';
  } else if (namespace && namespace !== ALL_NAMESPACES_KEY) {
    return 'dev-observe-alerting';
  } else {
    return 'observe-alerting';
  }
};
