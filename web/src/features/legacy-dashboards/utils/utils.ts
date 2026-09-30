import { NumberParam, withDefault } from 'use-query-params';

import { DEFAULT_TIMESPAN } from '@/shared/constants/timespan';

export const DEFAULT_GRAPH_SAMPLES = 60;

const DEFAULT_REFRESH_INTERVAL = 30 * 1000;

export const TimeRangeParam = withDefault(NumberParam, DEFAULT_TIMESPAN);
export const RefreshIntervalParam = withDefault(NumberParam, DEFAULT_REFRESH_INTERVAL);
