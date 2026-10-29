/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { DropDownPollInterval } from '@/shared/components/DropdownPollInterval';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      const text = key.replace(/\{\{count\}\}/g, String(values?.count ?? 'count'));
      return values?.count && values.count !== 1
        ? text.replace(/ second$/, ' seconds').replace(/ minute$/, ' minutes')
        : text;
    },
  }),
}));

it('keeps the dashboard interval choices and emits milliseconds', async () => {
  const setInterval = vi.fn();
  render(<DropDownPollInterval selectedInterval={30_000} setInterval={setInterval} />);

  expect(screen.getByRole('button', { name: '30 seconds' })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '30 seconds' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: '15 seconds' })));
  expect(setInterval).toHaveBeenCalledWith(15_000);
});
