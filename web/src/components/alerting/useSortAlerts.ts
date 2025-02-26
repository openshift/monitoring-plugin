import { MouseEvent, useState } from 'react';

import { SortByDirection } from '@patternfly/react-table';
import { ThSortType } from '@patternfly/react-table/dist/esm/components/Table/base/types';
import { AggregatedAlert } from './AlertsAggregates';

const useSortAlerts = (
  aggregatedAlerts: AggregatedAlert[],
): { sortedStates: AggregatedAlert[]; nameSortParams: ThSortType } => {
  const [activeSortIndex, setActiveSortIndex] = useState<number | null>(null);
  const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc' | null>(null);

  let sortedStates = aggregatedAlerts;
  if (activeSortIndex === 1) {
    sortedStates = aggregatedAlerts.sort((a, b) => {
      const aValue = a.name as string;
      const bValue = b.name as string;

      if (activeSortDirection === 'asc') {
        return (aValue as string).localeCompare(bValue);
      }
      return (bValue as string).localeCompare(aValue);
    });
  }

  const nameSortParams: ThSortType = {
    sortBy: {
      index: activeSortIndex,
      direction: activeSortDirection,
    },
    onSort: (_event: MouseEvent, index: number, direction: SortByDirection) => {
      setActiveSortIndex(index);
      setActiveSortDirection(direction);
    },
    columnIndex: 1,
  };

  return { sortedStates, nameSortParams };
};

export default useSortAlerts;
