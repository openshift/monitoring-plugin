import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

import { SchemaConfig } from '@/features/logging/logs-types';

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({ consoleFetchJSON: vi.fn() }));

describe('merged logging config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('reads only nested logging values, preserving explicit false and zero', async () => {
    vi.mocked(consoleFetchJSON).mockResolvedValue({
      timeout: 120,
      logging: {
        timeout: 0,
        logsLimit: 0,
        schema: SchemaConfig.select,
        showTimezoneSelector: false,
      },
    });
    const { getConfig } = await import('@/features/logging/backend-client');
    expect(await getConfig()).toEqual({
      isStreamingEnabledInDefaultPage: false,
      logsLimit: 0,
      timeout: 0,
      schema: SchemaConfig.select,
      showTimezoneSelector: false,
    });
    expect(consoleFetchJSON).toHaveBeenCalledWith(
      '/api/plugins/monitoring-console-plugin/config',
      'GET',
      { signal: expect.any(AbortSignal) },
      30000,
    );
  });

  it('uses source defaults when the logging section is absent', async () => {
    vi.mocked(consoleFetchJSON).mockResolvedValue({ timeout: 120 });
    const { getConfig, defaultConfig } = await import('@/features/logging/backend-client');
    expect(await getConfig()).toEqual(defaultConfig);
  });
});
