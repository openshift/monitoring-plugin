/** @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';

import {
  processAlertManagementData,
  useAlertManagementData,
} from '@/features/alert-management-api/hooks/useAlertManagementData';
import { toManagedRule } from '@/features/alert-management-api/pages/rules-page/utils/rules';
import {
  getMockAlertingRulesResponse,
  getMockRulesResponse,
  getMockSilencedAlertsResponse,
} from '@/features/alert-management-api/tests/fixtures/mock-responses';

const mocks = vi.hoisted(() => ({ useGetRules: vi.fn(), useGetAlerts: vi.fn() }));
vi.mock('@/shared/clients/alert-management-api/generated/api', () => mocks);

const rulesResponse = getMockRulesResponse();
const silencedResponse = getMockSilencedAlertsResponse();
const alertingRules = getMockAlertingRulesResponse(rulesResponse);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useGetRules.mockReturnValue({ data: rulesResponse, isError: false });
  mocks.useGetAlerts.mockReturnValue({ data: silencedResponse, isError: false });
});

it('uses generated rules and silenced-alert hooks with the same refresh interval', () => {
  const { result } = renderHook(() => useAlertManagementData(30_000));

  expect(mocks.useGetRules).toHaveBeenCalledWith({
    options: { query: expect.objectContaining({ refetchInterval: 30_000 }) },
  });

  expect(mocks.useGetAlerts).toHaveBeenCalledWith({
    params: { state: 'silenced' },
    options: { query: expect.objectContaining({ refetchInterval: 30_000 }) },
  });

  const silencedAlert = silencedResponse.data.alerts[0];
  expect(result.current.data?.alerts.find((alert) => alert.state === 'silenced')).toMatchObject({
    source: silencedAlert.labels.openshift_io_alert_source,
    component: silencedAlert.labels.component,
    state: 'silenced',
    rule: { id: silencedAlert.alertRuleId, state: 'firing' },
  });
});

it('disables polling by default', () => {
  renderHook(() => useAlertManagementData());
  expect(mocks.useGetRules).toHaveBeenCalledWith({
    options: { query: expect.objectContaining({ refetchInterval: false }) },
  });
  expect(mocks.useGetAlerts).toHaveBeenCalledWith({
    params: { state: 'silenced' },
    options: { query: expect.objectContaining({ refetchInterval: false }) },
  });
});

it('exposes a failed silenced-alert query without blocking rules or changing their states', () => {
  const error = new Error('Alertmanager unavailable');
  mocks.useGetAlerts.mockReturnValue({ data: undefined, isError: true, error });
  const { result } = renderHook(() => useAlertManagementData());

  expect(result.current.silencedAlertsQuery.error).toBe(error);
  expect(result.current.data?.rules).toHaveLength(alertingRules.length);
  expect(result.current.data?.rules.map((rule) => rule.state)).toEqual(
    alertingRules.map((rule) => rule.state),
  );
  expect(result.current.data?.alerts.map((alert) => alert.state)).toEqual(
    alertingRules.flatMap((rule) => rule.alerts.map((alert) => alert.state)),
  );
});

it('exposes rules-query failures and waits for rules even when silenced alerts are available', () => {
  const error = new Error('Access denied');
  mocks.useGetRules.mockReturnValue({ data: undefined, isError: true, error });
  const { result } = renderHook(() => useAlertManagementData());

  expect(result.current.rulesQuery.error).toBe(error);
  expect(result.current.data).toBeUndefined();
});

it('updates instance states when silenced-alert data arrives or is cleared on refresh', () => {
  mocks.useGetAlerts.mockReturnValue({ data: undefined });
  const { result, rerender } = renderHook(() => useAlertManagementData());
  expect(result.current.data?.alerts.filter((alert) => alert.state === 'silenced')).toHaveLength(0);

  mocks.useGetAlerts.mockReturnValue({ data: silencedResponse });
  rerender();
  expect(result.current.data?.alerts.filter((alert) => alert.state === 'silenced')).toHaveLength(
    silencedResponse.data.alerts.length,
  );
  expect(result.current.data?.rules.map((rule) => rule.state)).toEqual(
    alertingRules.map((rule) => rule.state),
  );

  mocks.useGetAlerts.mockReturnValue({ data: { data: { alerts: [] } } });
  rerender();
  expect(result.current.data?.alerts.map((alert) => alert.state)).toEqual(
    alertingRules.flatMap((rule) => rule.alerts.map((alert) => alert.state)),
  );
});

it('ignores recording rules from the generated API response', () => {
  const data = processAlertManagementData(rulesResponse, silencedResponse);

  const recordingRules = rulesResponse.data.groups
    .flatMap((group) => group.rules)
    .filter((rule) => rule.type === 'recording');

  expect(recordingRules.length).toBeGreaterThan(0);
  expect(data?.rules.map((rule) => rule.name)).toEqual(alertingRules.map((rule) => rule.name));
  expect(data?.alerts).toHaveLength(
    alertingRules.reduce((count, rule) => count + rule.alerts.length, 0),
  );
});

it('waits for the rules response before deriving page data', () => {
  expect(processAlertManagementData(undefined, silencedResponse)).toBeUndefined();
});

it('derives alerts from rules, applies instance states, and preserves its inputs', () => {
  const rules = getMockRulesResponse();
  const silenced = getMockSilencedAlertsResponse();
  const originalRules = structuredClone(rules);
  const originalSilenced = structuredClone(silenced);

  const data = processAlertManagementData(rules, silenced);
  const expectedRules = getMockAlertingRulesResponse(rules);
  const alertCount = expectedRules.reduce((count, rule) => count + rule.alerts.length, 0);

  expect(data?.alerts).toHaveLength(alertCount);
  expect(data?.alerts[0]).toMatchObject({
    component: expect.any(String),
    source: expect.any(String),
    rule: { id: expect.any(String) },
  });
  expect(data?.rules).toHaveLength(expectedRules.length);
  expect(new Set(data?.rules.map((rule) => toManagedRule(rule).enablement))).toEqual(
    new Set(['Enabled', 'Disabled']),
  );
  const disabledRules = data?.rules
    .map(toManagedRule)
    .filter((rule) => rule.enablement === 'Disabled');
  expect(disabledRules?.length).toBeGreaterThan(0);
  disabledRules?.forEach((rule) => {
    expect(rule.alerts).toEqual([]);
    expect(rule.firingAlertCount).toBe(0);
    expect(rule.pendingAlertCount).toBe(0);
    expect(rule.silencedAlertCount).toBe(0);
  });
  expect(new Set(data?.rules.map((rule) => rule.labels.openshift_io_alert_rule_component))).toEqual(
    new Set([
      'Compute',
      'Networking',
      'Storage',
      'Workload',
      'kube-apiserver',
      'etcd',
      'Scheduler',
      'Controller',
    ]),
  );
  expect(data?.alerts.some((alert) => alert.state === 'silenced')).toBe(true);
  expect(data?.alerts.some((alert) => alert.state === 'firing')).toBe(true);
  expect(data?.alerts.some((alert) => alert.state === 'pending')).toBe(true);
  const pendingRules = data?.rules.map(toManagedRule).filter((rule) => rule.pendingAlertCount > 0);
  expect(pendingRules?.length).toBeGreaterThan(0);
  pendingRules?.forEach((rule) => {
    expect(rule.enablement).toBe('Enabled');
  });
  expect(data?.alerts.every((alert) => data.rules.includes(alert.rule))).toBe(true);
  expect(data?.rules.map((rule) => rule.state)).toEqual(expectedRules.map((rule) => rule.state));
  expect(rules).toEqual(originalRules);
  expect(silenced).toEqual(originalSilenced);
});
