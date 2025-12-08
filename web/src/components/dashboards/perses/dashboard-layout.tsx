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

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeProject,
  setActiveProject,
  activeProjectDashboardsMetadata,
  changeBoard,
  dashboardName,
  children,
}) => {
  return (
    <>
      <ProjectBar activeProject={activeProject} setActiveProject={setActiveProject} />
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
    </>
  );
};
