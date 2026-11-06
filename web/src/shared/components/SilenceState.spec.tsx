/** @vitest-environment jsdom */
import { Silence } from '@openshift-console/dynamic-plugin-sdk';
import { render, screen } from '@testing-library/react';

import { SilenceState } from '@/shared/components/SilenceState';

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  SilenceStates: { Active: 'active', Pending: 'pending', Expired: 'expired' },
  GreenCheckCircleIcon: () => <span />,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it.each([
  ['active', 'Active'],
  ['pending', 'Pending'],
  ['expired', 'Expired'],
])('renders the %s silence state', (state, label) => {
  render(<SilenceState silence={{ status: { state } } as Silence} />);
  expect(
    screen.getByText(label),
    `The ${state} state should display the ${label} label`,
  ).toBeDefined();
});
it('does not mislabel a missing state as expired', () => {
  const { container } = render(<SilenceState silence={{} as Silence} />);
  expect(container.textContent, 'A missing silence state should render nothing').toBe('');
});
