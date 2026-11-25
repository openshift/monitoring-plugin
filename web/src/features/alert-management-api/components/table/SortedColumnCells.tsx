import { Fragment } from 'react';
import type { ReactElement } from 'react';

export type ColumnCell<Column extends string> = {
  column: Column;
  component: ReactElement;
};

export function SortedColumnCells<Column extends string>({
  columns,
  cells,
}: {
  columns: Column[];
  cells: ColumnCell<Column>[];
}) {
  return columns.map((column) => (
    <Fragment key={column}>{cells.find((cell) => cell.column === column)?.component}</Fragment>
  ));
}
