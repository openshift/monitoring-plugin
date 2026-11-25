/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';

import {
  ColumnCell,
  SortedColumnCells,
} from '@/features/alert-management-api/components/table/SortedColumnCells';

type Column = 'first' | 'second' | 'hidden' | 'missing';
const cells: ColumnCell<Column>[] = [
  { column: 'first', component: <span data-testid="column-cell">First</span> },
  { column: 'second', component: <span data-testid="column-cell">Second</span> },
  { column: 'hidden', component: <span data-testid="column-cell">Hidden</span> },
];

it('renders only selected cells in the requested order', () => {
  render(<SortedColumnCells columns={['second', 'first']} cells={cells} />);

  expect(screen.getAllByTestId('column-cell').map((cell) => cell.textContent)).toEqual([
    'Second',
    'First',
  ]);
  expect(screen.queryByText('Hidden')).toBeNull();
});

it('updates the cell order and visibility when columns change', () => {
  const { rerender } = render(<SortedColumnCells columns={['first', 'second']} cells={cells} />);

  rerender(<SortedColumnCells columns={['hidden', 'first']} cells={cells} />);

  expect(screen.getAllByTestId('column-cell').map((cell) => cell.textContent)).toEqual([
    'Hidden',
    'First',
  ]);
  expect(screen.queryByText('Second')).toBeNull();
});

it('skips columns without a matching cell', () => {
  render(<SortedColumnCells columns={['missing', 'first']} cells={cells} />);

  expect(screen.getAllByTestId('column-cell')).toHaveLength(1);
  expect(screen.getByText('First')).toBeDefined();
});

it('renders nothing when no columns are selected', () => {
  const { container } = render(<SortedColumnCells columns={[]} cells={cells} />);

  expect(container.childElementCount).toBe(0);
});
