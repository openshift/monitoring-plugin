import { useMemo } from 'react';

import { useLocation } from 'react-router';

export const FILTER_TYPES = {
  NAME: 'name',
  ALERT_STATE: 'alert-state',
  ALERT_SOURCE: 'alert-source',
  ALERT_CLUSTER: 'alert-cluster',
} as const;

export type SelectedFilters = {
  [filter in typeof FILTER_TYPES as string]: string[];
};

const useSelectedFilters = (): SelectedFilters => {
  const { search } = useLocation();
  const queryParams = useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);

  return useMemo(
    () =>
      Object.keys(queryParams)
        .filter(
          (queryKey) =>
            queryKey.startsWith('rowFilter-') ||
            (Object.values(FILTER_TYPES) as string[]).includes(queryKey),
        )
        .reduce((acc, queryKey) => {
          const filterType = queryKey.replace('rowFilter-', '');
          const filterValue = queryParams[queryKey].split(',');
          acc[filterType] = filterValue;
          return acc;
        }, {} as SelectedFilters),
    [queryParams],
  );
};

export default useSelectedFilters;
