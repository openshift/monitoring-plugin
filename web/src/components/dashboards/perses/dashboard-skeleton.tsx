import type { FC, PropsWithChildren } from 'react';
import { memo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

import { PageSection, Stack, StackItem } from '@patternfly/react-core';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';

import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { getDashboardsListUrl, usePerspective } from '../../hooks/usePerspective';
import { StringParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../query-params';
import { useNavigate } from 'react-router-dom-v5-compat';

import { chart_color_blue_100, chart_color_blue_300 } from '@patternfly/react-tokens';
import { usePatternFlyTheme } from '../../hooks/usePatternflyTheme';
import { ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';

const DashboardBreadCrumb: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();
  const [dashboardName] = useQueryParam(QueryParams.Dashboard, StringParam);
  const { theme } = usePatternFlyTheme();
  const navigate = useNavigate();

  const handleDashboardsClick = () => {
    navigate(getDashboardsListUrl(perspective));
  };

  const patternflyBlue100 = chart_color_blue_100.value;

  const patternflyBlue300 = chart_color_blue_300.value;

  const linkColor = theme == 'dark' ? patternflyBlue100 : patternflyBlue300;

  return (
    <Breadcrumb ouiaId="perses-dashboards-breadcrumb">
      <BreadcrumbItem
        onClick={handleDashboardsClick}
        style={{
          cursor: 'pointer',
          color: linkColor,
          textDecoration: 'underline',
        }}
      >
        {t('Dashboards')}
      </BreadcrumbItem>
      {dashboardName && <BreadcrumbItem isActive>{dashboardName}</BreadcrumbItem>}
    </Breadcrumb>
  );
};

const HeaderTop: FC = memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const currentUrl = window.location.href;
  const hideFavBtn = currentUrl.includes('v2/dashboards/view');

  return (
    <Stack hasGutter>
      <StackItem>
        <DashboardBreadCrumb />
      </StackItem>
      <StackItem>
        <ListPageHeader
          title={t('Dashboards')}
          helpText={t('View and manage dashboards.')}
          hideFavoriteButton={hideFavBtn}
        />
      </StackItem>
    </Stack>
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
