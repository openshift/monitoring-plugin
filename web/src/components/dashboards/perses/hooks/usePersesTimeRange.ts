import { DEFAULT_DASHBOARD_DURATION, DurationString, TimeRangeValue } from '@perses-dev/core';
import { NumberParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../../query-params';

export const usePersesTimeRange = (): TimeRangeValue => {
  const [timeRange] = useQueryParam(QueryParams.TimeRange, NumberParam);
  const [endTime] = useQueryParam(QueryParams.EndTime, NumberParam);

  if (!timeRange) {
    return {
      pastDuration: DEFAULT_DASHBOARD_DURATION,
    };
  }

  if (!endTime) {
    return {
      pastDuration: `${String(timeRange)}ms` as DurationString,
    };
  }

  return {
    start: new Date(endTime - timeRange),
    end: new Date(endTime),
  };
};
