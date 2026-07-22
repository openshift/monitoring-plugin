import { FC, ReactNode } from 'react';

import { DashboardListHeader } from '@/features/perses-dashboards/components/DashboardHeader';
import { ProjectBar } from '@/features/perses-dashboards/components/project/ProjectBar';

interface DashboardListFrameProps {
  activeProject: string | null;
  children: ReactNode;
}

export const DashboardListFrame: FC<DashboardListFrameProps> = ({ activeProject, children }) => {
  return (
    <>
      <ProjectBar activeProject={activeProject} />
      <DashboardListHeader>{children}</DashboardListHeader>
    </>
  );
};
