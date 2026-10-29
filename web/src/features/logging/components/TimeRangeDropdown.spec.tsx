/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { TimeRangeDropdown } from '@/features/logging/components/TimeRangeDropdown';

vi.mock('@/features/logging/components/TimeRangeSelectModal', () => ({
  TimeRangeSelectModal: () => null,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it.each(['monitoring-plugin', 'monitoring-console-plugin'])(
  'uses the %s translation namespace for time-range options',
  async (plugin) => {
    const namespace = `plugin__${plugin}`;
    vi.stubEnv('I18N_NAMESPACE', namespace);
    const i18n = createInstance();
    await i18n.init({
      lng: 'fr',
      keySeparator: false,
      nsSeparator: '~',
      defaultNS: namespace,
      resources: { fr: { [namespace]: { 'Last 5 minutes': 'Les cinq dernières minutes' } } },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <TimeRangeDropdown />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Last 1 hour' }));
    expect(await screen.findByText('Les cinq dernières minutes')).toBeTruthy();
  },
);
