import React, { ReactNode } from 'react';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { DashboardHeader } from './dashboard-skeleton';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { ProjectBar } from './project/ProjectBar';
import { PersesWrapper } from './PersesWrapper';
import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import { ToastProvider } from './ToastProvider';

interface DashboardFrameProps {
  activeProject: string | null;
  setActiveProject: (project: string | null) => void;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardName: string;
  children: ReactNode;
}

export const DashboardFrame: React.FC<DashboardFrameProps> = ({
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
      <ToastProvider>
        <PersesWrapper project={activeProject}>
          {activeProjectDashboardsMetadata?.length === 0 ? (
            <DashboardEmptyState />
          ) : (
            <DashboardHeader
              boardItems={activeProjectDashboardsMetadata}
              changeBoard={changeBoard}
              dashboardName={dashboardName}
              activeProject={activeProject}
            >
              <Overview>{children}</Overview>
            </DashboardHeader>
          )}
        </PersesWrapper>
      </ToastProvider>
    </>
  );
};
