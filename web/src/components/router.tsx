import {
  AlertingRulesSourceExtension,
  isAlertingRulesSource,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';

import { getAllQueryArguments } from './console/utils/router';

import MonitoringDashboardsPage from './dashboards/perses/dashboard-page';
import MonitoringLegacyDashboardsPage from './dashboards/legacy/legacy-dashboard-page';
import { QueryBrowserPage } from './metrics';
import { CreateSilence, EditSilence } from './silence-form';
import { TargetsUI } from './targets';

import './_monitoring.scss';
import { UrlRoot, usePerspective } from './hooks/usePerspective';
import AlertsPage from './alerting/AlertsPage';
import AlertsDetailsPage from './alerting/AlertsDetailPage';
import { useRulesAlertsPoller } from './hooks/useRulesAlertsPoller';
import { useSilencesPoller } from './hooks/useSilencesPoller';
import SilencesPage from './alerting/SilencesPage';
import SilencesDetailsPage from './alerting/SilencesDetailPage';
import AlertRulesDetailsPage from './alerting/AlertRulesDetailsPage';
import AlertingPage from './alerting/AlertingPage';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';

export const PersesContext = React.createContext(false);

const PollingPagesRouter = () => {
  const { alertingContextId, perspective, urlRoot } = usePerspective();

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
    return <DevelopmentAlertingRouter />;
  }

  return <AlertingRouter root={urlRoot} />;
};

const AlertingRouter: React.FC<{ root: UrlRoot }> = ({ root }) => (
  <Switch>
    <Route
      path={`/${root}/(alerts|alertrules|silences|incidents)`}
      exact
      component={AlertingPage}
    />
    <Route path={`/${root}/alertrules/:id`} exact component={AlertRulesDetailsPage} />
    <Route path={`/${root}/alerts/:ruleID`} exact component={AlertsDetailsPage} />
    <Route path={`/${root}/silences/:id`} exact component={SilencesDetailsPage} />
    <Route path={`/${root}/silences/:id/edit`} exact component={EditSilence} />
  </Switch>
);

const DevelopmentAlertingRouter = () => (
  <Switch>
    <Route path="/dev-monitoring/ns/:ns/alerts" exact component={AlertsPage} />
    <Route path="/dev-monitoring/ns/:ns/alerts/:ruleID" component={AlertsDetailsPage} />
    <Route path="/dev-monitoring/ns/:ns/rules/:id" exact component={AlertRulesDetailsPage} />
    <Route path="/dev-monitoring/ns/:ns/silences" exact component={SilencesPage} />
    <Route path="/dev-monitoring/ns/:ns/silences/:id" exact component={SilencesDetailsPage} />
    <Route path="/dev-monitoring/ns/:ns/silences/:id/edit" exact component={EditSilence} />
  </Switch>
);

const NonPollingRouter: React.FC<{ root: UrlRoot }> = ({ root }) => (
  <Switch>
    {/* This redirect also handles the `/${root}/#/alerts?...` link URLs generated by
    Alertmanager (because the `#` is considered the end of the URL) */}
    <Redirect from={`/${root}`} exact to={`/${root}/alerts`} />
    <Route path={`/${root}/silences/~new`} exact component={CreateSilence} />

    <Route path={`/${root}/v2/dashboards`} exact component={MonitoringDashboardsPage} />
    <Route
      path={`/${root}/dashboards/:dashboardName?`}
      exact
      component={MonitoringLegacyDashboardsPage}
    />

    <Route path={`/${root}/graph`} exact component={PrometheusRouterRedirect} />
    <Route path={`/${root}/query-browser`} exact component={QueryBrowserPage} />

    <Route path={`/${root}/targets`} component={TargetsUI} />

    <Route component={PollingPagesRouter} />
  </Switch>
);

const DevelopmentRouter = () => (
  <Switch>
    <Route path="/dev-monitoring/ns/:ns/" exact component={MonitoringLegacyDashboardsPage} />
    <Route path="/dev-monitoring/ns/:ns/silences/~new" exact component={CreateSilence} />
    <Route path="/dev-monitoring/ns/:ns/metrics" exact component={QueryBrowserPage} />

    <Route component={PollingPagesRouter} />
  </Switch>
);

const AcmRouter = () => (
  <Switch>
    {/* This redirect also handles the `/multicloud/monitoring/#/alerts?...` link URLs generated by
  Alertmanager (because the `#` is considered the end of the URL) */}
    <Redirect from="/multicloud/monitoring" exact to="/monitoring/alerts" />
    <Route path="/multicloud/monitoring/silences/~new" exact component={CreateSilence} />

    <Route path="/multicloud/monitoring/v2/dashboards" exact component={MonitoringDashboardsPage} />

    <Route component={PollingPagesRouter} />
  </Switch>
);

const MonitoringRouter = () => {
  const { perspective, urlRoot } = usePerspective();

  return (
    <QueryParamProvider adapter={ReactRouter5Adapter}>
      {(() => {
        switch (perspective) {
          case 'admin':
          case 'virtualization-perspective':
            return <NonPollingRouter root={urlRoot} />;
          case 'dev':
            return <DevelopmentRouter />;
          case 'acm':
            return <AcmRouter />;
        }
      })()}
    </QueryParamProvider>
  );
};

// Handles links that have the Prometheus UI's URL format (expected for links in alerts sent by
// Alertmanager). The Prometheus UI specifies the PromQL query with the GET param `g0.expr`, so we
// use that if it exists. Otherwise, just go to the query browser page with no query.
const PrometheusRouterRedirect = () => {
  const params = getAllQueryArguments();
  // leaving perspective redirect to future work
  return <Redirect to={`/monitoring/query-browser?query0=${params['g0.expr'] || ''}`} />;
};

export default MonitoringRouter;
