import { DashboardResource } from '@perses-dev/core';
import buildURL from './perses/url-builder';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { StatusError } from '@perses-dev/core';

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

const createDashboard = async (entity: DashboardResource): Promise<DashboardResource> => {
  const url = buildURL({
    resource: resource,
    project: entity.metadata.project,
  });

  return consoleFetchJSON.post(url, entity);
};

export const useCreateDashboardMutation = (
  onSuccess?: (data: DashboardResource, variables: DashboardResource) => Promise<unknown> | unknown,
): UseMutationResult<DashboardResource, Error, DashboardResource> => {
  const queryClient = useQueryClient();

  return useMutation<DashboardResource, Error, DashboardResource>({
    mutationKey: [resource],
    mutationFn: (dashboard) => createDashboard(dashboard),
    onSuccess: onSuccess,
    onSettled: () => {
      return queryClient.invalidateQueries({ queryKey: [resource] });
    },
  });
};

const deleteDashboard = async (entity: DashboardResource): Promise<void> => {
  const url = buildURL({
    resource: resource,
    project: entity.metadata.project,
    name: entity.metadata.name,
  });

  await consoleFetchJSON.delete(url);
};

export function useDeleteDashboardMutation(): UseMutationResult<
  DashboardResource,
  Error,
  DashboardResource
> {
  const queryClient = useQueryClient();
  return useMutation<DashboardResource, Error, DashboardResource>({
    mutationKey: [resource],
    mutationFn: (entity: DashboardResource) => {
      return deleteDashboard(entity).then(() => {
        return entity;
      });
    },
    onSuccess: (dashboard) => {
      queryClient.removeQueries({
        queryKey: [resource, dashboard.metadata.project, dashboard.metadata.name],
      });
      return queryClient.invalidateQueries({ queryKey: [resource] });
    },
  });
}

export const getDashboards = async (
  project?: string,
  metadataOnly: boolean = false,
): Promise<DashboardResource[]> => {
  const queryParams = new URLSearchParams();
  if (metadataOnly) {
    queryParams.set('metadata_only', 'true');
  }
  const url = buildURL({ resource: resource, project: project, queryParams: queryParams });

  return consoleFetchJSON(url);
};

type DashboardListOptions = Omit<
  UseQueryOptions<DashboardResource[], StatusError>,
  'queryKey' | 'queryFn'
> & {
  project?: string;
  metadataOnly?: boolean;
};

export function useDashboardList(
  options: DashboardListOptions,
): UseQueryResult<DashboardResource[], StatusError> {
  return useQuery<DashboardResource[], StatusError>({
    queryKey: [resource, options.project, options.metadataOnly],
    queryFn: () => {
      return getDashboards(options.project, options.metadataOnly);
    },
    ...options,
  });
}
