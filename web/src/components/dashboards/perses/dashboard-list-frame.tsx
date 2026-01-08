import React, { ReactNode } from 'react';
import { DashboardHeader } from './dashboard-skeleton';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { ProjectBar } from './project/ProjectBar';
import { Overview } from '@openshift-console/dynamic-plugin-sdk';

interface DashboardListFrameProps {
  activeProject: string | null;
  setActiveProject: (project: string | null) => void;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardName: string;
  children: ReactNode;
}

export const DashboardListFrame: React.FC<DashboardListFrameProps> = ({
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
      <DashboardHeader
        boardItems={activeProjectDashboardsMetadata}
        changeBoard={changeBoard}
        dashboardName={dashboardName}
        activeProject={activeProject}
      >
        <Overview>{children}</Overview>
      </DashboardHeader>
    </>
  );
};
