import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  UseMutationResult,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, type FC } from 'react';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { LoadingInline } from '../../console/console-shared/src/components/loading/LoadingInline';
import { PersesWrapper } from './PersesWrapper';
import { DashboardSkeleton } from './dashboard-skeleton';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { ProjectEmptyState } from './emptystates/ProjectEmptyState';
import { useDashboardsData } from './hooks/useDashboardsData';
import { ProjectBar } from './project/ProjectBar';
import {
  DashboardResource,
  EphemeralDashboardResource,
  getResourceExtendedDisplayName,
} from '@perses-dev/core';
import { getCSRFToken } from '@openshift-console/dynamic-plugin-sdk/lib/utils/fetch/console-fetch-utils';
import { useSnackbar } from '@perses-dev/components';
import buildURL from './perses/url-builder';
import { OCPDashboardApp } from './dashoard-app';
import { t } from 'i18next';

const resource = 'dashboards';
const HTTPMethodPUT = 'PUT';
const HTTPHeader: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
});

async function updateDashboard(entity: DashboardResource): Promise<DashboardResource> {
  const url = buildURL({
    resource: resource,
    project: entity.metadata.project,
    name: entity.metadata.name,
  });

  const response = await fetch(url, {
    method: HTTPMethodPUT,
    headers: {
      ...HTTPHeader,
      'X-CSRFToken': getCSRFToken(),
    },
    body: JSON.stringify(entity),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

function useUpdateDashboardMutation(): UseMutationResult<
  DashboardResource,
  Error,
  DashboardResource
> {
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
}

const MonitoringDashboardsPage_: FC = () => {
  const {
    changeBoard,
    activeProjectDashboardsMetadata,
    combinedInitialLoad,
    activeProject,
    setActiveProject,
    dashboardName,
  } = useDashboardsData();

  const updateDashboardMutation = useUpdateDashboardMutation();
  const { successSnackbar, exceptionSnackbar } = useSnackbar();

  const handleDashboardSave = useCallback(
    (data: DashboardResource | EphemeralDashboardResource) => {
      if (data.kind !== 'Dashboard') {
        throw new Error('Invalid kind');
      }
      return updateDashboardMutation.mutateAsync(data, {
        onSuccess: (updatedDashboard: DashboardResource) => {
          successSnackbar(
            `Dashboard ${getResourceExtendedDisplayName(
              updatedDashboard,
            )} has been successfully updated`,
          );
          return updatedDashboard;
        },
        onError: (err) => {
          exceptionSnackbar(err);
          throw err;
        },
      });
    },
    [exceptionSnackbar, successSnackbar, updateDashboardMutation],
  );

  if (combinedInitialLoad) {
    return <LoadingInline />;
  }

  if (!activeProject) {
    // If we have loaded all of the requests fully and there are no projects, then
    return <ProjectEmptyState />; // empty state
  }

  return (
    <>
      <ProjectBar activeProject={activeProject} setActiveProject={setActiveProject} />
      <PersesWrapper project={activeProject}>
        {activeProjectDashboardsMetadata.length === 0 ? (
          <DashboardEmptyState />
        ) : (
          <DashboardSkeleton
            boardItems={activeProjectDashboardsMetadata}
            changeBoard={changeBoard}
            dashboardName={dashboardName}
            activeProject={activeProject}
          >
            <Overview>
              <OCPDashboardApp
                dashboardResource={activeProjectDashboardsMetadata[0].persesDashboard}
                isReadonly={false}
                isVariableEnabled={true}
                isDatasourceEnabled={true}
                onSave={handleDashboardSave}
                emptyDashboardProps={{
                  title: t('Empty Dashboard'),
                  description: t('To get started add something to your dashboard'),
                }}
              />
            </Overview>
          </DashboardSkeleton>
        )}
      </PersesWrapper>
    </>
  );
};

const MonitoringDashboardsPageWrapper: FC = () => {
  return (
    <QueryParamProvider adapter={ReactRouter5Adapter}>
      <QueryClientProvider client={queryClient}>
        <MonitoringDashboardsPage_ />
      </QueryClientProvider>
    </QueryParamProvider>
  );
};

export default MonitoringDashboardsPageWrapper;
