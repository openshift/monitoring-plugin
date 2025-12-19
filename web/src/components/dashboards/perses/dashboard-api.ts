import { DashboardResource } from '@perses-dev/core';
import buildURL from './perses/url-builder';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

const resource = 'dashboards';

const updateDashboard = async (entity: DashboardResource): Promise<DashboardResource> => {
  const url = buildURL({
    resource: resource,
    project: entity.metadata.project,
    name: entity.metadata.name,
  });

  return consoleFetchJSON.put(url, entity);
};

export const useUpdateDashboardMutation = (): UseMutationResult<
  DashboardResource,
  Error,
  DashboardResource
> => {
  const queryClient = useQueryClient();

  return useMutation<DashboardResource, Error, DashboardResource>({
    mutationKey: [resource],
    mutationFn: updateDashboard,
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: [resource] });
    },
  });
};
