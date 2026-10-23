import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { AlertFilters } from '@/features/alert-management-api/types/types';
import { defaultAlertFilters } from '@/features/alert-management-api/utils/alerts';
import { formatPrometheusDuration } from '@/shared/console/console-shared/src/datetime/prometheus';
import { QueryParams } from '@/shared/constants/query-params';

const filterKeys = [
  'scope',
  'component',
  'severity',
  'state',
  'source',
  'namespace',
  'labels',
] as const;

export const useAlertManagementFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<AlertFilters>(() => {
    const parsed = { ...defaultAlertFilters };
    filterKeys.forEach((key) => {
      if (key === 'state') parsed.state = searchParams.getAll(key) as AlertFilters['state'];
      else parsed[key] = searchParams.getAll(key);
    });
    parsed.name = searchParams.get('name') ?? '';
    const timeRange = Number(searchParams.get(QueryParams.TimeRange) ?? 0);
    const endTimeParam = searchParams.get(QueryParams.EndTime);
    const endTime = endTimeParam === null ? undefined : Number(endTimeParam);
    if (endTime !== undefined && Number.isFinite(endTime)) {
      const startTime = endTime - (Number.isFinite(timeRange) ? timeRange : 0);
      const start = new Date(startTime).toISOString();
      const end = new Date(endTime).toISOString();
      parsed.firingTime = `custom:${start},${end}`;
    } else {
      parsed.firingTime = Number.isFinite(timeRange) ? formatPrometheusDuration(timeRange) : '';
    }
    return parsed;
  }, [searchParams]);

  const setFilters = (nextFilters: AlertFilters) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const clearFiringTime = filters.firingTime !== '' && nextFilters.firingTime === '';
      filterKeys.forEach((key) => {
        next.delete(key);
        nextFilters[key].forEach((value) => next.append(key, value));
      });
      next.delete('name');
      next.delete('firingTime');
      if (nextFilters.name) next.set('name', nextFilters.name);
      if (clearFiringTime) {
        next.delete(QueryParams.TimeRange);
        next.delete(QueryParams.EndTime);
      }
      return next;
    });
  };

  return { filters, setFilters };
};
