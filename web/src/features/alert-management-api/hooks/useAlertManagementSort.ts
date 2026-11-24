import { useSearchParams } from 'react-router';

import { TableSort } from '@/features/alert-management-api/types/types';
import { QueryParams } from '@/shared/constants/query-params';

export const useAlertManagementSort = <Column extends string>(
  columns: readonly Column[],
  defaultSort: TableSort<Column>,
) => {
  const [params, setParams] = useSearchParams();
  const column = params.get(QueryParams.Sort);
  const direction = params.get(QueryParams.SortDirection);
  const sort: TableSort<Column> = {
    column: columns.find((option) => option === column) ?? defaultSort.column,
    direction: defaultSort.direction,
  };
  if (direction === 'asc' || direction === 'desc') {
    sort.direction = direction;
  }

  const setSort = (nextSort: TableSort<Column>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set(QueryParams.Page, '1');
      if (nextSort.column === defaultSort.column && nextSort.direction === defaultSort.direction) {
        next.delete(QueryParams.Sort);
        next.delete(QueryParams.SortDirection);
      } else {
        next.set(QueryParams.Sort, nextSort.column);
        next.set(QueryParams.SortDirection, nextSort.direction);
      }
      return next;
    });

  return { sort, setSort };
};
