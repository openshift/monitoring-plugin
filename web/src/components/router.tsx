import { useActiveNamespace, useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { useDispatch } from 'react-redux';
import { Redirect, Route, Switch } from 'react-router-dom';

import { AlertingRulesSourceExtension, isAlertingRulesSource } from './console/extensions/alerts';
import { getAllQueryArguments } from './console/utils/router';

import MonitoringDashboardsPage from './dashboards/dashboard-page';
import { QueryBrowserPage } from './metrics';
import { CreateSilence, EditSilence } from './silence-form';
import { TargetsUI } from './targets';

import './_monitoring.scss';
import { usePerspective } from './hooks/usePerspective';
import AlertsPage from './alerting/AlertsPage';
import AlertsDetailsPage from './alerting/AlertsDetailPage';
import { useRulesAlertsPoller } from './hooks/useRulesAlertsPoller';
import { useSilencesPoller } from './hooks/useSilencesPoller';
import SilencesPage from './alerting/SilencesPage';
import SilencesDetailsPage from './alerting/SilencesDetailPage';
import AlertRulesDetailsPage from './alerting/AlertRulesDetailsPage';
import AlertingPage from './alerting/AlertingPage';

const PollingPagesRouter = () => {
  const dispatch = useDispatch();

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

  useRulesAlertsPoller(namespace, dispatch, alertsSource);
  useSilencesPoller({ namespace });

  if (perspective === 'acm') {
    return (
      <Switch>
        <Route
          path="/multicloud/monitoring/(alerts|alertrules|silences)"
          exact
          component={AlertingPage}
        />
        <Route
          path="/multicloud/monitoring/alertrules/:id"
          exact
          component={AlertRulesDetailsPage}
        />
        <Route path="/multicloud/monitoring/alerts/:ruleID" exact component={AlertsDetailsPage} />
        <Route path="/multicloud/monitoring/silences/:id" exact component={SilencesDetailsPage} />
        <Route path="/multicloud/monitoring/silences/:id/edit" exact component={EditSilence} />
      </Switch>
    );
  }

  if (perspective === 'dev') {
    return (
      <Switch>
        <Route path="/dev-monitoring/ns/:ns/alerts" exact component={AlertsPage} />
        <Route path="/dev-monitoring/ns/:ns/rules/:id" exact component={AlertRulesDetailsPage} />
        <Route path="/dev-monitoring/ns/:ns/alerts/:ruleID" component={AlertsDetailsPage} />
        <Route path="/dev-monitoring/ns/:ns/metrics" exact component={QueryBrowserPage} />
        <Route path="/dev-monitoring/ns/:ns/silences" exact component={SilencesPage} />
        <Route path="/dev-monitoring/ns/:ns/silences/:id" exact component={SilencesDetailsPage} />
        <Route path="/dev-monitoring/ns/:ns/silences/:id/edit" exact component={EditSilence} />
      </Switch>
    );
  }

  if (perspective === 'virtualization-perspective') {
    return (
      <Switch>
        <Route path="/virt-monitoring/alerts" exact component={AlertsPage} />
        <Route path="/virt-monitoring/rules/:id" exact component={AlertRulesDetailsPage} />
        <Route path="/virt-monitoring/alerts/:ruleID" component={AlertsDetailsPage} />
        <Route path="/virt-monitoring/query-browser" exact component={QueryBrowserPage} />
        <Route path="/virt-monitoring/silences" exact component={SilencesPage} />
        <Route path="/virt-monitoring/silences/:id" exact component={SilencesDetailsPage} />
        <Route path="/virt-monitoring/silences/:id/edit" exact component={EditSilence} />
        <Route
          path="/virt-monitoring/dashboards/:board?"
          exact
          component={MonitoringDashboardsPage}
        />
        <Route path="/virt-monitoring/targets" component={TargetsUI} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route
        path="/monitoring/(alerts|alertrules|silences|incidents)"
        exact
        component={AlertingPage}
      />
      <Route path="/monitoring/alertrules/:id" exact component={AlertRulesDetailsPage} />
      <Route path="/monitoring/alerts/:ruleID" exact component={AlertsDetailsPage} />
      <Route path="/monitoring/silences/:id" exact component={SilencesDetailsPage} />
      <Route path="/monitoring/silences/:id/edit" exact component={EditSilence} />
    </Switch>
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

const AcmAlertingRouter = () => (
  <Switch>
    {/* This redirect also handles the `/monitoring/#/alerts?...` link URLs generated by
    Alertmanager (because the `#` is considered the end of the URL) */}
    <Redirect from="/multicloud/monitoring" exact to="/monitoring/alerts" />
    <Route path="/multicloud/monitoring/silences/~new" exact component={CreateSilence} />
    <Route component={PollingPagesRouter} />
  </Switch>
);

const MonitoringRouter = () => {
  const { perspective } = usePerspective();

  if (perspective === 'acm') {
    return <AcmAlertingRouter />;
  }

  return (
    <Switch>
      {/* This redirect also handles the `/monitoring/#/alerts?...` link URLs generated by
    Alertmanager (because the `#` is considered the end of the URL) */}
      <Redirect from="/monitoring" exact to="/monitoring/alerts" />
      <Route path="/dev-monitoring/ns/:ns/" exact component={MonitoringDashboardsPage} />
      <Route
        path="/monitoring/dashboards/:dashboardName?"
        exact
        component={MonitoringDashboardsPage}
      />
      <Route path="/monitoring/graph" exact component={PrometheusRouterRedirect} />
      <Route path="/monitoring/query-browser" exact component={QueryBrowserPage} />
      <Route path="/monitoring/silences/~new" exact component={CreateSilence} />
      <Route path="/dev-monitoring/ns/:ns/silences/~new" exact component={CreateSilence} />
      <Route path="/monitoring/targets" component={TargetsUI} />
      <Route component={PollingPagesRouter} />
    </Switch>
  );
};

export default MonitoringRouter;
