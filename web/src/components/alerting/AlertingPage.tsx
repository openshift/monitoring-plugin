import type { FC } from 'react';
import { lazy, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HorizontalNav,
  ListPageHeader,
  NamespaceBar,
  useActivePerspective,
} from '@openshift-console/dynamic-plugin-sdk';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { useMonitoring } from '../../hooks/useMonitoring';
import { useLocation } from 'react-router-dom';
import { AlertResource, RuleResource, SilenceResource } from '../utils';
import { useDispatch } from 'react-redux';
import { alertingClearSelectorData } from '../../store/actions';

const CmoAlertsPage = lazy(() =>
  import(/* webpackChunkName: "CmoAlertsPage" */ './AlertsPage').then((module) => ({
    default: module.MpCmoAlertsPage,
  })),
);
const CooAlertsPage = lazy(() =>
  import(/* webpackChunkName: "CooAlertsPage" */ './AlertsPage').then((module) => ({
    default: module.McpAcmAlertsPage,
  })),
);
const CmoSilencesPage = lazy(() =>
  import(/* webpackChunkName: "CmoSilencesPage" */ './SilencesPage').then((module) => ({
    default: module.MpCmoSilencesPage,
  })),
);
const CooSilencesPage = lazy(() =>
  import(/* webpackChunkName: "CooSilencesPage" */ './SilencesPage').then((module) => ({
    default: module.McpAcmSilencesPage,
  })),
);
const CmoAlertRulesPage = lazy(() =>
  import(/* webpackChunkName: "CmoAlertRulesPage" */ './AlertRulesPage').then((module) => ({
    default: module.MpCmoAlertRulesPage,
  })),
);
const CooAlertRulesPage = lazy(() =>
  import(/* webpackChunkName: "CooAlertRulesPage" */ './AlertRulesPage').then((module) => ({
    default: module.McpAcmAlertRulesPage,
  })),
);

const namespacedPages = [
  AlertResource.url,
  AlertResource.virtUrl,
  RuleResource.url,
  RuleResource.virtUrl,
  SilenceResource.url,
  SilenceResource.virtUrl,
];

const AlertingPage: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const dispatch = useDispatch();

  const [perspective] = useActivePerspective();

  const { plugin, prometheus } = useMonitoring();

  const { pathname } = useLocation();

  // contextId allow console.tab extensions to be injected
  // https://github.com/openshift/console/blob/main/frontend/packages/console-dynamic-plugin-sdk/docs/console-extensions.md#consoletab
  const contextId = `${perspective}-alerts-nav`;

  const pages = useMemo(
    () => [
      {
        href: 'alerts',
        // t('Alerts')
        nameKey: 'Alerts',
        component: plugin === 'monitoring-plugin' ? CmoAlertsPage : CooAlertsPage,
        name: 'Alerts',
      },
      {
        href: 'silences',
        // t('Silences')
        nameKey: 'Silences',
        component: plugin === 'monitoring-plugin' ? CmoSilencesPage : CooSilencesPage,
        name: 'Silences',
      },
      {
        href: 'alertrules',
        // t('Alerting Rules') -- for console.tab extension
        // t('Alerting rules')
        nameKey: 'Alerting rules',
        component: plugin === 'monitoring-plugin' ? CmoAlertRulesPage : CooAlertRulesPage,
        name: 'Alerting rules',
      },
    ],
    [plugin],
  );

  return (
    <>
      {namespacedPages.includes(pathname) && (
        <NamespaceBar
          onNamespaceChange={(namespace) =>
            dispatch(alertingClearSelectorData(prometheus, namespace))
          }
        />
      )}
      <ListPageHeader title={t('Alerting')} />
      <HorizontalNav contextId={contextId} pages={pages} />
    </>
  );
};

export const MpCmoAlertingPage: FC = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <AlertingPage />
    </MonitoringProvider>
  );
};

export const McpAcmAlertingPage: FC = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <AlertingPage />
    </MonitoringProvider>
  );
};
