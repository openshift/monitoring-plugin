import { PrometheusEndpoint, PrometheusLabels } from '@openshift-console/dynamic-plugin-sdk';
import fuzzy from 'fuzzysearch';
import * as _ from 'lodash-es';

import { QueryParams } from '@/shared/constants/query-params';
import { AlertSource, MonitoringResource, Target, TimeRange } from '@/shared/types/types';

export const QUERY_CHUNK_SIZE = 24 * 60 * 60 * 1000;

export const PROMETHEUS_BASE_PATH = window.SERVER_FLAGS.prometheusBaseURL;
const PROMETHEUS_TENANCY_BASE_PATH = window.SERVER_FLAGS.prometheusTenancyBaseURL;
const PROMETHEUS_PROXY_PATH = '/api/proxy/plugin/monitoring-console-plugin/thanos-proxy';
const ALERT_MANAGEMENT_API_BASE_PATH = '/api/v1/alerting';

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

export type Prometheus = 'acm' | 'cmo' | 'alert-management-api';

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
  useTenancyPath,
  basePathOverride,
}: {
  prometheus?: Prometheus;
  useTenancyPath?: boolean;
  basePathOverride?: string;
}) => {
  if (basePathOverride) {
    return basePathOverride;
  }

  if (prometheus === 'alert-management-api') {
    return ALERT_MANAGEMENT_API_BASE_PATH;
  } else if (prometheus === 'acm') {
    return PROMETHEUS_PROXY_PATH;
  } else if (useTenancyPath) {
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
  if (
    basePath !== PROMETHEUS_TENANCY_BASE_PATH ||
    prometheusUrlProps.namespace === ALL_NAMESPACES_KEY
  ) {
    prometheusUrlProps.namespace = undefined;
  }
  if (prometheusUrlProps.endpoint !== PrometheusEndpoint.RULES && !prometheusUrlProps.query) {
    // Empty query provided, skipping API call
    return null;
  }

  const params = getSearchParams(prometheusUrlProps);
  return `${basePath}/${prometheusUrlProps.endpoint}${
    params.size > 0 ? '?' + params.toString() : ''
  }`;
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
  useTenancyPath,
  namespace,
}: {
  prometheus: Prometheus;
  useTenancyPath: boolean;
  namespace?: string;
}) => {
  if (prometheus === 'acm') {
    return `${ALERTMANAGER_PROXY_PATH}/api/v2/silences`;
  } else if (useTenancyPath && namespace && namespace !== ALL_NAMESPACES_KEY) {
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
