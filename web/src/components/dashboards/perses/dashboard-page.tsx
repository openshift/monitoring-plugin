import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import type { FC } from 'react';
import { LoadingInline } from '../../console/console-shared/src/components/loading/LoadingInline';
import { PersesWrapper } from './PersesWrapper';
import { DashboardSkeleton } from './dashboard-skeleton';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { ProjectEmptyState } from './emptystates/ProjectEmptyState';
import { useDashboardsData } from './hooks/useDashboardsData';
import PersesBoard from './perses-dashboards';
import { ProjectBar } from './project/ProjectBar';
import { MonitoringProvider } from '../../../contexts/MonitoringContext';

const MonitoringDashboardsPage_: FC = () => {
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
            activeProject={activeProject}
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

const MonitoringDashboardsPageWrapper: FC = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'cmo' }}
    >
      <MonitoringDashboardsPage_ />
    </MonitoringProvider>
  );
};

export default MonitoringDashboardsPageWrapper;
