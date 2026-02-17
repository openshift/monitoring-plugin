import type { FC, PropsWithChildren } from 'react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Divider,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Text,
  TextContent,
  TextVariants,
} from '@patternfly/react-core';

import { CombinedDashboardMetadata } from './hooks/useDashboardsData';

import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { useHistory } from 'react-router-dom';
import { getDashboardsListUrl, usePerspective } from '../../hooks/usePerspective';

import {
  chart_color_blue_100,
  chart_color_blue_300,
  global_spacer_md,
} from '@patternfly/react-tokens';
import { usePatternFlyTheme } from './hooks/usePatternflyTheme';
import { DashboardCreateDialog } from './dashboard-create-dialog';
import { PagePadding } from './dashboard-page-padding';
import { Helmet } from 'react-helmet';
import classNames from 'classnames';

const DashboardBreadCrumb: React.FunctionComponent<{ dashboardDisplayName?: string }> = ({
  dashboardDisplayName,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();
  const { theme } = usePatternFlyTheme();
  const history = useHistory();

  const handleDashboardsClick = () => {
    history.push(getDashboardsListUrl(perspective));
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
          paddingLeft: global_spacer_md.value,
        }}
      >
        {t('Dashboards')}
      </BreadcrumbItem>
      {dashboardDisplayName && <BreadcrumbItem isActive>{dashboardDisplayName}</BreadcrumbItem>}
    </Breadcrumb>
  );
};

const DashboardPageHeader: React.FunctionComponent<{ dashboardDisplayName?: string }> = ({
  dashboardDisplayName,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Stack>
      <StackItem>
        <DashboardBreadCrumb dashboardDisplayName={dashboardDisplayName} />
        <ListPageHeader title={t('Dashboards')} helpText={t('View and manage dashboards.')} />
      </StackItem>
      <StackItem>
        <Divider inset={{ default: 'insetMd' }} />
      </StackItem>
    </Stack>
  );
};

export const DashboardListPageHeader: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <ListPageHeader title={t('Dashboards')} helpText={t('View and manage dashboards.')}>
      <DashboardCreateDialog />
    </ListPageHeader>
  );
};

type MonitoringDashboardsPageProps = PropsWithChildren<{
  boardItems: CombinedDashboardMetadata[];
  changeBoard: (dashboardName: string) => void;
  dashboardDisplayName: string;
  activeProject?: string;
}>;

export const DashboardHeader: FC<MonitoringDashboardsPageProps> = React.memo(
  ({ children, dashboardDisplayName }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    return (
      <>
        <Helmet>{t('Metrics dashboards')}</Helmet>
        <PagePadding top={global_spacer_md.value}>
          <DashboardPageHeader dashboardDisplayName={dashboardDisplayName} />
        </PagePadding>
        {children}
      </>
    );
  },
);

type ListPageHeaderProps = PropsWithChildren<{
  helpText: string;
  title: string;
}>;

const ListPageHeader: FC<ListPageHeaderProps> = ({ helpText, title, children }) => {
  return (
    <>
      <div className="co-m-nav-title co-m-nav-title--row">
        <Text
          component={TextVariants.h1}
          className={classNames('co-m-pane__heading', {
            'co-m-pane__heading--with-help-text': helpText,
          })}
        >
          {title}
        </Text>
        {children}
      </div>
      {helpText && (
        <Text component={TextVariants.p} className="co-m-pane__help-text co-help-text">
          {helpText}
        </Text>
      )}
    </>
  );
};
