/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { SelectedFilters } from '@/features/alert-management-api/components/SelectedFilters';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('renders nothing for empty selections with non-alert keys', () => {
  const { container } = render(
    <SelectedFilters<{ creator: string[]; search: string }, 'creator'>
      filters={{ creator: [], search: '' }}
      defaults={{ creator: [], search: '' }}
      labels={{ creator: 'Creator' }}
      formatLabelText={(_key, value) => value}
      onChange={vi.fn()}
    />,
  );
  expect(container.textContent, 'Empty selections should not render filter chips').toBe('');
});

it('removes only the requested value and clears to caller defaults', () => {
  const onChange = vi.fn();
  const color = vi.fn(() => 'blue' as const);
  const status = vi.fn(() => undefined);
  const defaults = { creator: [], search: '' };
  render(
    <SelectedFilters<{ creator: string[]; search: string }, 'creator'>
      filters={{ creator: ['alice', 'bob'], search: 'maintenance' }}
      defaults={defaults}
      labels={{ creator: 'Creator' }}
      getLabelColor={color}
      getLabelStatus={status}
      formatLabelText={(_key, value) => value.toUpperCase()}
      onChange={onChange}
    />,
  );
  expect(
    screen.getByText('ALICE'),
    'Filter chips should use the supplied text formatter',
  ).toBeDefined();
  expect(color, 'The color callback should receive the filter key and value').toHaveBeenCalledWith(
    'creator',
    'alice',
  );
  expect(
    status,
    'The status callback should receive the filter key and value',
  ).toHaveBeenCalledWith('creator', 'bob');
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove filter' })[0]);
  expect(
    onChange,
    'Removing a chip should preserve other selections and search text',
  ).toHaveBeenLastCalledWith({ creator: ['bob'], search: 'maintenance' });
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(
    onChange,
    'Clearing filters should restore the caller-provided defaults',
  ).toHaveBeenLastCalledWith(defaults);
});
