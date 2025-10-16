import type { FC, PropsWithChildren } from 'react';
import { memo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

import { PageSection, Split, SplitItem, Title } from '@patternfly/react-core';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';

const HeaderTop: FC = memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Split hasGutter isWrappable>
      <SplitItem isFilled>
        <Title headingLevel="h1">{t('Dashboards')}</Title>
        {t('View and manage dashboards.')}
      </SplitItem>
    </Split>
  );
});

type MonitoringDashboardsPageProps = PropsWithChildren<{
  boardItems: CombinedDashboardMetadata[];
  changeBoard: (dashboardName: string) => void;
  dashboardName: string;
  activeProject?: string;
}>;

export const DashboardSkeleton: FC<MonitoringDashboardsPageProps> = memo(({ children }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <>
      <Helmet>
        <title>{t('Metrics dashboards')}</title>
      </Helmet>
      <PageSection hasBodyWrapper={false}>
        <HeaderTop />
      </PageSection>
      {children}
    </>
  );
});
