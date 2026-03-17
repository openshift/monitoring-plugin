import '@patternfly/patternfly/patternfly.css';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom-v5-compat';
import { combineReducers, createStore } from 'redux';
import { MpCmoAlertingPage } from './components/alerting/AlertingPage';
import { MpCmoAlertRulesDetailsPage } from './components/alerting/AlertRulesDetailsPage';
import { MpCmoAlertRulesPage } from './components/alerting/AlertRulesPage';
import { MpCmoAlertsDetailsPage } from './components/alerting/AlertsDetailsPage';
import { MpCmoAlertsPage } from './components/alerting/AlertsPage';
import { MpCmoCreateSilencePage } from './components/alerting/SilenceCreatePage';
import { MpCmoSilenceEditPage } from './components/alerting/SilenceEditPage';
import { MpCmoSilencesDetailsPage } from './components/alerting/SilencesDetailsPage';
import { MpCmoSilencesPage } from './components/alerting/SilencesPage';
import { MpCmoLegacyDashboardsPage } from './components/dashboards/legacy/legacy-dashboard-page';
import { MpCmoMetricsPage } from './components/MetricsPage';
import PrometheusRedirectPage from './components/redirects/prometheus-redirect-page';
import { MpCmoTargetsPage } from './components/targets-page';
import i18n from './i18n';
import ObserveReducers from './store/reducers';

type RootState = { observe: any };

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
      <Routes>
        <Route path="silences/~new" element={<MpCmoCreateSilencePage />} />

        <Route path="dashboards" element={<MpCmoLegacyDashboardsPage />} />
        <Route path="dashboards/:dashboardName" element={<MpCmoLegacyDashboardsPage />} />

        <Route path="graph" element={<PrometheusRedirectPage />} />
        <Route path="query-browser" element={<MpCmoMetricsPage />} />

        <Route path="targets" element={<MpCmoTargetsPage />} />
        <Route path="targets/:scrapeUrl" element={<MpCmoTargetsPage />} />

        <Route path="alertrules/:id" element={<MpCmoAlertRulesDetailsPage />} />
        <Route path="alerts/:ruleID" element={<MpCmoAlertsDetailsPage />} />
        <Route path="silences/:id" element={<MpCmoSilencesDetailsPage />} />
        <Route path="silences/:id/edit" element={<MpCmoSilenceEditPage />} />

        <Route element={<MpCmoAlertingPage />}>
          <Route path="alerts" element={<MpCmoAlertsPage />} />
          <Route path="alertrules" element={<MpCmoAlertRulesPage />} />
          <Route path="silences" element={<MpCmoSilencesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </Provider>
);

i18n.on('initialized', () => {
  ReactDOM.render(<App />, document.getElementById('app'));
});
