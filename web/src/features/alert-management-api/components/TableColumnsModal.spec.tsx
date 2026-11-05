/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { TableColumnsModal } from '@/features/alert-management-api/components/TableColumnsModal';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@patternfly/react-component-groups/dist/dynamic/ColumnManagementModal', () => ({
  default: ({
    appliedColumns,
    applyColumns,
  }: {
    appliedColumns: {
      key: string;
      title: string;
      isShown: boolean;
      isShownByDefault: boolean;
      isUntoggleable: boolean;
    }[];
    applyColumns: (columns: typeof appliedColumns) => void;
  }) => (
    <>
      <output>{JSON.stringify(appliedColumns)}</output>
      <button onClick={() => applyColumns([...appliedColumns].reverse())}>Apply</button>
    </>
  ),
}));

it('orders configured columns, ignores obsolete keys, and preserves default and required metadata', () => {
  const onSave = vi.fn();
  render(
    <TableColumnsModal
      isOpen
      definitions={[
        { key: 'name', label: 'Name' },
        { key: 'state', label: 'State' },
        { key: 'creator', label: 'Creator' },
      ]}
      columns={['state', 'obsolete', 'name']}
      defaults={['name', 'creator']}
      required={['name']}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  expect(
    JSON.parse(screen.getByRole('status').textContent!),
    'Columns should preserve configured order and metadata while omitting obsolete keys',
  ).toEqual([
    { key: 'state', title: 'State', isShown: true, isShownByDefault: false, isUntoggleable: false },
    { key: 'name', title: 'Name', isShown: true, isShownByDefault: true, isUntoggleable: true },
    {
      key: 'creator',
      title: 'Creator',
      isShown: false,
      isShownByDefault: true,
      isUntoggleable: false,
    },
  ]);
  fireEvent.click(screen.getByText('Apply'));
  expect(
    onSave,
    'Saving should include only visible columns in the applied order',
  ).toHaveBeenCalledWith(['name', 'state']);
});
