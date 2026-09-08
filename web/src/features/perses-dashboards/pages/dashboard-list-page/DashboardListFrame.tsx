import { NamespaceBar } from '@openshift-console/dynamic-plugin-sdk';
import type { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { DashboardListHeader } from '@/features/perses-dashboards/components/DashboardHeader';
import { getDashboardsListUrl, usePerspective } from '@/shared/hooks/usePerspective';

interface DashboardListFrameProps {
  children: ReactNode;
}

export const DashboardListFrame: FC<DashboardListFrameProps> = ({ children }) => {
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
      <DashboardListHeader>{children}</DashboardListHeader>
    </>
  );
};
