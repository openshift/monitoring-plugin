/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { AlertStateSummary } from '@/features/alert-management-api/components/AlertStateSummary';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

it('shows enablement followed by firing, pending and silenced counts', () => {
  const { container } = render(
    <AlertStateSummary
      enablement="Enabled"
      firingAlertCount={3}
      pendingAlertCount={2}
      silencedAlertCount={1}
    />,
  );
  expect(container.textContent).toBe(' Enabled 3 Firing 2 Pending 1 Silenced');
});

it('shows alert counts without enablement on the alerts page', () => {
  const { container } = render(
    <AlertStateSummary firingAlertCount={0} pendingAlertCount={2} silencedAlertCount={1} />,
  );
  expect(container.textContent).toBe(' 2 Pending 1 Silenced');
  expect(screen.queryByText(/Firing|Enabled|Disabled|Unknown/)).toBeNull();
});

it('shows only Disabled for a disabled rule with no alerts', () => {
  const { container } = render(
    <AlertStateSummary
      enablement="Disabled"
      firingAlertCount={0}
      pendingAlertCount={0}
      silencedAlertCount={0}
    />,
  );
  expect(container.textContent).toBe(' Disabled');
});
