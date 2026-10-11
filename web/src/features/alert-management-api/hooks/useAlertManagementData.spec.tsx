/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import {
  processAlertManagementData,
  useAlertManagementData,
} from '@/features/alert-management-api/hooks/useAlertManagementData';
import {
  getMockRulesResponse,
  getMockSilencesResponse,
} from '@/features/alert-management-api/tests/fixtures/mock-responses';

const mocks = vi.hoisted(() => ({
  consoleFetchJSON: vi.fn(),
  fetchAlerts: vi.fn(),
  getAlertmanagerSilencesUrl: vi.fn(() => '/prometheus/alertmanager/api/v2/silences'),
}));

vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types')),
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
  consoleFetchJSON: mocks.consoleFetchJSON,
}));

vi.mock('@/shared/hooks/useMonitoring', () => ({
  useMonitoring: () => ({ prometheus: 'cmo' }),
}));

vi.mock('@/shared/store/fetch-alerts', () => ({ fetchAlerts: mocks.fetchAlerts }));

vi.mock('@/shared/utils/utils', async () => ({
  ...(await vi.importActual('@/shared/utils/utils')),
  getAlertmanagerSilencesUrl: mocks.getAlertmanagerSilencesUrl,
}));

const rulesResponse = {
  data: {
    groups: [
      {
        name: 'example-group',
        rules: [
          {
            alerts: [
              {
                activeAt: '2026-01-01T00:00:00Z',
                annotations: {},
                labels: {
                  alertname: 'ExampleAlert',
                  component: 'Compute',
                  severity: 'critical',
                },
                state: 'firing',
                value: '1',
              },
            ],
            annotations: {},
            duration: 0,
            labels: {
              openshift_io_alert_rule_id: 'rid_example',
              openshift_io_alert_source: 'platform',
              prometheus: 'openshift-monitoring/k8s',
              severity: 'critical',
            },
            name: 'ExampleAlert',
            query: 'up == 0',
            state: 'firing',
            type: 'alerting',
          },
        ],
      },
    ],
  },
};

const QueryResult = () => {
  const { data } = useAlertManagementData();
  return (
    <output data-testid="alerts">
      {data?.alerts.map(({ source, component, rule }) => `${source}|${component}|${rule.id}`)}
    </output>
  );
};

it('fetches rules from the management API and silences from the selected Prometheus', async () => {
  mocks.fetchAlerts.mockResolvedValue(rulesResponse);
  mocks.consoleFetchJSON.mockResolvedValue([]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <QueryResult />
    </QueryClientProvider>,
  );

  await waitFor(() =>
    expect(
      screen.getByTestId('alerts').textContent,
      'the query should expose the transformed alert data',
    ).toBe('platform|Compute|rid_example'),
  );
  expect(mocks.fetchAlerts, 'alert rules should come from the management API').toHaveBeenCalledWith(
    '/api/v1/alerting/rules',
  );
  expect(
    mocks.getAlertmanagerSilencesUrl,
    'the silence URL should use the selected Prometheus without a tenancy path',
  ).toHaveBeenCalledWith({
    prometheus: 'cmo',
    useTenancyPath: false,
  });
  expect(
    mocks.consoleFetchJSON,
    'silences should be fetched from the Alertmanager API',
  ).toHaveBeenCalledWith('/prometheus/alertmanager/api/v2/silences', 'GET');
});

it('waits for the rules response before deriving page data', () => {
  expect(
    processAlertManagementData(undefined, []),
    'page data should not be derived before rules are available',
  ).toBeUndefined();
});

it('derives alerts from rules, applies silences, and preserves its inputs', () => {
  const rules = getMockRulesResponse();
  const silences = getMockSilencesResponse();
  const originalRules = structuredClone(rules);
  const originalSilences = structuredClone(silences);

  const data = processAlertManagementData(rules, silences);
  const alertCount = rules.data.groups
    .flatMap(({ rules: groupRules }) => groupRules)
    .flatMap(({ alerts: ruleAlerts }) => ruleAlerts ?? []).length;

  expect(data?.alerts, 'all alerts in the rules response should be included').toHaveLength(
    alertCount,
  );
  expect(
    data?.alerts[0],
    'derived alerts should include source, component, and rule identity',
  ).toMatchObject({
    component: expect.any(String),
    source: expect.any(String),
    rule: { id: expect.any(String) },
  });
  expect(data?.silences, 'silences should be included in the derived page data').toEqual([
    expect.objectContaining({ name: expect.any(String) }),
  ]);
  expect(rules, 'processing should not mutate the rules response').toEqual(originalRules);
  expect(silences, 'processing should not mutate the silences response').toEqual(originalSilences);
});
