import * as _ from 'lodash-es';
import { PrometheusEndpoint } from '@openshift-console/dynamic-plugin-sdk';
import { Perspective } from '../../../actions/observe';

export const PROMETHEUS_BASE_PATH = window.SERVER_FLAGS.prometheusBaseURL;
export const PROMETHEUS_TENANCY_BASE_PATH = window.SERVER_FLAGS.prometheusTenancyBaseURL;
const PROMETHEUS_PROXY_PATH = '/api/proxy/plugin/monitoring-console-plugin/thanos-proxy';

export const ALERTMANAGER_BASE_PATH = window.SERVER_FLAGS.alertManagerBaseURL;
export const ALERTMANAGER_TENANCY_BASE_PATH = '/api/alertmanager-tenancy'; // remove it once it get added to SERVER_FLAGS
export const ALERTMANAGER_PROXY_PATH =
  '/api/proxy/plugin/monitoring-console-plugin/alertmanager-proxy';

const DEFAULT_PROMETHEUS_SAMPLES = 60;
const DEFAULT_PROMETHEUS_TIMESPAN = 60 * 60 * 1000;

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
  return searchParams;
};

export const getPrometheusURL = (
  props: PrometheusURLProps,
  perspective: Perspective,
  basePath: string = props.namespace ? PROMETHEUS_TENANCY_BASE_PATH : PROMETHEUS_BASE_PATH,
): string => {
  if (props.endpoint !== PrometheusEndpoint.RULES && !props.query) {
    return '';
  }
  const path = perspective === 'acm' ? PROMETHEUS_PROXY_PATH : basePath;
  const params = getSearchParams(props);
  return `${path}/${props.endpoint}?${params.toString()}`;
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
