import { DashboardResource } from '@perses-dev/core';
import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { PERSES_PROXY_BASE_PATH } from './perses-client';

const MIGRATE_ENDPOINT = `${PERSES_PROXY_BASE_PATH}/api/migrate`;

export interface MigrateBodyRequest {
  input?: Record<string, string>;
  grafanaDashboard: Record<string, unknown>;
  useDefaultDatasource?: boolean;
}

const migrateDashboard = async (body: MigrateBodyRequest): Promise<DashboardResource> => {
  const requestBody = {
    input: body.input || {},
    grafanaDashboard: body.grafanaDashboard,
    useDefaultDatasource: !!body.useDefaultDatasource,
  };

  try {
    const result = await consoleFetchJSON.post(MIGRATE_ENDPOINT, requestBody);
    return result as DashboardResource;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to migrate dashboard: ${message}`);
  }
};

export function useMigrateDashboard(): UseMutationResult<
  DashboardResource,
  Error,
  MigrateBodyRequest
> {
  return useMutation<DashboardResource, Error, MigrateBodyRequest>({
    mutationKey: ['migrate'],
    mutationFn: migrateDashboard,
  });
}
