import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import {
  Breadcrumb,
  BreadcrumbItem,
  PageBreadcrumb,
  PageSection,
  Tab,
  Tabs,
  TabTitleText,
} from '@patternfly/react-core';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import {
  RefreshControl,
  RefreshControlProps,
} from '@/features/alert-management-api/components/RefreshControl';
import '@/features/alert-management-api/assets/alerts-list.css';
import { useFeatures } from '@/shared/hooks/useFeatures';

const topLevelTabs = {
  alerts: {
    href: '/monitoring/v2/alerts',
    // t('Alerts')
    name: 'Alerts',
  },
  incidents: {
    href: '/monitoring/v2/incidents',
    // t('Incidents')
    name: 'Incidents',
  },
  management: {
    href: '/monitoring/v2/management/alertrules',
    // t('Management')
    name: 'Management',
  },
};

const managementTabs = [
  {
    href: '/monitoring/v2/management/alertrules',
    // t('Alert rules')
    name: 'Alert rules',
  },
  {
    href: '/monitoring/v2/management/silences',
    // t('Silences')
    name: 'Silences',
  },
];

const getActivePrimaryTab = (pathname: string) => {
  switch (pathname) {
    case topLevelTabs.alerts.href:
      return topLevelTabs.alerts;
    case topLevelTabs.incidents.href:
      return topLevelTabs.incidents;
    case managementTabs[0].href:
      return managementTabs[0];
    case managementTabs[1].href:
      return managementTabs[1];
    default:
      return topLevelTabs.alerts;
  }
};

export function AlertManagementHeader({
  children,
  refresh,
}: {
  children: ReactNode;
  refresh?: RefreshControlProps;
}) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { features } = useFeatures();

  const isManagementTab = managementTabs.some((tab) => tab.href === pathname);

  const showIncidents =
    !!features['monitoring-console-plugin']?.['cluster-health-analyzer'] ||
    pathname === topLevelTabs.incidents.href;

  const activePrimaryTab = getActivePrimaryTab(pathname);

  const onSelect = (event: React.MouseEvent<HTMLElement>, path: string | number) => {
    event.preventDefault();
    navigate(String(path));
  };

  return (
    <>
      <DocumentTitle>{t('Alerts (management)')}</DocumentTitle>
      <PageBreadcrumb hasBodyWrapper={false}>
        <Breadcrumb aria-label={t('Breadcrumb')}>
          <BreadcrumbItem>{t('Observe')}</BreadcrumbItem>
          <BreadcrumbItem>
            <Link to={topLevelTabs.alerts.href}>{t('Alerting')}</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{t(activePrimaryTab?.name)}</BreadcrumbItem>
        </Breadcrumb>
      </PageBreadcrumb>
      <div className="alert-management-header__page-title">
        <ListPageHeader title={t('Alerting')}>
          {refresh && <RefreshControl pageKey={pathname} {...refresh} />}
        </ListPageHeader>
      </div>
      <PageSection hasBodyWrapper={false} style={{ paddingBlockStart: 0 }} type="subnav">
        <Tabs
          component="nav"
          aria-label={t('Alerting pages')}
          activeKey={activePrimaryTab?.href}
          onSelect={onSelect}
        >
          {Object.values(topLevelTabs).map(({ href, name }) => {
            if (!showIncidents && name === 'Incidents') {
              return;
            }
            return (
              <Tab
                key={href}
                eventKey={href}
                href={href}
                title={<TabTitleText>{t(name)}</TabTitleText>}
              />
            );
          })}
        </Tabs>
        {isManagementTab && (
          <Tabs
            component="nav"
            isSubtab
            aria-label={t('Management pages')}
            activeKey={pathname}
            onSelect={onSelect}
          >
            {managementTabs.map(({ href, name }) => (
              <Tab
                key={href}
                eventKey={href}
                href={href}
                title={<TabTitleText>{t(name)}</TabTitleText>}
              />
            ))}
          </Tabs>
        )}
      </PageSection>
      {children}
    </>
  );
}
