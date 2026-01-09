import type { FC, PropsWithChildren } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { PageSection, Stack, StackItem } from '@patternfly/react-core';

import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';

import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom-v5-compat';
import { StringParam, useQueryParam } from 'use-query-params';
import { getDashboardsListUrl, usePerspective } from '../../hooks/usePerspective';
import { QueryParams } from '../../query-params';

import { chart_color_blue_100, chart_color_blue_300 } from '@patternfly/react-tokens';
import { listPersesDashboardsDataTestIDs } from '../../data-test';
import { usePatternFlyTheme } from '../../hooks/usePatternflyTheme';

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
        data-test={listPersesDashboardsDataTestIDs.PersesBreadcrumbDashboardItem}
      >
        {t('Dashboards')}
      </BreadcrumbItem>
      {dashboardName && (
        <BreadcrumbItem
          isActive
          data-test={listPersesDashboardsDataTestIDs.PersesBreadcrumbDashboardNameItem}
        >
          {dashboardName}
        </BreadcrumbItem>
      )}
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

export const DashboardHeader: FC<MonitoringDashboardsPageProps> = memo(({ children }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <>
      <DocumentTitle>{t('Metrics dashboards')}</DocumentTitle>
      <PageSection hasBodyWrapper={false}>
        <HeaderTop />
      </PageSection>
      {children}
    </>
  );
});
