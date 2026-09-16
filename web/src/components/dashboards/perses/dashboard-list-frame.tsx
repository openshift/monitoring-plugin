import { NamespaceBar } from '@openshift-console/dynamic-plugin-sdk';
import React, { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';
import { DashboardListHeader } from './dashboard-header';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { getDashboardsListUrl, usePerspective } from '../../hooks/usePerspective';

interface DashboardListFrameProps {
  activeProject: string | null;
  activeProjectDashboardsMetadata: CombinedDashboardMetadata[];
  changeBoard: (boardName: string) => void;
  dashboardName: string;
  children: ReactNode;
}

export const DashboardListFrame: React.FC<DashboardListFrameProps> = ({
  activeProject,
  activeProjectDashboardsMetadata,
  changeBoard,
  dashboardName,
  children,
}) => {
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  return (
    <>
      <NamespaceBar onNamespaceChange={() => navigate(getDashboardsListUrl(perspective))} />
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
