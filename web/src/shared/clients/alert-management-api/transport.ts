import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import type { HttpError } from '@openshift-console/dynamic-plugin-sdk';

import { getPrometheusBasePath } from '@/shared/utils/utils';

// add typing passthrough to the json field in the console HttpError
export type ErrorType<T> = Omit<HttpError, 'json'> & {
  json?: T;
};

export const alertManagementFetch = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body != null) {
    headers.set('Content-Type', 'application/json');
  }

  const basePath = getPrometheusBasePath({ prometheus: 'alert-management-api' });
  const response = await consoleFetch(`${basePath}${path}`, { ...options, headers });
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
};
