import { DurationString } from '@perses-dev/core';
import { NumberParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../../query-params';

export const usePersesRefreshInterval = (): DurationString | undefined => {
  const [refreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);

  return refreshInterval ? (`${String(refreshInterval)}ms` as DurationString) : undefined;
};
