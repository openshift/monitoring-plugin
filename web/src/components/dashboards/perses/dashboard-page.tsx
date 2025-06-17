import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { LoadingInline } from '../../console/console-shared/src/components/loading/LoadingInline';
import DashboardSkeleton from '../shared/dashboard-skeleton';
import { PersesContext } from '../shared/useIsPerses';
import { PersesWrapper } from './PersesWrapper';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { ProjectEmptyState } from './emptystates/ProjectEmptyState';
import { useDashboardsData } from './hooks/useDashboardsData';
import PersesBoard from './perses-dashboards';
import { ProjectBar } from './project/ProjectBar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
});

const MonitoringDashboardsPage_: React.FC = () => {
  const {
    changeBoard,
    activeProjectDashboardsMetadata,
    combinedInitialLoad,
    activeProject,
    setActiveProject,
    dashboardName,
  } = useDashboardsData();

  if (combinedInitialLoad) {
    return <LoadingInline />;
  }

  if (!activeProject) {
    // If we have loaded all of the requests fully and there are no projects, then
    return <ProjectEmptyState />; // empty state
  }

  return (
    <PersesWrapper project={activeProject}>
      <ProjectBar activeProject={activeProject} setActiveProject={setActiveProject} />
      {activeProjectDashboardsMetadata.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <DashboardSkeleton
          boardItems={activeProjectDashboardsMetadata}
          changeBoard={changeBoard}
          dashboardName={dashboardName}
        >
          <Overview>
            <PersesBoard />
          </Overview>
        </DashboardSkeleton>
      )}
    </PersesWrapper>
  );
};

const MonitoringDashboardsPageWrapper: React.FC = () => {
  return (
    <QueryParamProvider adapter={ReactRouter5Adapter}>
      <QueryClientProvider client={queryClient}>
        <PersesContext.Provider value={true}>
          <MonitoringDashboardsPage_ />
        </PersesContext.Provider>
      </QueryClientProvider>
    </QueryParamProvider>
  );
};

export default MonitoringDashboardsPageWrapper;
