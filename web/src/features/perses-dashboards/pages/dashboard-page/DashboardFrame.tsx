import { NamespaceBar } from '@openshift-console/dynamic-plugin-sdk';
import type { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { DashboardHeader } from '@/features/perses-dashboards/components/DashboardHeader';
import { DashboardEmptyState } from '@/features/perses-dashboards/components/emptystates/DashboardEmptyState';
import { PersesWrapper } from '@/features/perses-dashboards/components/PersesWrapper';
import { ToastProvider } from '@/features/perses-dashboards/components/ToastProvider';
import { PagePadding } from '@/features/perses-dashboards/pages/dashboard-page/DashboardPagePadding';
import type { DashboardMetadata } from '@/features/perses-dashboards/types/types';
import { getDashboardsListUrl, usePerspective } from '@/shared/hooks/usePerspective';

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
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  return (
    <>
      <NamespaceBar
        onNamespaceChange={() => {
          const url = `${getDashboardsListUrl(perspective)}`;
          navigate(url);
        }}
      />
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
