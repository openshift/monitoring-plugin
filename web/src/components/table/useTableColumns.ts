import { DataViewTh } from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import { ISortBy, ThProps } from '@patternfly/react-table';
import { useCallback, useMemo } from 'react';

export interface ColumnKey {
  label: string;
  key: string;
  props?: Omit<ThProps, 'sort'>;
}

export const useTableColumns = (
  columnKeys: ColumnKey[],
  sortBy: string | undefined,
  direction: ISortBy['direction'],
  onSort: (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent | undefined,
    newSortBy: string,
    newSortDirection: ISortBy['direction'],
  ) => void,
  nonSortableIndices?: number[],
): DataViewTh[] => {
  const sortByIndex = useMemo(
    () => columnKeys.findIndex((item) => item.key === sortBy),
    [sortBy, columnKeys],
  );

  const getSortParams = useCallback(
    (columnIndex: number): ThProps['sort'] => {
      if (nonSortableIndices?.includes(columnIndex)) {
        return undefined;
      }
      return {
        sortBy: {
          index: sortByIndex,
          direction,
          defaultDirection: 'asc',
        },
        onSort: (_event, index, direction) => onSort(_event, columnKeys[index].key, direction),
        columnIndex,
      };
    },
    [columnKeys, direction, onSort, sortByIndex, nonSortableIndices],
  );

  const columns: DataViewTh[] = useMemo(
    () =>
      columnKeys.map((column, index) => ({
        cell: column.label,
        props: { sort: getSortParams(index), ...column.props },
      })),
    [getSortParams, columnKeys],
  );

  return columns;
};
