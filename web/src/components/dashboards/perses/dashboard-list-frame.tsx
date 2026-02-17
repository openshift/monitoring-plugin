import * as React from 'react';
import { ProjectBar } from './project/ProjectBar';
import { Helmet } from 'react-helmet';
import { PagePadding } from './dashboard-page-padding';
import { Divider } from '@patternfly/react-core';
import { global_spacer_xl } from '@patternfly/react-tokens';
import { DashboardListPageHeader } from './dashboard-header';
import { useTranslation } from 'react-i18next';

interface DashboardListFrameProps {
  activeProject: string | null;
  setActiveProject: (project: string | null) => void;
  children: React.ReactNode;
}

export const DashboardListFrame: React.FC<DashboardListFrameProps> = ({
  activeProject,
  setActiveProject,
  children,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <>
      <ProjectBar activeProject={activeProject} setActiveProject={setActiveProject} />
      <Helmet>{t('Metrics dashboards')}</Helmet>
      <PagePadding right={global_spacer_xl.value}>
        <DashboardListPageHeader />
      </PagePadding>
      <Divider inset={{ default: 'insetMd' }} />
      {children}
    </>
  );
};
