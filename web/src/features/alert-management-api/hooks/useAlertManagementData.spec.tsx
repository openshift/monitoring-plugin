/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  processAlertManagementData,
  useAlertManagementData,
} from '@/features/alert-management-api/hooks/useAlertManagementData';
import {
  getMockAlertsResponse,
  getMockManagementRulesResponse,
  getMockSilencesResponse,
} from '@/features/alert-management-api/tests/fixtures/mock-responses';
import { makeSilence } from '@/features/alert-management-api/tests/utils/object-factories';
import {
  AlertingRule,
  GetAlertsResponse,
  GetRulesResponse,
  PrometheusAlert,
} from '@/shared/clients/alert-management-api/generated/api';
import { getAlertmanagerSilencesUrl } from '@/shared/utils/utils';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), consoleFetchJSON: vi.fn() }));
vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types')),
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
  consoleFetchJSON: mocks.consoleFetchJSON,
}));
vi.mock('@/shared/clients/alert-management-api/transport', () => ({
  alertManagementFetch: mocks.fetch,
}));
vi.mock('@/shared/hooks/useMonitoring', () => ({
  useMonitoring: () => ({ prometheus: 'cmo' }),
}));

type RuleResponse = AlertingRule & { alertingRuleEnabled?: boolean };
const makeRule = (overrides: Partial<RuleResponse> = {}): RuleResponse => ({
  name: 'Example',
  state: 'firing',
  type: 'alerting',
  query: 'vector(1)',
  duration: 0,
  keepFiringFor: 0,
  labels: {
    openshift_io_alert_rule_id: 'rid_example',
    openshift_io_alert_source: 'platform',
    severity: 'critical',
  },
  annotations: {},
  alerts: [],
  health: 'ok',
  evaluationTime: 0,
  lastEvaluation: '2026-01-01T00:00:00Z',
  ...overrides,
});
const makeAlert = (overrides: Partial<PrometheusAlert> = {}): PrometheusAlert => ({
  alertRuleId: 'rid_example',
  labels: {
    alertname: 'Example',
    namespace: 'production',
    pod: 'pod-a',
    prometheus: 'openshift-monitoring/k8s',
    severity: 'critical',
    openshift_io_alert_source: 'platform',
    openshift_io_alert_backend: 'alertmanager',
  },
  annotations: { summary: 'Example alert' },
  state: 'firing',
  activeAt: '2026-01-01T00:00:00Z',
  value: '1',
  alertComponent: 'Compute',
  ...overrides,
});
const rulesResponse = (...rules: RuleResponse[]): GetRulesResponse => ({
  data: {
    groups: [
      {
        name: 'example',
        file: 'example.rules',
        interval: 30,
        limit: 0,
        evaluationTime: 0,
        lastEvaluation: '2026-01-01T00:00:00Z',
        rules,
      },
    ],
  },
});
const alertsResponse = (...alerts: PrometheusAlert[]): GetAlertsResponse => ({ data: { alerts } });

let queryClient: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.fetch.mockImplementation((path: string) =>
    Promise.resolve(path === '/rules' ? rulesResponse(makeRule()) : alertsResponse(makeAlert())),
  );
  mocks.consoleFetchJSON.mockResolvedValue([]);
});
afterEach(() => queryClient.clear());

const mount = (refreshIntervalMs: number | false = false) =>
  renderHook(() => useAlertManagementData(refreshIntervalMs), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

it('fetches alerts, rules and cross-namespace silences with the same polling interval', async () => {
  const { result } = mount(30_000);
  await waitFor(() => expect(result.current.data?.alerts).toHaveLength(1));
  expect(result.current.data?.alerts[0]).toMatchObject({
    source: 'platform',
    component: 'Compute',
    rule: { id: 'rid_example' },
  });
  for (const path of ['/rules', '/alerts']) {
    expect(mocks.fetch).toHaveBeenCalledWith(path, {
      method: 'GET',
      signal: expect.any(AbortSignal),
    });
  }
  expect(mocks.consoleFetchJSON).toHaveBeenCalledWith(
    getAlertmanagerSilencesUrl({ prometheus: 'cmo', useTenancyPath: false }),
    'GET',
    { signal: expect.any(AbortSignal) },
  );
  expect(queryClient.getQueryCache().getAll()).toHaveLength(3);
  for (const query of queryClient.getQueryCache().getAll()) {
    expect(query.options).toMatchObject({ refetchInterval: 30_000 });
  }
});

it.each(['rules', 'alerts', 'silences'] as const)(
  'keeps data unavailable until the %s response arrives',
  async (pendingRequest) => {
    let resolveResponse!: (response: unknown) => void;
    const pendingResponse = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    mocks.fetch.mockImplementation((path: string) => {
      if (path === `/${pendingRequest}`) {
        return pendingResponse;
      }
      return Promise.resolve(
        path === '/rules' ? rulesResponse(makeRule()) : alertsResponse(makeAlert()),
      );
    });
    if (pendingRequest === 'silences') {
      mocks.consoleFetchJSON.mockReturnValue(pendingResponse);
    }

    const { result } = mount();
    await waitFor(() => {
      for (const request of ['rules', 'alerts', 'silences'] as const) {
        if (request !== pendingRequest) {
          expect(result.current[`${request}Query`].isSuccess).toBe(true);
        }
      }
    });
    expect(result.current[`${pendingRequest}Query`].isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    const responses = {
      rules: rulesResponse(makeRule()),
      alerts: alertsResponse(makeAlert()),
      silences: [],
    };
    resolveResponse(responses[pendingRequest]);
    await waitFor(() => expect(result.current.data?.alerts).toHaveLength(1));
  },
);

it('exposes alerts request errors rather than falling back to evaluation instances', async () => {
  const error = new Error('Alerts forbidden');
  mocks.fetch.mockImplementation((path: string) =>
    path === '/rules' ? Promise.resolve(rulesResponse(makeRule())) : Promise.reject(error),
  );
  const { result } = mount();
  await waitFor(() => expect(result.current.alertsQuery.isError).toBe(true));
  expect(result.current.alertsQuery.error).toBe(error);
  expect(result.current.data).toBeUndefined();
});

it.each([true, undefined, false])('respects alertingRuleEnabled=%s everywhere', (enabled) => {
  const alert = makeAlert();
  const rules = rulesResponse(makeRule({ alertingRuleEnabled: enabled, alerts: [alert] }));
  const data = processAlertManagementData(rules, alertsResponse(alert), [makeSilence()]);
  const expectedCount = enabled === false ? 0 : 1;
  expect(data?.rules).toHaveLength(1);
  expect(data?.rules[0].alertingRuleEnabled).toBe(enabled);
  expect(data?.alerts).toHaveLength(expectedCount);
  expect(data?.rules[0].alerts).toHaveLength(expectedCount);
  expect(data?.silences[0].firingAlerts).toHaveLength(expectedCount);
  if (enabled === false) {
    expect(data?.rules[0].state).toBe('firing');
    expect(data?.rules[0].silencedBy).toEqual([]);
  } else {
    expect(data?.alerts[0].state).toBe('silenced');
    expect(data?.alerts[0].rule).toBe(data?.rules[0]);
    expect(data?.silences[0].firingAlerts?.[0].rule).toBe(data?.rules[0]);
  }
});

it('only displays instances from /alerts, not stale evaluation instances from /rules', () => {
  const pending = makeAlert({ state: 'pending' });
  pending.labels.openshift_io_alert_backend = 'thanos';
  delete pending.labels.prometheus;
  const rule = makeRule({
    alerts: [makeAlert(), { ...makeAlert(), labels: { alertname: 'Example', pod: 'stale' } }],
  });
  const data = processAlertManagementData(rulesResponse(rule), alertsResponse(pending), [
    makeSilence(),
  ]);
  expect(data?.alerts).toHaveLength(1);
  expect(data?.rules[0].alerts).toHaveLength(1);
  expect(data?.alerts[0].state).toBe('pending');
  expect(data?.silences[0].firingAlerts).toEqual([]);
});

it('uses Alertmanager labels and status', () => {
  const silence = makeSilence({
    matchers: [{ name: 'prometheus', value: 'custom-stack', isEqual: true, isRegex: false }],
  });
  const alert = makeAlert({ state: 'silenced' });
  alert.labels.prometheus = 'custom-stack';
  const data = processAlertManagementData(rulesResponse(makeRule()), alertsResponse(alert), [
    silence,
  ]);
  expect(data?.alerts[0]).toMatchObject({
    state: 'silenced',
    labels: { prometheus: 'custom-stack' },
    silencedBy: [expect.objectContaining({ id: silence.id })],
  });
  expect(data?.silences[0].firingAlerts).toHaveLength(1);
});

it('prefers Alertmanager over its Thanos duplicate regardless of input order', () => {
  const am = makeAlert({ state: 'silenced' });
  const thanos = makeAlert();
  delete thanos.labels.prometheus;
  thanos.labels.openshift_io_alert_backend = 'thanos';
  for (const alerts of [
    [am, thanos],
    [thanos, am],
  ]) {
    const data = processAlertManagementData(rulesResponse(makeRule()), alertsResponse(...alerts), [
      makeSilence(),
    ]);
    expect(data?.alerts).toHaveLength(1);
    expect(data?.rules[0].alerts).toHaveLength(1);
    expect(data?.silences[0].firingAlerts).toHaveLength(1);
    expect(data?.alerts[0].labels.openshift_io_alert_backend).toBe('alertmanager');
    expect(data?.alerts[0].state).toBe('silenced');
  }
});

it.each([
  ['firing', false],
  ['firing', true],
  ['silenced', false],
  ['silenced', true],
] as const)(
  'prefers a %s Alertmanager entry over pending, with additional external labels=%s',
  (state, additionalExternalLabels) => {
    const am = makeAlert({ state });
    const pending = makeAlert({ state: 'pending' });
    pending.labels.openshift_io_alert_backend = 'thanos';
    if (additionalExternalLabels) {
      delete pending.labels.prometheus;
    }
    for (const alerts of [
      [am, pending],
      [pending, am],
    ]) {
      const data = processAlertManagementData(
        rulesResponse(makeRule()),
        alertsResponse(...alerts),
        [],
      );
      expect(data?.alerts).toHaveLength(1);
      expect(data?.rules[0].alerts).toHaveLength(1);
      expect(data?.alerts[0]).toMatchObject({
        state,
        labels: { openshift_io_alert_backend: 'alertmanager' },
      });
    }
  },
);

it('deduplicates repeated Alertmanager entries before matching their evaluated duplicate', () => {
  const am = makeAlert({ state: 'silenced' });
  const thanos = makeAlert();
  delete thanos.labels.prometheus;
  thanos.labels.openshift_io_alert_backend = 'thanos';
  const data = processAlertManagementData(
    rulesResponse(makeRule()),
    alertsResponse(am, structuredClone(am), thanos),
    [makeSilence()],
  );
  expect(data?.alerts).toHaveLength(1);
  expect(data?.silences[0].firingAlerts).toHaveLength(1);
});

it('keeps ambiguous cross-source matches instead of choosing an arbitrary external instance', () => {
  const first = makeAlert();
  const second = makeAlert({ labels: { ...first.labels, prometheus: 'another-stack' } });
  const thanos = makeAlert();
  delete thanos.labels.prometheus;
  thanos.labels.openshift_io_alert_backend = 'thanos';
  const data = processAlertManagementData(
    rulesResponse(makeRule()),
    alertsResponse(first, second, thanos),
    [],
  );
  expect(data?.alerts).toHaveLength(3);
});

it('preserves Alertmanager notification status when no silences are returned', () => {
  const data = processAlertManagementData(
    rulesResponse(makeRule()),
    alertsResponse(makeAlert({ state: 'silenced' })),
    [],
  );
  expect(data?.alerts[0].state).toBe('silenced');
  expect(data?.silences).toEqual([]);
});

it('ignores recording rules while keeping empty alerting rules', () => {
  const response = rulesResponse(makeRule());
  response.data.groups[0].rules.push({ ...makeRule(), type: 'recording', name: 'recorded:metric' });
  const data = processAlertManagementData(response, alertsResponse(), [makeSilence()]);
  expect(data?.rules).toHaveLength(1);
  expect(data?.rules[0]).toMatchObject({ name: 'Example', alerts: [], state: 'firing' });
  expect(data?.silences[0].firingAlerts).toEqual([]);
});

it('keeps different instances and uses rule ID/source rather than alertname alone', () => {
  const platform = makeRule({ alertingRuleEnabled: false });
  const user = makeRule({ labels: { ...platform.labels, openshift_io_alert_source: 'user' } });
  const otherRule = makeRule({
    labels: { ...platform.labels, openshift_io_alert_rule_id: 'rid_other' },
  });
  const a = makeAlert();
  const b = makeAlert({ labels: { ...a.labels, pod: 'pod-b' } });
  const userAlert = makeAlert({ labels: { ...a.labels, openshift_io_alert_source: 'user' } });
  const otherAlert = makeAlert({ alertRuleId: 'rid_other' });
  const data = processAlertManagementData(
    rulesResponse(platform, user, otherRule),
    alertsResponse(a, b, userAlert, otherAlert),
    [makeSilence()],
  );
  expect(data?.rules.map((rule) => rule.alerts.length)).toEqual([0, 1, 1]);
  expect(data?.alerts).toHaveLength(2);
  expect(data?.silences[0].firingAlerts).toHaveLength(2);
});

it('does not collapse different pods, namespaces, clusters or custom identity labels', () => {
  const first = makeAlert();
  const alerts = [
    first,
    ...['pod', 'namespace', 'cluster', 'openshift_io_custom_identity'].map((name) =>
      makeAlert({ labels: { ...first.labels, [name]: 'different' } }),
    ),
  ];
  const data = processAlertManagementData(rulesResponse(makeRule()), alertsResponse(...alerts), []);
  expect(data?.alerts).toHaveLength(5);
});

it('can match by the rule ID label or an unambiguous name and labels on older responses', () => {
  const alert = makeAlert({ alertRuleId: undefined });
  alert.labels.openshift_io_alert_rule_id = 'rid_example';
  expect(
    processAlertManagementData(rulesResponse(makeRule()), alertsResponse(alert), [])?.alerts,
  ).toHaveLength(1);
  delete alert.labels.openshift_io_alert_rule_id;
  expect(
    processAlertManagementData(rulesResponse(makeRule()), alertsResponse(alert), [])?.alerts,
  ).toHaveLength(1);
});

it('does not attach unknown IDs or ambiguous matches to an arbitrary rule', () => {
  const rules = rulesResponse(
    makeRule(),
    makeRule({
      labels: { openshift_io_alert_rule_id: 'rid_other', openshift_io_alert_source: 'platform' },
    }),
  );
  expect(
    processAlertManagementData(rules, alertsResponse(makeAlert({ alertRuleId: 'unknown' })), [])
      ?.alerts,
  ).toEqual([]);
  expect(
    processAlertManagementData(rules, alertsResponse(makeAlert({ alertRuleId: undefined })), [])
      ?.alerts,
  ).toEqual([]);
});

it('merges the development fixtures without mutating any response', () => {
  const rules = getMockManagementRulesResponse();
  const alerts = getMockAlertsResponse();
  const silences = getMockSilencesResponse();
  const originals = structuredClone([rules, alerts, silences]);
  const data = processAlertManagementData(rules, alerts, silences);
  expect(data?.alerts).toHaveLength(alerts.data.alerts.length);
  expect(data?.silences[0].firingAlerts?.length).toBeGreaterThan(0);
  expect([rules, alerts, silences]).toEqual(originals);
});
