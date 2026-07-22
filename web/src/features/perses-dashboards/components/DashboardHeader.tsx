import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { Divider, Stack, StackItem } from '@patternfly/react-core';
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import {
  chart_color_blue_100,
  chart_color_blue_300,
  t_global_spacer_md,
  t_global_spacer_xl,
} from '@patternfly/react-tokens';
import { memo } from 'react';
import type { FC, PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { DashboardActionsMenu } from '@/features/perses-dashboards/components/DashboardActionsMenu';
import { PagePadding } from '@/features/perses-dashboards/pages/dashboard-page/DashboardPagePadding';
import { listPersesDashboardsDataTestIDs } from '@/shared/constants/data-test';
import { usePatternFlyTheme } from '@/shared/hooks/usePatternflyTheme';
import { getDashboardsListUrl, usePerspective } from '@/shared/hooks/usePerspective';

const DASHBOARD_VIEW_PATH = 'v2/dashboards/view';

const shouldHideFavoriteButton = (): boolean => {
  const currentUrl = window.location.href;
  return currentUrl.includes(DASHBOARD_VIEW_PATH);
};

const DashboardBreadCrumb: FC<{ dashboardDisplayName?: string }> = ({ dashboardDisplayName }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();
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
      {dashboardDisplayName && (
        <BreadcrumbItem
          isActive
          data-test={listPersesDashboardsDataTestIDs.PersesBreadcrumbDashboardNameItem}
        >
          {dashboardDisplayName}
        </BreadcrumbItem>
      )}
    </Breadcrumb>
  );
};

const DashboardPageHeader: FC<{ dashboardDisplayName?: string }> = ({ dashboardDisplayName }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const hideFavBtn = shouldHideFavoriteButton();

  return (
    <Stack>
      <StackItem>
        <DashboardBreadCrumb dashboardDisplayName={dashboardDisplayName} />
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

const DashboardListPageHeader: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const hideFavBtn = shouldHideFavoriteButton();

  return (
    <ListPageHeader
      title={t('Dashboards')}
      helpText={t('View and manage dashboards.')}
      hideFavoriteButton={hideFavBtn}
    >
      <DashboardActionsMenu />
    </ListPageHeader>
  );
};

type MonitoringDashboardsPageProps = PropsWithChildren<{
  dashboardDisplayName: string;
}>;

export const DashboardHeader = memo(
  ({ children, dashboardDisplayName }: MonitoringDashboardsPageProps) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    return (
      <>
        <DocumentTitle>{t('Metrics dashboards')}</DocumentTitle>
        <PagePadding top={t_global_spacer_md.value}>
          <DashboardPageHeader dashboardDisplayName={dashboardDisplayName} />
        </PagePadding>
        {children}
      </>
    );
  },
);

DashboardHeader.displayName = 'DashboardHeader';

export const DashboardListHeader = memo(({ children }: { children: ReactNode | undefined }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <>
      <DocumentTitle>{t('Metrics dashboards')}</DocumentTitle>
      <PagePadding right={t_global_spacer_xl.value}>
        <DashboardListPageHeader />
      </PagePadding>
      <Divider inset={{ default: 'insetMd' }} />
      {children}
    </>
  );
});

DashboardListHeader.displayName = 'DashboardListHeader';
