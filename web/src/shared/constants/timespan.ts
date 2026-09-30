import { NumberParam, withDefault } from 'use-query-params';

export const DEFAULT_TIMESPAN = 30 * 60 * 1000;

const DEFAULT_REFRESH_INTERVAL = 30 * 1000;

export const TimeRangeParam = withDefault(NumberParam, DEFAULT_TIMESPAN);
export const RefreshIntervalParam = withDefault(NumberParam, DEFAULT_REFRESH_INTERVAL);
