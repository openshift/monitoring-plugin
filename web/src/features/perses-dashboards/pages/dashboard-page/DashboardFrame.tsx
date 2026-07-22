import { FC, ReactNode } from 'react';

import { DashboardHeader } from '@/features/perses-dashboards/components/DashboardHeader';
import { DashboardEmptyState } from '@/features/perses-dashboards/components/emptystates/DashboardEmptyState';
import { PersesWrapper } from '@/features/perses-dashboards/components/PersesWrapper';
import { ProjectBar } from '@/features/perses-dashboards/components/project/ProjectBar';
import { ToastProvider } from '@/features/perses-dashboards/components/ToastProvider';
import { PagePadding } from '@/features/perses-dashboards/pages/dashboard-page/DashboardPagePadding';
import type { DashboardMetadata } from '@/features/perses-dashboards/types/types';

interface DashboardFrameProps {
  activeProject: string | null;
  activeProjectDashboardsMetadata: DashboardMetadata[];
  dashboardDisplayName: string;
  children: ReactNode;
}

export const DashboardFrame: FC<DashboardFrameProps> = ({
  activeProject,
  activeProjectDashboardsMetadata,
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
              <DashboardHeader dashboardDisplayName={dashboardDisplayName}>
                <PagePadding top="0">{children}</PagePadding>
              </DashboardHeader>
            </>
          )}
        </PersesWrapper>
      </ToastProvider>
    </>
  );
};
