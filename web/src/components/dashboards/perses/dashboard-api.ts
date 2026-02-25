import { DashboardResource, ProjectResource } from '@perses-dev/core';
import buildURL from './perses/url-builder';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { StatusError } from '@perses-dev/core';
import { PERSES_PROXY_BASE_PATH } from './perses-client';

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

export const createPersesProject = async (projectName: string): Promise<ProjectResource> => {
  const createProjectURL = '/api/v1/projects';
  const persesURL = `${PERSES_PROXY_BASE_PATH}${createProjectURL}`;

  const newProject: Partial<ProjectResource> = {
    kind: 'Project',
    metadata: {
      name: projectName,
      version: 0,
    },
    spec: {
      display: {
        name: projectName,
      },
    },
  };

  return consoleFetchJSON.post(persesURL, newProject);
};

export const useCreateProjectMutation = (): UseMutationResult<ProjectResource, Error, string> => {
  const queryClient = useQueryClient();

  return useMutation<ProjectResource, Error, string>({
    mutationKey: ['projects'],
    mutationFn: createPersesProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: [resource] });
    },
  });
};
