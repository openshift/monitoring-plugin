import '@patternfly/patternfly/patternfly.css';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom-v5-compat';
import { combineReducers, createStore } from 'redux';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import AlertingPage from './components/alerting/AlertingPage';
import AlertRulesDetailsPage from './components/alerting/AlertRulesDetailsPage';
import AlertRulesPage from './components/alerting/AlertRulesPage';
import AlertsDetailsPage from './components/alerting/AlertsDetailsPage';
import AlertsPage from './components/alerting/AlertsPage';
import SilenceCreatePage from './components/alerting/SilenceCreatePage';
import SilenceEditPage from './components/alerting/SilenceEditPage';
import SilencesDetailsPage from './components/alerting/SilencesDetailsPage';
import SilencesPage from './components/alerting/SilencesPage';
import LegacyDashboardsPage from './components/dashboards/legacy/legacy-dashboard-page';
import MetricsPage from './components/MetricsPage';
import PrometheusRedirectPage from './components/prometheus-redirect-page';
import TargetsPage from './components/targets-page';
import i18n from './i18n';
import ObserveReducers, { ObserveState } from './reducers/observe';

type RootState = { observe: ObserveState };

const baseReducers = Object.freeze({ observe: ObserveReducers });

const store = createStore(combineReducers<RootState>(baseReducers), {});

const App = () => (
  <Provider store={store}>
    <BrowserRouter>
      <div id="page-sidebar">
        Observe
        <Link to="/monitoring/alerts">Alerting</Link>
        <Link to="/monitoring/query-browser">Metrics</Link>
        <Link to="/monitoring/dashboards">Dashboards</Link>
        <Link to="/monitoring/targets">Targets</Link>
      </div>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <Routes>
          <Route path="silences/~new" element={<SilenceCreatePage />} />

          <Route path="dashboards" element={<LegacyDashboardsPage />} />
          <Route path="dashboards/:dashboardName" element={<LegacyDashboardsPage />} />

          <Route path="graph" element={<PrometheusRedirectPage />} />
          <Route path="query-browser" element={<MetricsPage />} />

          <Route path="targets" element={<TargetsPage />} />
          <Route path="targets/:scrapeUrl" element={<TargetsPage />} />

          <Route path="alertrules/:id" element={<AlertRulesDetailsPage />} />
          <Route path="alerts/:ruleID" element={<AlertsDetailsPage />} />
          <Route path="silences/:id" element={<SilencesDetailsPage />} />
          <Route path="silences/:id/edit" element={<SilenceEditPage />} />

          <Route element={<AlertingPage />}>
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="alertrules" element={<AlertRulesPage />} />
            <Route path="silences" element={<SilencesPage />} />
          </Route>
        </Routes>
      </QueryParamProvider>
    </BrowserRouter>
  </Provider>
);

i18n.on('initialized', () => {
  ReactDOM.render(<App />, document.getElementById('app'));
});
