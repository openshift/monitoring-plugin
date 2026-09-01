import { DurationString } from '@perses-dev/spec';
import { NumberParam, useQueryParam } from 'use-query-params';

import { QueryParams } from '@/shared/constants/query-params';

export const usePersesRefreshInterval = (): DurationString | undefined => {
  const [refreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);

  return refreshInterval ? (`${String(refreshInterval)}ms` as DurationString) : undefined;
};
