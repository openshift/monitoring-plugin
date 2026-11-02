/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { QueryParamProvider } from 'use-query-params';

import { AlertManagementLayout } from '@/features/alert-management-api/components/AlertManagementLayout';
import { AlertManagementProvider } from '@/features/alert-management-api/pages/AlertManagementRouter';
import {
  AlertRulesManagementPage,
  SilencesManagementPage,
} from '@/features/alert-management-api/pages/PlaceholderPages';
import { McpCmoAlertingPage } from '@/features/incidents/pages/IncidentsPage';
import { ReactRouter7Adapter } from '@/shared/utils/react-router-7-adapter';

const flags = vi.hoisted(() => ({ incidents: false }));
const queryTimes = vi.hoisted(() => ({
  rules: Date.UTC(2026, 8, 29, 12, 15, 0),
  silences: Date.UTC(2026, 8, 29, 12, 16, 15),
}));

vi.mock('@/features/incidents/pages/IncidentsPage', () => ({
  McpCmoAlertingPage: () => (
    <div>
      <h2>Incidents</h2>
    </div>
  ),
}));

vi.mock('@/features/alert-management-api/hooks/useAlertManagementData', () => ({
  useAlertManagementData: () => ({
    rulesQuery: { dataUpdatedAt: queryTimes.rules },
    silencesQuery: { dataUpdatedAt: queryTimes.silences },
  }),
}));

vi.mock('@/shared/contexts/MonitoringContext', () => ({
  MonitoringProvider: ({ children }: { children: ReactNode }) => (
    <QueryParamProvider adapter={ReactRouter7Adapter}>{children}</QueryParamProvider>
  ),
}));

vi.mock('@/shared/hooks/useFeatures', () => ({
  useFeatures: () => ({
    features: {
      'monitoring-plugin': { 'alert-management-api': true },
      'monitoring-console-plugin': { 'cluster-health-analyzer': flags.incidents },
    },
  }),
}));

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  AlertSeverity: { Critical: 'critical', Warning: 'warning', Info: 'info', None: 'none' },
  AlertStates: { Firing: 'firing', Pending: 'pending', Silenced: 'silenced' },
  DocumentTitle: () => null,
  ListPageHeader: ({ title, children }: { title: string; children?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const text = key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(values?.[name] ?? name),
      );
      return values?.count && Number(values.count) !== 1
        ? text
            .replace(/ second$/, ' seconds')
            .replace(/ minute$/, ' minutes')
            .replace(/ hour$/, ' hours')
        : text;
    },
  }),
}));

vi.mock('@patternfly/react-core', async () => {
  const actual =
    await vi.importActual<typeof import('@patternfly/react-core')>('@patternfly/react-core');
  return {
    ...actual,
    Tab: ({
      title,
      eventKey,
      ...props
    }: {
      title: ReactNode;
      eventKey?: string | number;
      [key: string]: unknown;
    }) => (
      <a {...props} data-event-key={eventKey} role="tab">
        {title}
      </a>
    ),
    Tabs: ({
      children,
      isSubtab,
      'aria-label': ariaLabel,
    }: {
      children: ReactNode;
      isSubtab?: boolean;
      'aria-label'?: string;
    }) => (
      <nav aria-label={ariaLabel} data-subtab={isSubtab || undefined}>
        {children}
      </nav>
    ),
    TabTitleText: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

const renderLayout = (pathname: string, children: ReactNode) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AlertManagementProvider>
        <AlertManagementLayout>{children}</AlertManagementLayout>
      </AlertManagementProvider>
    </MemoryRouter>,
  );

describe('alert management navigation', () => {
  beforeEach(() => {
    flags.incidents = false;
  });

  it('links directly to each alert management route', () => {
    renderLayout('/monitoring/v2/alerts', 'Alert list');

    expect(
      screen.getByRole('tab', { name: 'Alerts' }).getAttribute('href'),
      'the Alerts tab should link to the alerts route',
    ).toBe('/monitoring/v2/alerts');
    expect(
      screen.getByRole('tab', { name: 'Management' }).getAttribute('href'),
      'the Management tab should link to alert rules',
    ).toBe('/monitoring/v2/management/alertrules');
    expect(
      screen.queryByRole('tab', { name: 'Alert rules' }),
      'alert rule subtabs should be hidden outside management',
    ).toBeNull();
    expect(
      screen.queryByRole('tab', { name: 'Silences' }),
      'silence subtabs should be hidden outside management',
    ).toBeNull();
    const breadcrumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(breadcrumb.getByText('Observe'), 'the breadcrumb should include Observe').toBeDefined();
    expect(
      breadcrumb.getByRole('link', { name: 'Alerting' }),
      'the breadcrumb should link to Alerting',
    ).toBeDefined();
    expect(
      breadcrumb.getByText('Alerts').getAttribute('aria-current'),
      'the current Alerts breadcrumb should not be a link',
    ).toBeNull();
    expect(screen.getByText('Alert list'), 'the alerts page content should render').toBeDefined();
  });

  it('only offers incidents when the analyzer is enabled', () => {
    flags.incidents = true;
    renderLayout('/monitoring/v2/alerts', 'Alert list');

    expect(
      screen.getByRole('tab', { name: 'Incidents' }),
      'the Incidents tab should appear when the analyzer is enabled',
    ).toBeDefined();
    expect(
      screen.queryByRole('navigation', { name: 'Management pages' }),
      'management subtabs should be hidden outside management',
    ).toBeNull();
  });

  it('shows alert rule and silence tabs only within management', () => {
    renderLayout('/monitoring/v2/management/silences', 'Silences page');

    expect(
      screen.getByRole('tab', { name: 'Management' }).getAttribute('href'),
      'the Management tab should link to alert rules',
    ).toBe('/monitoring/v2/management/alertrules');
    expect(
      screen.getByRole('tab', { name: 'Alert rules' }).getAttribute('href'),
      'the Alert rules subtab should link to alert rules',
    ).toBe('/monitoring/v2/management/alertrules');
    expect(
      screen.getByRole('tab', { name: 'Silences' }).getAttribute('href'),
      'the Silences subtab should link to silences',
    ).toBe('/monitoring/v2/management/silences');
    expect(
      screen.getByRole('navigation', { name: 'Management pages' }),
      'management subtabs should appear on management routes',
    ).toBeDefined();
    const breadcrumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(
      breadcrumb.queryByRole('link', { name: 'Management' }),
      'the current Management breadcrumb should not be a link',
    ).toBeNull();
    expect(
      breadcrumb.getByText('Silences').getAttribute('aria-current'),
      'the current Silences breadcrumb should not be a link',
    ).toBeNull();
  });

  it('allows changing the refresh interval and shows the last refresh time', async () => {
    const lastRefreshedAt = queryTimes.silences;
    renderLayout('/monitoring/v2/alerts?refreshInterval=0', 'Alert list');

    expect(
      screen.getByText(`Last refresh: ${new Date(lastRefreshedAt).toLocaleTimeString()}`),
      'the last refresh time should be displayed',
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Refresh off' }),
      'the refresh control should show that refresh is off',
    ).toBeDefined();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Refresh off' })));
    await act(async () => fireEvent.click(screen.getByRole('option', { name: '15 seconds' })));
    expect(
      screen.getByRole('button', { name: 'Every 15 seconds' }),
      'the refresh control should show the selected interval',
    ).toBeDefined();
  });

  it('shows top-level alerts and management tabs from incidents', () => {
    flags.incidents = true;
    renderLayout('/monitoring/v2/incidents', <McpCmoAlertingPage />);

    expect(
      screen.getByRole('tab', { name: 'Incidents' }),
      'the Incidents tab should be available from incidents',
    ).toBeDefined();
    expect(
      screen.getByRole('tab', { name: 'Alerts' }),
      'the Alerts tab should be available from incidents',
    ).toBeDefined();
    expect(
      screen.getByRole('tab', { name: 'Management' }),
      'the Management tab should be available from incidents',
    ).toBeDefined();
    expect(
      screen.queryByRole('navigation', { name: 'Management pages' }),
      'management subtabs should not appear on incidents',
    ).toBeNull();
  });

  it('hides refresh controls and the last refresh time on incidents', () => {
    renderLayout('/monitoring/v2/incidents?refreshInterval=30000', <McpCmoAlertingPage />);

    expect(screen.getByRole('heading', { name: 'Incidents' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Every 30 seconds' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh off' })).toBeNull();
    expect(screen.queryByText(/^Last refresh:/)).toBeNull();
  });

  it.each([
    ['/monitoring/v2/management/alertrules', AlertRulesManagementPage, 'Alert rules'],
    ['/monitoring/v2/management/silences', SilencesManagementPage, 'Silences'],
  ])('renders the page for %s', (path, Page, message) => {
    renderLayout(path, <Page />);

    expect(
      screen.getByRole('heading', { name: message }),
      `the ${message} placeholder should render`,
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Every 30 seconds' }),
      'the default refresh interval should be displayed',
    ).toBeDefined();
    expect(
      screen.getByText(/^Last refresh:/),
      'the placeholder layout should display its last refresh time',
    ).toBeDefined();
  });
});
