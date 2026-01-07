import React, { ReactNode } from 'react';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { DashboardSkeleton } from './dashboard-skeleton';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { ProjectBar } from './project/ProjectBar';
import { PersesWrapper } from './PersesWrapper';
import { Overview } from '@openshift-console/dynamic-plugin-sdk';

export interface DashboardLayoutProps {
  activeProject: string | null;
  setActiveProject: (project: string | null) => void;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardName: string;
  children: ReactNode;
}

const DashboardPageFrame = ({
  activeProject,
  activeProjectDashboardsMetadata,
  changeBoard,
  dashboardName,
  children,
}) => {
  return (
    <PersesWrapper project={activeProject}>
      {activeProjectDashboardsMetadata?.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <DashboardSkeleton
          boardItems={activeProjectDashboardsMetadata}
          changeBoard={changeBoard}
          dashboardName={dashboardName}
          activeProject={activeProject}
        >
          <Overview>{children}</Overview>
        </DashboardSkeleton>
      )}
    </PersesWrapper>
  );
};

const DashboardListPageFrame = ({
  activeProjectDashboardsMetadata,
  changeBoard,
  dashboardName,
  activeProject,
  children,
}) => {
  return (
    <DashboardSkeleton
      boardItems={activeProjectDashboardsMetadata}
      changeBoard={changeBoard}
      dashboardName={dashboardName}
      activeProject={activeProject}
    >
      <Overview>{children}</Overview>
    </DashboardSkeleton>
  );
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeProject,
  setActiveProject,
  activeProjectDashboardsMetadata,
  changeBoard,
  dashboardName,
  children,
}) => {
  const isDashboardPage = activeProject && dashboardName;

  return (
    <>
      <ProjectBar activeProject={activeProject} setActiveProject={setActiveProject} />
      {isDashboardPage ? (
        <DashboardPageFrame
          activeProject={activeProject}
          activeProjectDashboardsMetadata={activeProjectDashboardsMetadata}
          changeBoard={changeBoard}
          dashboardName={dashboardName}
        >
          {children}
        </DashboardPageFrame>
      ) : (
        <DashboardListPageFrame
          activeProjectDashboardsMetadata={activeProjectDashboardsMetadata}
          changeBoard={changeBoard}
          dashboardName={dashboardName}
          activeProject={activeProject}
        >
          {children}
        </DashboardListPageFrame>
      )}
    </>
  );
};
