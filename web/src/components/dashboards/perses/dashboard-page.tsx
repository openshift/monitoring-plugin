import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import { LoadingInline } from '../../console/console-shared/src/components/loading/LoadingInline';
import DashboardSkeleton from '../shared/dashboard-skeleton';
import { PersesWrapper } from './PersesWrapper';

import PersesBoard from './perses-dashboards';
import { ProjectBar } from './project/ProjectBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardsData } from './hooks/useDashboardsData';
import { ProjectEmptyState } from './emptystates/ProjectEmptyState';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { PersesContext } from '../../router';

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
          >
            <Overview>
              <PersesBoard />
            </Overview>
          </DashboardSkeleton>
        )}
      </PersesWrapper>
    </>
  );
};

const MonitoringDashboardsPageWrapper: React.FC<RouteComponentProps> = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <PersesContext.Provider value={true}>
        <MonitoringDashboardsPage_ />
      </PersesContext.Provider>
    </QueryClientProvider>
  );
};

const MonitoringDashboardsPage = withRouter(MonitoringDashboardsPageWrapper);

export default MonitoringDashboardsPage;
