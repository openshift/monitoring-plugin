import { cancellableFetch } from '@/features/logging/cancellable-fetch';
import { Config, SchemaConfig } from '@/features/logging/logs-types';

const BACKEND_ENDPOINT = '/api/plugins/monitoring-console-plugin';

let singletonRequest: Promise<Config> | null = null;
let throttleTimeout: NodeJS.Timeout | null = null;

export const defaultConfig: Config = {
  isStreamingEnabledInDefaultPage: false,
  logsLimit: 100,
  schema: SchemaConfig.viaq,
};

export const getConfig = async (): Promise<Config> => {
  if (singletonRequest) {
    if (throttleTimeout) {
      clearTimeout(throttleTimeout);
    }

    throttleTimeout = setTimeout(() => {
      singletonRequest = null;
    }, 1000);

    return singletonRequest;
  }

  try {
    const { request } = cancellableFetch<{ logging?: Partial<Config> }>(
      `${BACKEND_ENDPOINT}/config`,
    );

    singletonRequest = request().then(({ logging }) => ({ ...defaultConfig, ...logging }));
    const config = await singletonRequest;

    return config;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Error fetching logging plugin configuration', e);

    return Promise.resolve(defaultConfig);
  }
};
