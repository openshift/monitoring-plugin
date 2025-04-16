import {
  AlertingRulesSourceExtension,
  isAlertingRulesSource,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { Route, Routes, useLocation, useParams } from 'react-router-dom-v5-compat';

import MonitoringDashboardsPage from './dashboards/perses/dashboard-page';
import MonitoringLegacyDashboardsPage from './dashboards/legacy/legacy-dashboard-page';
import { QueryBrowserPage } from './metrics';
import { CreateSilence } from './alerting/SilenceForm';
import { TargetsUI } from './targets';

import { usePerspective } from './hooks/usePerspective';
import AlertsPage from './alerting/AlertsPage';
import AlertsDetailsPage from './alerting/AlertsDetailPage';
import { useRulesAlertsPoller } from './hooks/useRulesAlertsPoller';
import { useSilencesPoller } from './hooks/useSilencesPoller';
import SilencesPage from './alerting/SilencesPage';
import SilencesDetailsPage from './alerting/SilencesDetailPage';
import AlertRulesDetailsPage from './alerting/AlertRulesDetailsPage';
import AlertRulesPage from './alerting/AlertRulesPage';
import AlertingPage from './alerting/AlertingPage';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';

export const PersesContext = React.createContext(false);

const PollingPagesRouter = () => {
  console.log('1. JZ PollingPagesRouter');

  const { alertingContextId, perspective } = usePerspective();

  const [namespace] = useActiveNamespace();

  const [customExtensions] =
    useResolvedExtensions<AlertingRulesSourceExtension>(isAlertingRulesSource);

  const alertsSource = React.useMemo(
    () =>
      customExtensions
        .filter((extension) => extension.properties.contextId === alertingContextId)
        .map((extension) => extension.properties),
    [customExtensions, alertingContextId],
  );

  useRulesAlertsPoller(namespace, alertsSource);
  useSilencesPoller({ namespace });

  if (perspective === 'dev') {
    console.log('JZ POLLING PAGES ROUTER DEV PERSPECTIVE');
    return <AlertingRouter />;
  }

  return <AlertingRouter />;
};

const AlertingRouter: React.FC = () => {
  console.log('1. AlertingRouter');
  // path root = /monitoring/...
  return (
    <Routes>
      <Route path="alerts/:ruleID" element={<AlertsDetailsPage />} />
      <Route path="alertrules/:id" element={<AlertRulesDetailsPage />} />
      <Route path="silences/:id" element={<SilencesDetailsPage />} />
      <Route element={<AlertingPage />}>
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="alertrules" element={<AlertRulesPage />} />
        <Route path="silences" element={<SilencesPage />} />
      </Route>
    </Routes>
  );
};

const DevelopmentAlertingRouter = () => {
  return (
    <Routes>
      <Route path="alerts" element={<AlertsPage />} />
      <Route path="alerts/:ruleID" element={<AlertsDetailsPage />} />
      <Route path="rules/:id" element={<AlertRulesDetailsPage />} />
      <Route path="silences" element={<SilencesPage />} />
      <Route path="silences/:id" element={<SilencesDetailsPage />} />
    </Routes>
  );
};

const NonPollingRouter = () => {
  console.log('1. JZ NonPollingRouter');
  const location = useLocation();
  console.log('1. NonPollingRouter route:', location.pathname);
  const param = useParams();
  console.log('1. NonPollingRouter param:', param);

  return (
    <Routes>
      {/* This redirect also handles the `${root}/#/alerts?...` link URLs generated by
    Alertmanager (because the `#` is considered the end of the URL) */}
      <Route path={`silences/~new`} element={<CreateSilence />} />
      <Route path={`v2/dashboards`} element={<MonitoringDashboardsPage />} />
      <Route path={`dashboards/:dashboardName?`} element={<MonitoringLegacyDashboardsPage />} />
      <Route path={`query-browser`} element={<QueryBrowserPage />} />
      <Route path={`targets`} element={<TargetsUI />} />
      <Route path="*" element={<PollingPagesRouter />} />
    </Routes>
  );
};

const DevelopmentRouter = () => {
  console.log('JZ DevelopmentRouter');

  return (
    <Routes>
      <Route path="dev-monitoring/ns/:ns/" element={<MonitoringLegacyDashboardsPage />} />
      <Route path={`silences/~new`} element={<CreateSilence />} />
      <Route path={`metrics`} element={<QueryBrowserPage />} />

      <Route path="*" element={<PollingPagesRouter />} />
    </Routes>
  );
};

const AcmRouter = () => (
  <Routes>
    {/* This redirect also handles the `multicloud/monitoring/#/alerts?...` link URLs generated by
  Alertmanager (because the `#` is considered the end of the URL) */}
    <Route path="multicloud/monitoring/silences/~new" element={<CreateSilence />} />

    <Route path="multicloud/monitoring/v2/dashboards" element={<MonitoringDashboardsPage />} />

    <Route element={<PollingPagesRouter />} />
  </Routes>
);

const MonitoringRouter = () => {
  const { perspective } = usePerspective();

  return (
    <QueryParamProvider adapter={ReactRouter5Adapter}>
      {(() => {
        switch (perspective) {
          case 'admin':
          case 'virtualization-perspective':
            return <NonPollingRouter />;
          case 'dev':
            return <DevelopmentRouter />;
          case 'acm':
            return <AcmRouter />;
        }
      })()}
    </QueryParamProvider>
  );
};
export default MonitoringRouter;
