import { Fragment } from 'react';
import type { ReactElement } from 'react';

import type { AlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';

export type AlertColumnCell = {
  column: AlertColumn;
  component: ReactElement;
};

export function SortedColumnCells({
  columns,
  cells,
}: {
  columns: AlertColumn[];
  cells: AlertColumnCell[];
}) {
  return columns.map((column) => (
    <Fragment key={column}>{cells.find((cell) => cell.column === column)?.component}</Fragment>
  ));
}
