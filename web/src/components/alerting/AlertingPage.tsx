import { PageSection, Title } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  HorizontalNav,
  NamespaceBar,
  useActivePerspective,
} from '@openshift-console/dynamic-plugin-sdk';
import { MonitoringContext, MonitoringProvider } from '../../contexts/MonitoringContext';

const CmoAlertsPage = React.lazy(() =>
  import(/* webpackChunkName: "CmoAlertsPage" */ './AlertsPage').then((module) => ({
    default: module.MpCmoAlertsPage,
  })),
);
const CooAlertsPage = React.lazy(() =>
  import(/* webpackChunkName: "CooAlertsPage" */ './AlertsPage').then((module) => ({
    default: module.McpAcmAlertsPage,
  })),
);
const CmoSilencesPage = React.lazy(() =>
  import(/* webpackChunkName: "CmoSilencesPage" */ './SilencesPage').then((module) => ({
    default: module.MpCmoSilencesPage,
  })),
);
const CooSilencesPage = React.lazy(() =>
  import(/* webpackChunkName: "CooSilencesPage" */ './SilencesPage').then((module) => ({
    default: module.McpAcmSilencesPage,
  })),
);
const CmoAlertRulesPage = React.lazy(() =>
  import(/* webpackChunkName: "CmoAlertRulesPage" */ './AlertRulesPage').then((module) => ({
    default: module.MpCmoAlertRulesPage,
  })),
);
const CooAlertRulesPage = React.lazy(() =>
  import(/* webpackChunkName: "CooAlertRulesPage" */ './AlertRulesPage').then((module) => ({
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
      component: () => (plugin === 'monitoring-plugin' ? <CmoAlertsPage /> : <CooAlertsPage />),
      name: 'Alerts',
    },
    {
      href: 'silences',
      // t('Silences')
      nameKey: 'Silences',
      component: () => (plugin === 'monitoring-plugin' ? <CmoSilencesPage /> : <CooSilencesPage />),
      name: 'Silences',
    },
    {
      href: 'alertrules',
      // t('Alerting Rules') -- for console.tab extension
      // t('Alerting rules')
      nameKey: 'Alerting rules',
      component: () =>
        plugin === 'monitoring-plugin' ? <CmoAlertRulesPage /> : <CooAlertRulesPage />,
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
