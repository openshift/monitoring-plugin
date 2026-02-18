import * as React from 'react';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { DashboardHeader } from './dashboard-header';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { ProjectBar } from './project/ProjectBar';
import { PersesWrapper } from './PersesWrapper';
import { ToastProvider } from './ToastProvider';
import { PagePadding } from './dashboard-page-padding';

interface DashboardFrameProps {
  activeProject: string | null;
  setActiveProject: (project: string | null) => void;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardDisplayName: string;
  children: React.ReactNode;
}

export const DashboardFrame: React.FC<DashboardFrameProps> = ({
  activeProject,
  setActiveProject,
  activeProjectDashboardsMetadata,
  changeBoard,
  dashboardDisplayName,
  children,
}) => {
  return (
    <>
      <ProjectBar activeProject={activeProject} setActiveProject={setActiveProject} />
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
