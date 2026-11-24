/** @vitest-environment jsdom */

import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import type { Action, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import { AlertActions } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertActions';
import { testAlerts } from '@/features/alert-management-api/tests/fixtures/alerts-test-data';
import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { AgenticRunModel } from '@/shared/console/models';
import { getAlertFingerprintPrefix } from '@/shared/hooks/agentic-runs/alert-identifier';
import {
  AGENTIC_RUN_LABEL_FINGERPRINT,
  AGENTIC_RUN_LABEL_SOURCE,
  AGENTIC_RUN_NAMESPACE,
  AGENTIC_RUN_SOURCE_ALERTMANAGER,
} from '@/shared/hooks/agentic-runs/constants';

const { check, prefetch, actionService, k8sListItems, accessReview, monitoring, setNamespace } =
  vi.hoisted(() => ({
    check: vi.fn(),
    prefetch: vi.fn(),
    actionService: vi.fn(),
    k8sListItems: vi.fn(),
    accessReview: vi.fn(),
    monitoring: vi.fn(),
    setNamespace: vi.fn(),
  }));

vi.mock('@/shared/hooks/agentic-runs/useAgenticRunCheck', () => ({ useAgenticRunCheck: check }));
vi.mock('@/shared/hooks/useMonitoring', () => ({ useMonitoring: monitoring }));

vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types')),
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
  ActionServiceProvider: ({ context, children }) => children(actionService(context)),
  k8sListItems,
  useAccessReview: accessReview,
  useActiveNamespace: () => ['#ALL_NS#', setNamespace],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? name),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  k8sListItems.mockReset();
  accessReview.mockReset().mockReturnValue([true, false]);
  monitoring.mockReturnValue({
    useAlertsTenancy: false,
    accessCheckLoading: false,
  });
  check.mockReturnValue({ agenticRuns: [], hasAgenticRun: false, prefetch, isFetching: false });
  actionService.mockReturnValue({ actions: [], loaded: true });
});

const alert = testAlerts[0];

async function renderActions(selectedAlert: ManagedAlert = alert) {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts?name=Alert1&alertID=old']}>
      <AlertActions alert={selectedAlert} />
    </MemoryRouter>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Actions for/ }));
  });
}

function itemUrl(name: string | RegExp) {
  const item = screen.getByRole('menuitem', { name });
  expect(item.tagName).toBe('A');
  return new URL(item.getAttribute('href'), 'https://console.example.com');
}

it('offers only the implemented actions when no AI actions are available', async () => {
  await renderActions();
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Silence alertTemporarily stop notifications for this alert.',
    'View alert rule',
    'View metrics',
  ]);
  expect(actionService).toHaveBeenCalledWith({ 'monitoring-alert-list-item': { alert } });
  expect(check).toHaveBeenCalledWith(alert);
});

it('describes silencing and separates it from navigation actions', async () => {
  await renderActions();
  const silenceItem = screen.getByRole('menuitem', { name: /^Silence alert/ });
  expect(silenceItem.textContent).toContain('Temporarily stop notifications for this alert.');
  const separator = screen.getByRole('separator');
  expect(silenceItem.closest('li').nextElementSibling).toBe(separator);
  expect(separator.nextElementSibling).toBe(
    screen.getByRole('menuitem', { name: 'View alert rule' }).closest('li'),
  );
});

it('links to the create-silence page with every alert label prefilled', async () => {
  const selectedAlert = { ...alert, labels: { ...alert.labels, custom: 'a b&c="d"' } };
  await renderActions(selectedAlert);
  const url = itemUrl(/^Silence alert/);
  expect(url.pathname).toBe('/monitoring/v2/management/silences/~new');
  expect(Object.fromEntries(url.searchParams)).toEqual(selectedAlert.labels);
});

function CurrentLocation() {
  const { pathname, search } = useLocation();
  return (
    <output data-testid="location">
      {pathname}
      {search}
    </output>
  );
}

it.each([
  ['Ctrl-click', { ctrlKey: true }],
  ['Meta-click', { metaKey: true }],
  ['Shift-click', { shiftKey: true }],
  ['Alt-click', { altKey: true }],
  ['non-primary click', { button: 1 }],
])('leaves %s on Silence alert to the browser', async (_gesture, eventInit) => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts']}>
      <CurrentLocation />
      <AlertActions alert={alert} />
    </MemoryRouter>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Actions for/ }));
  });
  expect(fireEvent.click(screen.getByRole('menuitem', { name: /^Silence alert/ }), eventInit)).toBe(
    true,
  );
  expect(setNamespace).not.toHaveBeenCalled();
  expect(screen.getByTestId('location').textContent).toBe('/monitoring/v2/alerts');
});

it('navigates with the router to a prefilled create page on a plain click', async () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts']}>
      <CurrentLocation />
      <AlertActions alert={alert} />
    </MemoryRouter>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Actions for/ }));
  });
  expect(fireEvent.click(screen.getByRole('menuitem', { name: /^Silence alert/ }))).toBe(false);
  expect(setNamespace).toHaveBeenCalledExactlyOnceWith(alert.labels.namespace);
  const url = new URL(screen.getByTestId('location').textContent!, 'https://console.example.com');
  expect(url.pathname).toBe('/monitoring/v2/management/silences/~new');
  expect(Object.fromEntries(url.searchParams)).toEqual(alert.labels);
});

it('links to the new rule table with only the rule selection', async () => {
  await renderActions();
  const url = itemUrl('View alert rule');
  expect(url.pathname).toBe('/monitoring/v2/management/alertrules');
  expect([...url.searchParams]).toEqual([['alertRuleID', alert.rule.id]]);
});

it('links to metrics with the rule expression', async () => {
  await renderActions();
  const url = itemUrl('View metrics');
  expect(url.pathname).toBe('/monitoring/query-browser');
  expect(url.searchParams.get('query0')).toBe(alert.rule.query);
});

it('disables metrics when the rule has no expression', async () => {
  await renderActions({ ...alert, rule: { ...alert.rule, query: '' } });
  const item = screen.getByRole('menuitem', { name: 'View metrics' });
  expect(item.getAttribute('aria-disabled')).toBe('true');
  expect(fireEvent.click(item)).toBe(false);
});

it('prefetches investigations on pointer hover and keyboard focus', async () => {
  await renderActions();
  prefetch.mockClear();
  const toggle = screen.getByRole('button', { name: /Actions for/ });
  fireEvent.mouseEnter(toggle);
  expect(prefetch).toHaveBeenCalledOnce();
  fireEvent.focus(toggle);
  expect(prefetch).toHaveBeenCalledTimes(2);
});

it('shows a disabled loading item while checking investigations', async () => {
  check.mockReturnValue({ agenticRuns: [], hasAgenticRun: false, prefetch, isFetching: true });
  await renderActions();
  expect(
    (screen.getByRole('menuitem', { name: /Loading investigations/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it('links to the latest existing investigation and displays the AI warning', async () => {
  check.mockReturnValue({
    agenticRuns: [{ metadata: { name: 'latest-run', namespace: 'openshift-lightspeed' } }],
    hasAgenticRun: true,
    prefetch,
    isFetching: false,
  });
  await renderActions();
  expect(screen.getByText('Always review AI-generated content prior to use.')).toBeDefined();
  expect(itemUrl(/View AI Investigation/).pathname).toBe(
    '/lightspeed/runs/openshift-lightspeed/latest-run',
  );
});

it('shows an investigation returned by the SDK using the real agentic run hook', async () => {
  const { useAgenticRunCheck } = await vi.importActual<
    typeof import('@/shared/hooks/agentic-runs/useAgenticRunCheck')
  >('@/shared/hooks/agentic-runs/useAgenticRunCheck');
  check.mockImplementation(useAgenticRunCheck);

  const fingerprint = getAlertFingerprintPrefix(alert.labels);
  const run: K8sResourceCommon = {
    metadata: {
      name: 'sdk-investigation',
      namespace: alert.labels.namespace,
      labels: {
        [AGENTIC_RUN_LABEL_FINGERPRINT]: fingerprint,
        [AGENTIC_RUN_LABEL_SOURCE]: AGENTIC_RUN_SOURCE_ALERTMANAGER,
      },
    },
  };
  k8sListItems.mockImplementation(({ queryParams }) =>
    Promise.resolve(queryParams.ns === run.metadata.namespace ? [run] : []),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AlertActions alert={alert} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(k8sListItems).not.toHaveBeenCalled();
  const toggle = screen.getByRole('button', { name: /Actions for/ });
  await act(async () => {
    fireEvent.mouseEnter(toggle);
    fireEvent.click(toggle);
  });

  await screen.findByRole('menuitem', { name: /View AI Investigation/ });
  expect(screen.getByText('Always review AI-generated content prior to use.')).toBeDefined();
  for (const namespace of [AGENTIC_RUN_NAMESPACE, alert.labels.namespace]) {
    expect(k8sListItems).toHaveBeenCalledWith({
      model: AgenticRunModel,
      queryParams: {
        ns: namespace,
        labelSelector: {
          matchLabels: {
            [AGENTIC_RUN_LABEL_FINGERPRINT]: fingerprint,
            [AGENTIC_RUN_LABEL_SOURCE]: AGENTIC_RUN_SOURCE_ALERTMANAGER,
          },
        },
      },
    });
  }
  expect(itemUrl(/View AI Investigation/).pathname).toBe(
    `/lightspeed/runs/${run.metadata.namespace}/${run.metadata.name}`,
  );
});

it('uses the existing alert action extension for AI investigation', async () => {
  const investigate = vi.fn();
  const actions: Action[] = [
    { id: 'investigate', label: 'Investigate with AI', cta: investigate },
    { id: 'external', label: 'External investigation', cta: { href: '/investigation' } },
  ];
  actionService.mockReturnValue({ actions, loaded: true });
  await renderActions();
  expect(
    screen.getByRole('menuitem', { name: 'External investigation' }).getAttribute('href'),
  ).toBe('/investigation');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Investigate with AI' }));
  expect(investigate).toHaveBeenCalledOnce();
});

it('checks global Alertmanager create permission for silencing', async () => {
  await renderActions();
  expect(accessReview).toHaveBeenCalledWith({
    group: 'monitoring.coreos.com',
    resource: 'alertmanagers',
    subresource: 'api',
    verb: 'create',
    name: 'main',
    namespace: 'openshift-monitoring',
  });
});

it.each(['workloads', 'another-namespace'])(
  'checks silencing permission in the alert namespace %s for tenancy users',
  async (namespace) => {
    monitoring.mockReturnValue({
      useAlertsTenancy: true,
      accessCheckLoading: false,
    });
    await renderActions({ ...alert, labels: { ...alert.labels, namespace } });
    expect(accessReview).toHaveBeenCalledWith({
      group: 'monitoring.coreos.com',
      resource: 'prometheusrules',
      verb: 'create',
      namespace,
    });
  },
);

it('checks global silencing permission when the alert has no namespace', async () => {
  monitoring.mockReturnValue({
    useAlertsTenancy: true,
    accessCheckLoading: false,
  });
  await renderActions({ ...alert, labels: { alertname: alert.labels.alertname } });
  expect(accessReview).toHaveBeenCalledWith({
    group: 'monitoring.coreos.com',
    resource: 'alertmanagers',
    subresource: 'api',
    verb: 'create',
    name: 'main',
    namespace: 'openshift-monitoring',
  });
});

it('waits for the tenancy decision only before enabling silencing', async () => {
  monitoring.mockReturnValue({
    useAlertsTenancy: false,
    accessCheckLoading: true,
  });
  await renderActions();
  const silenceItem = screen.getByRole('menuitem', { name: /^Silence alert/ });
  expect(silenceItem.getAttribute('aria-disabled')).toBe('true');
  expect(fireEvent.click(silenceItem)).toBe(false);
  for (const name of ['View alert rule', 'View metrics']) {
    expect(screen.getByRole('menuitem', { name }).getAttribute('aria-disabled')).not.toBe('true');
  }
});

it('hides silencing and its separator for an already silenced alert without checking access', async () => {
  await renderActions({ ...alert, state: AlertStates.Silenced });
  expect(screen.queryByRole('menuitem', { name: /^Silence alert/ })).toBeNull();
  expect(screen.queryByRole('separator')).toBeNull();
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'View alert rule',
    'View metrics',
  ]);
  expect(accessReview).not.toHaveBeenCalled();
});

it('does not show extension actions until they are loaded', async () => {
  actionService.mockReturnValue({
    actions: [{ id: 'investigate', label: 'Investigate with AI', cta: vi.fn() }],
    loaded: false,
  });
  await renderActions();
  expect(screen.queryByRole('menuitem', { name: 'Investigate with AI' })).toBeNull();
});
