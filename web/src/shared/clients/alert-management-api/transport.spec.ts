import { QueryClient } from '@tanstack/react-query';

import {
  bulkDeleteUserDefinedAlertRules,
  bulkUpdateAlertRules,
  createAlertRule,
  deleteAlertRule,
  getAlerts,
  useBulkUpdateAlertRulesMutationOptions as getBulkUpdateAlertRulesMutationOptions,
  useCreateAlertRuleMutationOptions as getCreateAlertRuleMutationOptions,
  useDeleteAlertRuleMutationOptions as getDeleteAlertRuleMutationOptions,
  getGetAlertsQueryKey,
  getGetAlertsQueryOptions,
  getGetAlertsUrl,
  getGetHealthQueryOptions,
  getGetRulesQueryKey,
  getGetRulesQueryOptions,
  getGetRulesUrl,
  getRules,
  useUpdateAlertRuleMutationOptions as getUpdateAlertRuleMutationOptions,
  updateAlertRule,
} from '@/shared/clients/alert-management-api/generated/api';

const mocks = vi.hoisted(() => ({ consoleFetch: vi.fn() }));
vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({ consoleFetch: mocks.consoleFetch }));
vi.mock('@/shared/utils/utils', () => ({
  getPrometheusBasePath: () => '/api/plugins/monitoring-plugin/api/v1/alerting',
}));

const basePath = '/api/plugins/monitoring-plugin/api/v1/alerting';
const respond = (body: unknown, status = 200) =>
  mocks.consoleFetch.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );

beforeEach(() => vi.resetAllMocks());

describe('generated Management API client with Console transport', () => {
  it('preserves response data and warnings without a status wrapper', async () => {
    const response = { data: { groups: [] }, warnings: ['User workload unavailable'] };
    respond(response);
    await expect(getRules()).resolves.toEqual(response);
    expect(mocks.consoleFetch).toHaveBeenCalledWith(
      `${basePath}/rules`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('generates query options for each GET and forwards cancellation', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queries = [
      {
        fetch: () => client.fetchQuery(getGetAlertsQueryOptions()),
        path: '/alerts',
        data: { data: { alerts: [] } },
      },
      {
        fetch: () => client.fetchQuery(getGetRulesQueryOptions()),
        path: '/rules',
        data: { data: { groups: [] } },
      },
      { fetch: () => client.fetchQuery(getGetHealthQueryOptions()), path: '/health', data: {} },
    ];
    try {
      for (const { fetch, path, data } of queries) {
        respond(data);
        await expect(fetch()).resolves.toEqual(data);
        expect(mocks.consoleFetch).toHaveBeenLastCalledWith(
          `${basePath}${path}`,
          expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
        );
      }
    } finally {
      client.clear();
    }
  });

  it('serializes alert state and arbitrary labels as flat, URL-encoded parameters', async () => {
    respond({ data: { alerts: [] } });
    await getAlerts({
      state: 'silenced',
      labels: { namespace: 'openshift-monitoring', team: 'SRE & monitoring+ops', labels: 'custom' },
    });
    const url = new URL(mocks.consoleFetch.mock.calls[0][0], 'https://console.example.com');
    expect(url.pathname).toBe(`${basePath}/alerts`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      state: 'silenced',
      namespace: 'openshift-monitoring',
      team: 'SRE & monitoring+ops',
      labels: 'custom',
    });
  });

  it('repeats match[] selectors without comma-joining or changing matcher syntax', async () => {
    respond({ data: { groups: [] } });
    const selectors = ['{severity="critical",namespace="ns1"}', 'alertname=~"Kube.*CPU|Memory"'];
    await getRules({
      state: 'inactive',
      labels: { severity: 'critical', team: 'a/b?c=d&e+f' },
      'match[]': selectors,
    });
    const url = new URL(mocks.consoleFetch.mock.calls[0][0], 'https://console.example.com');
    expect(url.pathname).toBe(`${basePath}/rules`);
    expect(url.searchParams.getAll('match[]')).toEqual(selectors);
    expect(url.searchParams.get('state')).toBe('inactive');
    expect(url.searchParams.get('severity')).toBe('critical');
    expect(url.searchParams.get('team')).toBe('a/b?c=d&e+f');
    expect([...url.searchParams.keys()]).toHaveLength(5);
  });

  it('omits absent/empty filter collections and preserves an explicit empty state', () => {
    expect(getGetAlertsUrl()).toBe('/alerts');
    expect(getGetAlertsUrl({ labels: {} })).toBe('/alerts');
    expect(getGetRulesUrl({ labels: {}, 'match[]': [] })).toBe('/rules');
    expect(getGetRulesUrl({ state: '' })).toBe('/rules?state=');
  });

  it('includes filters in generated cache keys', () => {
    const critical = { labels: { severity: 'critical' } };
    const warning = { labels: { severity: 'warning' } };
    expect(getGetRulesQueryKey(critical)).toContainEqual(critical);
    expect(getGetRulesQueryKey(critical)).not.toEqual(getGetRulesQueryKey(warning));
    expect(getGetAlertsQueryKey(critical)).not.toEqual(getGetAlertsQueryKey(warning));
    expect(getGetRulesQueryKey()).toEqual(['/rules']);
  });

  it('preserves explicit null, false, empty strings, and omitted patch fields', async () => {
    respond({ id: 'new-id', statusCode: 204 });
    const body = {
      labels: { severity: null, old: '', team: 'monitoring' },
      classification: {
        openshift_io_alert_rule_component: null,
        openshift_io_alert_rule_layer: 'compute',
      },
    };
    await expect(updateAlertRule('old-id', body)).resolves.toEqual({
      id: 'new-id',
      statusCode: 204,
    });
    expect(JSON.parse(mocks.consoleFetch.mock.calls[0][1].body)).toEqual(body);
    await updateAlertRule('old-id', { alertingRuleEnabled: false });
    expect(JSON.parse(mocks.consoleFetch.mock.calls[1][1].body)).toEqual({
      alertingRuleEnabled: false,
    });
  });

  it('encodes rule IDs as a single path segment', async () => {
    respond({ id: 'a/b?#', statusCode: 204 });
    await updateAlertRule('a/b?#', { labels: { team: 'monitoring' } });
    expect(mocks.consoleFetch.mock.calls[0][0]).toBe(`${basePath}/rules/a%2Fb%3F%23`);
  });

  it('serializes POST and body-bearing DELETE requests', async () => {
    respond({ id: 'created' }, 201);
    const body = { alertingRule: { alert: 'Example', expr: 'up == 0' } };
    await expect(createAlertRule(body)).resolves.toEqual({ id: 'created' });
    expect(mocks.consoleFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
    respond({ rules: [{ id: 'created', statusCode: 204 }] });
    await bulkDeleteUserDefinedAlertRules({ ruleIds: ['created'] });
    expect(mocks.consoleFetch.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'DELETE', body: '{"ruleIds":["created"]}' }),
    );
  });

  it('does not parse JSON for single-delete 204 responses', async () => {
    const response = new Response(null, { status: 204 });
    const json = vi.spyOn(response, 'json');
    mocks.consoleFetch.mockResolvedValue(response);
    await expect(deleteAlertRule('rule-id')).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('preserves partial failures in bulk HTTP 200 responses', async () => {
    const response = {
      rules: [
        { id: 'one', statusCode: 204 },
        { id: 'two', statusCode: 403, message: 'Forbidden' },
      ],
    };
    respond(response);
    await expect(
      bulkUpdateAlertRules({ ruleIds: ['one', 'two'], labels: { team: 'monitoring' } }),
    ).resolves.toEqual(response);
  });

  it('sets JSON headers without losing custom headers or request options', async () => {
    respond({ id: 'rule-id', statusCode: 204 });
    const controller = new AbortController();
    await updateAlertRule(
      'rule-id',
      { labels: {} },
      {
        headers: { 'X-Test': 'value' },
        credentials: 'same-origin',
        signal: controller.signal,
      },
    );
    const options = mocks.consoleFetch.mock.calls[0][1];
    expect(options.headers.get('Accept')).toBe('application/json');
    expect(options.headers.get('Content-Type')).toBe('application/json');
    expect(options.headers.get('X-Test')).toBe('value');
    expect(options.credentials).toBe('same-origin');
    expect(options.signal).toBe(controller.signal);
  });

  it.each([401, 403, 409, 500])(
    'preserves Console HTTP %s errors and parsed bodies',
    async (code) => {
      const error = Object.assign(new Error('Request failed'), {
        code,
        json: { error: 'Backend error details' },
        response: new Response(null, { status: code }),
      });
      mocks.consoleFetch.mockRejectedValue(error);
      await expect(getRules()).rejects.toBe(error);
      expect(mocks.consoleFetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    new TypeError('Network unavailable'),
    new DOMException('Aborted', 'AbortError'),
    Object.assign(new Error('Proxy unavailable'), { code: 502 }),
  ])('preserves network, cancellation, and non-JSON proxy errors', async (error) => {
    mocks.consoleFetch.mockRejectedValue(error);
    await expect(getRules()).rejects.toBe(error);
  });

  it('disables generated mutation retries even when the caller requests retries', () => {
    const options = { mutation: { retry: 3 } };
    expect(getCreateAlertRuleMutationOptions(options).retry).toBe(false);
    expect(getUpdateAlertRuleMutationOptions(options).retry).toBe(false);
    expect(getBulkUpdateAlertRulesMutationOptions(options).retry).toBe(false);
    expect(getDeleteAlertRuleMutationOptions(options).retry).toBe(false);
  });
});
