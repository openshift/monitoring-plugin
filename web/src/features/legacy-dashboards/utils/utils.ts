import { NumberParam, withDefault } from 'use-query-params';

export const MONITORING_DASHBOARDS_DEFAULT_TIMESPAN = 30 * 60 * 1000;

export const MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY = 'ALL_OPTION_KEY';

export const DEFAULT_GRAPH_SAMPLES = 60;

const DEFAULT_REFRESH_INTERVAL = 30 * 1000;

export const TimeRangeParam = withDefault(NumberParam, MONITORING_DASHBOARDS_DEFAULT_TIMESPAN);
export const RefreshIntervalParam = withDefault(NumberParam, DEFAULT_REFRESH_INTERVAL);
