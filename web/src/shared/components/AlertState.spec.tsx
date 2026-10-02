/** @vitest-environment jsdom */

import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { render, screen } from '@testing-library/react';
import { TFunction } from 'i18next';

import { AlertState, getAlertStateKey } from '@/shared/components/AlertState';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const translate = ((key: string) => key) as TFunction;

describe('AlertState', () => {
  it.each([AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced])(
    'renders the translated %s state with its icon',
    (state) => {
      const { container } = render(<AlertState state={state} />);

      expect(screen.getByText(getAlertStateKey(state, translate))).toBeTruthy();
      expect(container.querySelector('svg')).not.toBeNull();
    },
  );

  it('keeps the legacy fallback for non-active states', () => {
    render(<AlertState state={AlertStates.NotFiring} />);

    expect(screen.getByText('Not Firing')).toBeTruthy();
    expect(getAlertStateKey(AlertStates.NotFiring, translate)).toBe('Not Firing');
  });
});
