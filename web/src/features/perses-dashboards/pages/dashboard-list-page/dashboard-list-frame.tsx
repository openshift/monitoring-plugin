import { FC, ReactNode } from 'react';

import type { CombinedDashboardMetadata } from '@shared/types/types';

import { DashboardListHeader } from '../../components/dashboard-header';
import { ProjectBar } from '../../components/project/ProjectBar';

interface DashboardListFrameProps {
  activeProject: string | null;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardName: string;
  children: ReactNode;
}

export const DashboardListFrame: FC<DashboardListFrameProps> = ({
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
