/** @vitest-environment jsdom */

import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { fireEvent, render, screen } from '@testing-library/react';

import { AlertRuleState, AlertRuleStateValue } from '@/shared/components/AlertRuleState';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

it.each([
  [AlertStates.Firing, 'Firing'],
  [AlertStates.Pending, 'Pending'],
  [AlertStates.Silenced, 'Silenced'],
] as const)('preserves legacy %s counts and alert-state icons', (state, label) => {
  const { container } = render(<AlertRuleState state={state} count={3} />);
  expect(screen.getByText(`3 ${label}`)).toBeDefined();
  expect(container.querySelector('svg')).not.toBeNull();
});

it.each([
  ['enabled', 'Enabled'],
  ['disabled', 'Disabled'],
  [AlertStates.Firing, 'Firing'],
] satisfies Array<[AlertRuleStateValue, string]>)(
  'renders management state %s without a count',
  (state, label) => {
    const { container } = render(<AlertRuleState state={state} />);
    expect(screen.getByText(label)).toBeDefined();
    expect(container.textContent?.trim()).toBe(label);
    expect(container.querySelector('svg')).not.toBeNull();
  },
);

it('does not hide an explicit zero count', () => {
  render(<AlertRuleState state={AlertStates.Firing} count={0} />);
  expect(screen.getByText('0 Firing')).toBeDefined();
});

it('explains missing enablement without assuming a state', async () => {
  render(<AlertRuleState state="unknown" />);
  fireEvent.mouseEnter(screen.getByText('Unknown'));
  expect(await screen.findByRole('tooltip')).toHaveProperty(
    'textContent',
    'Rule enablement is not available from the API',
  );
});
