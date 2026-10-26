/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { AlertSeverityButton } from '@/features/alert-management-api/components/AlertSeverityButton';

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  AlertSeverity: { Critical: 'critical', Warning: 'warning', Info: 'info', None: 'none' },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? name)),
  }),
}));

it.each([
  ['critical', undefined, 'Critical'],
  ['critical', 0, 'Critical: 0'],
  ['critical', 5, 'Critical: 5'],
  ['warning', 1, 'Warning: 1'],
])('shows the %s severity tooltip with count %s', async (severity, count, tooltip) => {
  render(<AlertSeverityButton severity={severity} count={count} onClick={vi.fn()} />);

  fireEvent.mouseEnter(screen.getByRole('button', { name: `Filter ${severity} alerts` }));
  expect((await screen.findByRole('tooltip')).textContent).toBe(tooltip);
});
