import { FC, ReactNode } from 'react';

import { DashboardListHeader } from '@/features/perses-dashboards/components/DashboardHeader';
import { ProjectBar } from '@/features/perses-dashboards/components/project/ProjectBar';
import type { CombinedDashboardMetadata } from '@/shared/types/types';

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
