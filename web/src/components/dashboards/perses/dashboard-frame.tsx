import React, { ReactNode } from 'react';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { DashboardHeader } from './dashboard-header';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { ProjectBar } from './project/ProjectBar';
import { PersesWrapper } from './PersesWrapper';
import { ToastProvider } from './ToastProvider';
import { PagePadding } from './dashboard-page-padding';

interface DashboardFrameProps {
  activeProject: string | null;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardDisplayName: string;
  children: ReactNode;
}

export const DashboardFrame: React.FC<DashboardFrameProps> = ({
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
