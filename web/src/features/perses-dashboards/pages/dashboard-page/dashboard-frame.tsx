import { FC, ReactNode } from 'react';

import type { CombinedDashboardMetadata } from '@shared/types/types';

import { PagePadding } from './dashboard-page-padding';
import { DashboardHeader } from '../../components/dashboard-header';
import { DashboardEmptyState } from '../../components/emptystates/DashboardEmptyState';
import { PersesWrapper } from '../../components/PersesWrapper';
import { ProjectBar } from '../../components/project/ProjectBar';
import { ToastProvider } from '../../components/ToastProvider';

interface DashboardFrameProps {
  activeProject: string | null;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardDisplayName: string;
  children: ReactNode;
}

export const DashboardFrame: FC<DashboardFrameProps> = ({
  activeProject,
  activeProjectDashboardsMetadata,
  changeBoard,
  dashboardDisplayName,
  children,
}) => {
  return (
    <>
      <ProjectBar activeProject={activeProject} />
      <ToastProvider>
        <PersesWrapper project={activeProject}>
          {activeProjectDashboardsMetadata?.length === 0 ? (
            <DashboardEmptyState />
          ) : (
            <>
              <DashboardHeader
                boardItems={activeProjectDashboardsMetadata}
                changeBoard={changeBoard}
                dashboardDisplayName={dashboardDisplayName}
                activeProject={activeProject}
              >
                <PagePadding top="0">{children}</PagePadding>
              </DashboardHeader>
            </>
          )}
        </PersesWrapper>
      </ToastProvider>
    </>
  );
};
