import { NamespaceBar } from '@openshift-console/dynamic-plugin-sdk';
import { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';
import { DashboardHeader } from './dashboard-header';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { PersesWrapper } from './PersesWrapper';
import { ToastProvider } from './ToastProvider';
import { PagePadding } from './dashboard-page-padding';
import { getDashboardsListUrl, usePerspective } from '../../hooks/usePerspective';

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
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  return (
    <>
      <NamespaceBar onNamespaceChange={() => navigate(getDashboardsListUrl(perspective))} />
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
