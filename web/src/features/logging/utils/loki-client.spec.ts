vi.mock('@openshift-console/dynamic-plugin-sdk/lib/utils/k8s/ws-factory', () => ({
  WSFactory: vi.fn(function () {}),
}));

import { SchemaConfig } from '@/features/logging/utils/logs-types';
import {
  getFetchConfig,
  isQueryRangeResponse,
  throwResponseError,
} from '@/features/logging/utils/loki-client';

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  consoleFetchJSON: vi.fn(),
  K8sResourceCommon: {},
}));

describe('Loki Client', () => {
  it('should generate a valid config', () => {
    [
      {
        config: {
          config: undefined,
          tenant: 'application',
          logsLimit: 100,
          schema: SchemaConfig.viaq,
        },
        expectedFetchConfig: {
          endpoint: '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application',
          requestInit: {},
          timeout: undefined,
        },
      },
      {
        config: {
          config: { useTenantInHeader: true, logsLimit: 100, schema: SchemaConfig.viaq },
          tenant: 'application',
        },
        expectedFetchConfig: {
          endpoint: '/api/proxy/plugin/monitoring-console-plugin/loki',
          requestInit: { headers: { 'X-Scope-OrgID': 'application' } },
          timeout: undefined,
        },
      },
      {
        config: {
          config: { useTenantInHeader: false, logsLimit: 100, schema: SchemaConfig.viaq },
          tenant: 'infrastructure',
        },
        expectedFetchConfig: {
          endpoint: '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/infrastructure',
          requestInit: {},
          timeout: undefined,
        },
      },
      {
        config: {
          config: {
            useTenantInHeader: false,
            logsLimit: 100,
            timeout: 2,
            schema: SchemaConfig.viaq,
          },
          tenant: 'infrastructure',
        },
        expectedFetchConfig: {
          endpoint: '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/infrastructure',
          requestInit: {},
          timeout: 2000,
        },
      },
    ].forEach(({ config, expectedFetchConfig }) => {
      expect(getFetchConfig(config)).toEqual(expectedFetchConfig);
    });
  });

  it('rejects Loki error responses', () => {
    expect(() =>
      throwResponseError({
        status: 'error',
        errorType: 'bad_data',
        error: 'parse error at line 1, col 1',
      }),
    ).toThrow('bad_data: parse error at line 1, col 1');
  });

  it('identifies malformed successful responses', () => {
    expect(isQueryRangeResponse({ status: 'success', data: {} })).toBe(false);
  });
});

it('uses the merged Loki alias for WebSocket tailing with namespace scoping', async () => {
  const { WSFactory } =
    await import('@openshift-console/dynamic-plugin-sdk/lib/utils/k8s/ws-factory');
  const { connectToTailSocket } = await import('@/features/logging/utils/loki-client');
  const { Schema } = await import('@/features/logging/utils/logs-types');
  connectToTailSocket({
    query: '{log_type="application"}',
    tenant: 'application',
    namespace: 'my-project',
    schema: Schema.viaq,
  });
  const [url, options] = vi.mocked(WSFactory).mock.calls[0];
  expect(url).toContain(
    '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/tail?',
  );
  expect(decodeURIComponent(url as string)).toContain('my-project');
  expect(options).toMatchObject({
    host: 'auto',
    path: url,
    subprotocols: ['json'],
    jsonParse: true,
  });
});
