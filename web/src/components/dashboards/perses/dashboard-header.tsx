import type { FC, PropsWithChildren } from 'react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Divider, Grid, GridItem, Stack, StackItem } from '@patternfly/react-core';

import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';

import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom-v5-compat';
import { StringParam, useQueryParam } from 'use-query-params';
import { getDashboardsListUrl, usePerspective } from '../../hooks/usePerspective';
import { QueryParams } from '../../query-params';

import {
  chart_color_blue_100,
  chart_color_blue_300,
  t_global_spacer_md,
} from '@patternfly/react-tokens';
import { listPersesDashboardsDataTestIDs } from '../../data-test';
import { usePatternFlyTheme } from '../../hooks/usePatternflyTheme';
import { DashboardCreateDialog } from './dashboard-create-dialog';
import { PagePadding } from './dashboard-page-padding';

const DASHBOARD_VIEW_PATH = 'v2/dashboards/view';

const shouldHideFavoriteButton = (): boolean => {
  const currentUrl = window.location.href;
  return currentUrl.includes(DASHBOARD_VIEW_PATH);
};

const DashboardBreadCrumb: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();
  const [dashboardName] = useQueryParam(QueryParams.Dashboard, StringParam);
  const { theme } = usePatternFlyTheme();
  const navigate = useNavigate();

  const handleDashboardsClick = () => {
    navigate(getDashboardsListUrl(perspective));
  };

  const lightThemeColor = chart_color_blue_100.value;

  const darkThemeColor = chart_color_blue_300.value;

  const linkColor = theme == 'dark' ? lightThemeColor : darkThemeColor;

  return (
    <Breadcrumb ouiaId="perses-dashboards-breadcrumb">
      <BreadcrumbItem
        onClick={handleDashboardsClick}
        style={{
          cursor: 'pointer',
          color: linkColor,
          textDecoration: 'underline',
          paddingLeft: t_global_spacer_md.value,
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

const DashboardPageHeader: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const hideFavBtn = shouldHideFavoriteButton();

  return (
    <Stack>
      <StackItem>
        <DashboardBreadCrumb />
        <ListPageHeader
          title={t('Dashboards')}
          helpText={t('View and manage dashboards.')}
          hideFavoriteButton={hideFavBtn}
        />
      </StackItem>
      <StackItem>
        <Divider inset={{ default: 'insetMd' }} />
      </StackItem>
    </Stack>
  );
};

const DashboardListPageHeader: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const hideFavBtn = shouldHideFavoriteButton();

  return (
    <Grid hasGutter>
      <GridItem span={9}>
        <ListPageHeader
          title={t('Dashboards')}
          helpText={t('View and manage dashboards.')}
          hideFavoriteButton={hideFavBtn}
        />
      </GridItem>
      <GridItem
        span={3}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <DashboardCreateDialog />
      </GridItem>
    </Grid>
  );
};

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
      <PagePadding top={t_global_spacer_md.value}>
        <DashboardPageHeader />
      </PagePadding>
      {children}
    </>
  );
});

export const DashboardListHeader: FC<MonitoringDashboardsPageProps> = memo(({ children }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <>
      <DocumentTitle>{t('Metrics dashboards')}</DocumentTitle>
      <PagePadding>
        <DashboardListPageHeader />
      </PagePadding>
      <Divider inset={{ default: 'insetMd' }} />
      {children}
    </>
  );
});
