import { useSearchParams } from 'react-router';

import {
  AlertSort,
  defaultAlertSort,
  sortColumns,
} from '@/features/alert-management-api/utils/sort-alerts';

export const useAlertManagementSort = () => {
  const [params, setParams] = useSearchParams();
  const column = params.get('sort');
  const direction = params.get('sortDirection');
  const sort: AlertSort = {
    column: sortColumns.find((option) => option === column) ?? defaultAlertSort.column,
    direction: direction === 'desc' ? 'desc' : 'asc',
  };

  const setSort = (nextSort: AlertSort) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (
        nextSort.column === defaultAlertSort.column &&
        nextSort.direction === defaultAlertSort.direction
      ) {
        next.delete('sort');
        next.delete('sortDirection');
      } else {
        next.set('sort', nextSort.column);
        next.set('sortDirection', nextSort.direction);
      }
      return next;
    });

  return { sort, setSort };
};
