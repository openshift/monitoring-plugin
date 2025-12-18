import { DashboardResource } from '@perses-dev/core';
import buildURL from './perses/url-builder';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';

const resource = 'dashboards';

const updateDashboard = async (entity: DashboardResource): Promise<DashboardResource> => {
  const HTTPMethodPUT = 'PUT';
  const HTTPHeader: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const url = buildURL({
    resource: resource,
    project: entity.metadata.project,
    name: entity.metadata.name,
  });

  const response = await consoleFetch(url, {
    method: HTTPMethodPUT,
    headers: {
      ...HTTPHeader,
    },
    body: JSON.stringify(entity),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

export const useUpdateDashboardMutation = (): UseMutationResult<
  DashboardResource,
  Error,
  DashboardResource
> => {
  const queryClient = useQueryClient();

  return useMutation<DashboardResource, Error, DashboardResource>({
    mutationKey: [resource],
    mutationFn: (dashboard) => {
      return updateDashboard(dashboard);
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: [resource] });
    },
  });
};
