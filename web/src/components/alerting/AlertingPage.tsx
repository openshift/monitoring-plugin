import { PageSection, Title } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  HorizontalNav,
  NamespaceBar,
  useActivePerspective,
} from '@openshift-console/dynamic-plugin-sdk';
import { MonitoringContext, MonitoringProvider } from '../../contexts/MonitoringContext';

const MpCmoAlertsPage = React.lazy(() =>
  import(/* webpackChunkName: "AlertsPage" */ './AlertsPage').then((module) => ({
    default: module.MpCmoAlertsPage,
  })),
);
const McpAcmAlertsPage = React.lazy(() =>
  import(/* webpackChunkName: "AlertsPage" */ './AlertsPage').then((module) => ({
    default: module.McpAcmAlertsPage,
  })),
);
const MpCmoSilencesPage = React.lazy(() =>
  import(/* webpackChunkName: "SilencesPage" */ './SilencesPage').then((module) => ({
    default: module.MpCmoSilencesPage,
  })),
);
const McpAcmSilencesPage = React.lazy(() =>
  import(/* webpackChunkName: "SilencesPage" */ './SilencesPage').then((module) => ({
    default: module.McpAcmSilencesPage,
  })),
);
const MpCmoAlertRulesPage = React.lazy(() =>
  import(/* webpackChunkName: "AlertRulesPage" */ './AlertRulesPage').then((module) => ({
    default: module.MpCmoAlertRulesPage,
  })),
);
const McpAcmAlertRulesPage = React.lazy(() =>
  import(/* webpackChunkName: "AlertRulesPage" */ './AlertRulesPage').then((module) => ({
    default: module.McpAcmAlertRulesPage,
  })),
);

const AlertingPage: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [perspective] = useActivePerspective();

  const { plugin } = React.useContext(MonitoringContext);

  // contextId allow console.tab extensions to be injected
  // https://github.com/openshift/console/blob/main/frontend/packages/console-dynamic-plugin-sdk/docs/console-extensions.md#consoletab
  const contextId = `${perspective}-alerts-nav`;

  const pages = [
    {
      href: 'alerts',
      // t('Alerts')
      nameKey: 'Alerts',
      component: () =>
        plugin === 'monitoring-plugin' ? <MpCmoAlertsPage /> : <McpAcmAlertsPage />,
      name: 'Alerts',
    },
    {
      href: 'silences',
      // t('Silences')
      nameKey: 'Silences',
      component: () =>
        plugin === 'monitoring-plugin' ? <MpCmoSilencesPage /> : <McpAcmSilencesPage />,
      name: 'Silences',
    },
    {
      href: 'alertrules',
      // t('Alerting rules')
      nameKey: 'Alerting rules',
      component: () =>
        plugin === 'monitoring-plugin' ? <MpCmoAlertRulesPage /> : <McpAcmAlertRulesPage />,
      name: 'Alerting rules',
    },
  ];

  return (
    <>
      <NamespaceBar />
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">{t('Alerting')}</Title>
        <HorizontalNav contextId={contextId} pages={pages} />
      </PageSection>
    </>
  );
};

export const MpCmoAlertingPage: React.FC = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <AlertingPage />
    </MonitoringProvider>
  );
};

export const McpAcmAlertingPage: React.FC = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <AlertingPage />
    </MonitoringProvider>
  );
};
