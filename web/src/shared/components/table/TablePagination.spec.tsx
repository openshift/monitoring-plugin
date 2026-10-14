/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { TablePagination } from '@/shared/components/table/TablePagination';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

it('renders pagination without an action wrapper by default', () => {
  const { container } = render(<TablePagination itemCount={30} page={1} perPage={10} />);

  expect(container.firstElementChild?.classList.contains('pf-v6-c-pagination')).toBe(true);
});

it('renders both action slots and preserves pagination callbacks', () => {
  const onSetPage = vi.fn();
  render(
    <TablePagination
      itemCount={30}
      page={1}
      perPage={10}
      isCompact
      onSetPage={onSetPage}
      leftActions={<button>Aggregate alerts</button>}
      rightActions={<button>Manage columns</button>}
    />,
  );

  expect(screen.getByRole('button', { name: 'Aggregate alerts' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Manage columns' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
  expect(onSetPage.mock.calls[0][1]).toBe(2);
});

it.each(['leftActions', 'rightActions'] as const)('keeps %s available with no results', (slot) => {
  render(
    <TablePagination
      itemCount={0}
      page={1}
      perPage={10}
      {...{ [slot]: <button>Table action</button> }}
    />,
  );

  expect(screen.getByRole('button', { name: 'Table action' })).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Go to next page' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
