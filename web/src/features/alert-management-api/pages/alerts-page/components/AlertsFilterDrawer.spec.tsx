/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { AlertsFilterDrawer } from '@/features/alert-management-api/pages/alerts-page/components/AlertsFilterDrawer';
import { testAlerts } from '@/features/alert-management-api/tests/fixtures/alerts-test-data';
import { defaultAlertFilters } from '@/features/alert-management-api/utils/alerts';
import { getSeverityColors } from '@/shared/utils/alerts/formatting';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? name),
  }),
}));

it('dims only unselected severities while keeping them clickable', () => {
  const onChange = vi.fn();
  const alerts = ['critical', 'warning', 'info'].map((severity) => ({
    ...testAlerts[4],
    labels: { ...testAlerts[4].labels, severity },
  }));
  const props = { alerts, onChange, onClose: vi.fn() };
  const { rerender } = render(<AlertsFilterDrawer {...props} filters={defaultAlertFilters} />);
  const severityButton = (severity: string) =>
    screen.getByRole('button', { name: `Filter ${severity} alerts` });
  const background = (severity: string) =>
    severityButton(severity)
      .querySelector<HTMLElement>('.pf-v6-c-label')
      .style.getPropertyValue('--pf-v6-c-label--BackgroundColor');

  for (const severity of ['critical', 'warning', 'info']) {
    expect(background(severity)).toBe('');
  }

  fireEvent.click(severityButton('critical'));
  rerender(<AlertsFilterDrawer {...props} filters={onChange.mock.lastCall[0]} />);

  expect(background('critical')).toBe('');
  expect(background('warning')).toBe(getSeverityColors('warning').mutedBackgroundColor);
  expect(background('info')).toBe(getSeverityColors('info').mutedBackgroundColor);

  fireEvent.click(severityButton('warning'));
  expect(onChange.mock.lastCall[0].severity).toEqual(['critical', 'warning']);
  rerender(<AlertsFilterDrawer {...props} filters={onChange.mock.lastCall[0]} />);

  expect(background('critical')).toBe('');
  expect(background('warning')).toBe('');
  expect(background('info')).toBe(getSeverityColors('info').mutedBackgroundColor);

  rerender(<AlertsFilterDrawer {...props} filters={defaultAlertFilters} />);

  for (const severity of ['critical', 'warning', 'info']) {
    expect(background(severity)).toBe('');
  }
});

it('preserves multiple namespace selections', async () => {
  const onChange = vi.fn();
  const namespaces = [
    testAlerts[4],
    { ...testAlerts[4], labels: { ...testAlerts[4].labels, namespace: 'team-b' } },
  ];
  const { rerender } = render(
    <AlertsFilterDrawer
      alerts={namespaces}
      filters={defaultAlertFilters}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );

  expect(
    screen.queryByText('Firing time'),
    'the drawer should not show a firing-time filter',
  ).toBeNull();

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Select namespaces' })));
  const search = screen.getByRole('textbox', { name: 'Search namespaces' });
  fireEvent.change(search, { target: { value: 'TEAM' } });
  expect(screen.getByText('team-b (1)'), 'namespace search should match team-b').toBeDefined();
  expect(
    screen.queryByText('workloads (1)'),
    'namespace search should hide non-matching namespaces',
  ).toBeNull();
  fireEvent.change(search, { target: { value: 'missing' } });
  expect(
    screen.getByText('No namespaces found'),
    'an unmatched namespace search should show an empty state',
  ).toBeDefined();
  fireEvent.change(search, { target: { value: '' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'workloads (1)' }));
  const selected = onChange.mock.lastCall[0];
  rerender(
    <AlertsFilterDrawer
      alerts={namespaces}
      filters={selected}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'workloads' }),
    'the selected namespace should appear as a filter',
  ).toBeDefined();
  fireEvent.click(screen.getByRole('checkbox', { name: 'team-b (1)' }));

  expect(
    onChange.mock.lastCall[0].namespace,
    'both selected namespaces should remain in the filter',
  ).toEqual(['workloads', 'team-b']);
  rerender(
    <AlertsFilterDrawer
      alerts={namespaces}
      filters={onChange.mock.lastCall[0]}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Select namespaces (2)' }),
    'the namespace control should show two selected values',
  ).toBeDefined();
  fireEvent.click(screen.getByRole('checkbox', { name: 'workloads (1)' }));
  expect(
    onChange.mock.lastCall[0].namespace,
    'deselecting workloads should leave team-b selected',
  ).toEqual(['team-b']);
});

it('uses dropdowns for alert filters other than severity and scope', async () => {
  const onChange = vi.fn();
  const managedAlerts = [
    {
      ...testAlerts[4],
      labels: {
        ...testAlerts[4].labels,
        team: 'payments',
      },
    },
  ];
  const { rerender } = render(
    <AlertsFilterDrawer
      alerts={managedAlerts}
      filters={defaultAlertFilters}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );

  for (const filter of [
    'Select namespaces',
    'Select labels',
    'Select components',
    'State',
    'Source',
  ]) {
    expect(
      screen.getByRole('button', { name: filter }),
      `${filter} should be presented as a dropdown`,
    ).toBeDefined();
  }
  expect(screen.getByText('Severity'), 'severity should remain a direct filter').toBeDefined();
  expect(
    screen.getByText('Alert Filters'),
    'the drawer should display its filter heading',
  ).toBeDefined();
  expect(
    screen.queryByText('Showing all states'),
    'the state dropdown should not use the old summary text',
  ).toBeNull();
  expect(
    screen.queryByText('Showing all sources'),
    'the source dropdown should not use the old summary text',
  ).toBeNull();
  expect(
    screen.getByText('Showing all namespaces'),
    'the namespace filter should show its default summary',
  ).toBeDefined();
  for (const name of ['Select namespaces', 'Select labels', 'Select components']) {
    expect(
      screen.getByRole('button', { name }).querySelector('svg[aria-hidden]'),
      `${name} should display its dropdown indicator`,
    ).not.toBeNull();
  }
  expect(
    screen.getByRole('heading', { name: 'Filter alerts' }).querySelector('svg[aria-hidden]'),
    'the filter heading should display its icon',
  ).not.toBeNull();
  expect(
    screen.getByRole('button', { name: 'Cluster' }),
    'the scope selector should show Cluster by default',
  ).toBeDefined();
  expect(
    screen.getByRole('button', { name: 'Help for Alert scope' }),
    'the alert scope help control should be available',
  ).toBeDefined();
  expect(
    screen.getByRole('button', { name: 'Help for Affected component' }),
    'the affected component help control should be available',
  ).toBeDefined();

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'State' })));
  const firingOption = screen.getByRole('checkbox', { name: 'Firing (1)' });
  expect(
    firingOption.closest('[role="menuitem"]')?.querySelector('svg'),
    'the selected firing state should display a selection indicator',
  ).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'State' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Source' })));
  expect(
    screen.getByRole('checkbox', { name: 'User (1)' }),
    'the source dropdown should list the User source',
  ).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Source' }));

  fireEvent.click(screen.getByRole('button', { name: 'Namespace' }));
  expect(
    onChange.mock.lastCall[0].scope,
    'selecting Namespace should update the scope filter',
  ).toEqual(['Namespace']);
  rerender(
    <AlertsFilterDrawer
      alerts={managedAlerts}
      filters={onChange.mock.lastCall[0]}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Namespace' }));
  expect(
    onChange.mock.lastCall[0].scope,
    'deselecting Namespace should clear the scope filter',
  ).toEqual([]);
});
