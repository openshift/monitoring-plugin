import React, { ReactNode } from 'react';
import { DashboardListHeader } from './dashboard-header';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { ProjectBar } from './project/ProjectBar';

interface DashboardListFrameProps {
  activeProject: string | null;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardName: string;
  children: ReactNode;
}

export const DashboardListFrame: React.FC<DashboardListFrameProps> = ({
  activeProject,
  activeProjectDashboardsMetadata,
  changeBoard,
  dashboardName,
  children,
}) => {
  return (
    <>
      <ProjectBar activeProject={activeProject} />
      <DashboardListHeader
        boardItems={activeProjectDashboardsMetadata}
        changeBoard={changeBoard}
        dashboardDisplayName={dashboardName}
        activeProject={activeProject}
      >
        {children}
      </DashboardListHeader>
    </>
  );
};
