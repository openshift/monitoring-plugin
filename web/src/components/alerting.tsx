import {
  Alert,
  AlertSeverity,
  AlertStates,
  ListPageFilter,
  PrometheusAlert,
  RowFilter,
  RowProps,
  Rule,
  TableColumn,
  useActiveNamespace,
  useListPageFilter,
  useResolvedExtensions,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import { sortable } from '@patternfly/react-table';
import classNames from 'classnames';
import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Redirect, Route, RouteComponentProps, Switch } from 'react-router-dom';

import { withFallback } from './console/console-shared/error/error-boundary';
import { AlertingRulesSourceExtension, isAlertingRulesSource } from './console/extensions/alerts';
import { getAllQueryArguments } from './console/utils/router';
import { EmptyBox } from './console/utils/status-box';

import MonitoringDashboardsPage from './dashboards';
import { QueryBrowserPage } from './metrics';
import { CreateSilence, EditSilence } from './silence-form';
import { TargetsUI } from './targets';
import { Alerts, AlertSource } from './types';
import {
  alertingRuleStateOrder,
  alertSeverityOrder,
  fuzzyCaseInsensitive,
  RuleResource,
} from './utils';

import './_monitoring.scss';
import {
  getAlertRulesUrl,
  getAlertsUrl,
  getAlertUrl,
  getNewSilenceAlertUrl,
  getLegacyObserveState,
  getQueryBrowserUrl,
  getRuleUrl,
  getSilencesUrl,
  usePerspective,
} from './hooks/usePerspective';
import {
  alertingRuleSource,
  AlertStateIcon,
  getAdditionalSources,
  getAlertStateKey,
  MonitoringResourceIcon,
  Severity,
  SilencesNotLoadedWarning,
} from './alerting/AlertUtils';
import AlertsPage from './alerting/AlertsPage';
import AlertsDetailsPage from './alerting/AlertsDetailPage';
import { useRulesAlertsPoller } from './hooks/useRulesAlertsPoller';
import { useSilencesPoller } from './hooks/useSilencesPoller';
import { MonitoringState } from '../reducers/observe';
import SilencesPage from './alerting/SilencesPage';
import SilencesDetailsPage from './alerting/SilencesDetailPage';
import { useFeatures } from './hooks/useFeatures';
import AlertRulesDetailsPage from './alerting/AlertRulesDetailsPage';

const StateCounts: React.FC<{ alerts: PrometheusAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const counts = _.countBy(alerts, 'state');
  const states = [AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced].filter(
    (s) => counts[s] > 0,
  );

  return (
    <>
      {states.map((s) => (
        <div className="monitoring-icon-wrap" key={s}>
          <AlertStateIcon state={s} /> {counts[s]} {getAlertStateKey(s, t)}
        </div>
      ))}
    </>
  );
};

export const severityRowFilter = (t): RowFilter => ({
  filter: (filter, alert: Alert) =>
    filter.selected?.includes(alert.labels?.severity) || _.isEmpty(filter.selected),
  filterGroupName: t('Severity'),
  items: [
    { id: AlertSeverity.Critical, title: t('Critical') },
    { id: AlertSeverity.Warning, title: t('Warning') },
    { id: AlertSeverity.Info, title: t('Info') },
    { id: AlertSeverity.None, title: t('None') },
  ],
  reducer: ({ labels }: Alert | Rule) => labels?.severity,
  type: 'alert-severity',
});

const ruleHasAlertState = (rule: Rule, state: AlertStates): boolean =>
  state === AlertStates.NotFiring ? _.isEmpty(rule.alerts) : _.some(rule.alerts, { state });

const ruleAlertStateFilter = (filter, rule: Rule) =>
  (filter.selected?.includes(AlertStates.NotFiring) && _.isEmpty(rule.alerts)) ||
  _.some(rule.alerts, (a) => filter.selected?.includes(a.state)) ||
  _.isEmpty(filter.selected);

export const alertStateFilter = (t): RowFilter => ({
  filter: ruleAlertStateFilter,
  filterGroupName: t('Alert State'),
  isMatch: ruleHasAlertState,
  items: [
    { id: AlertStates.Firing, title: t('Firing') },
    { id: AlertStates.Pending, title: t('Pending') },
    { id: AlertStates.Silenced, title: t('Silenced') },
    { id: AlertStates.NotFiring, title: t('Not Firing') },
  ],
  type: 'alerting-rule-has-alert-state',
});

const tableRuleClasses = [
  'pf-v5-u-w-50 pf-v5-u-w-33-on-sm', // Name
  'pf-v5-m-hidden pf-v5-m-visible-on-sm', // Severity
  '', // Alert state
  'pf-v5-m-hidden pf-v5-m-visible-on-sm', // Source
];

const RuleTableRow: React.FC<RowProps<Rule>> = ({ obj }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const title: string = obj.annotations?.description || obj.annotations?.message;

  return (
    <>
      <td className={tableRuleClasses[0]} title={title}>
        <div className="co-resource-item">
          <MonitoringResourceIcon resource={RuleResource} />
          <Link to={getRuleUrl(perspective, obj)} className="co-resource-item__resource-name">
            {obj.name}
          </Link>
        </div>
      </td>
      <td className={tableRuleClasses[1]} title={title}>
        <Severity severity={obj.labels?.severity} />
      </td>
      <td className={tableRuleClasses[2]} title={title}>
        {_.isEmpty(obj.alerts) ? '-' : <StateCounts alerts={obj.alerts} />}
      </td>
      <td className={tableRuleClasses[3]} title={title}>
        {alertingRuleSource(obj) === AlertSource.User ? t('User') : t('Platform')}
      </td>
    </>
  );
};

const RulesPage_: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { alertsKey, silencesKey, rulesKey, perspective, defaultAlertTenant } = usePerspective();

  const data: Rule[] = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(rulesKey),
  );
  const { loaded = false, loadError }: Alerts = useSelector(
    (state: MonitoringState) => getLegacyObserveState(perspective, state)?.get(alertsKey) || {},
  );
  const silencesLoadError = useSelector(
    (state: MonitoringState) =>
      getLegacyObserveState(perspective, state)?.get(silencesKey)?.loadError,
  );

  const ruleAdditionalSources = React.useMemo(
    () => getAdditionalSources(data, alertingRuleSource),
    [data],
  );

  const rowFilters: RowFilter[] = [
    // TODO: The "name" filter doesn't really fit useListPageFilter's idea of a RowFilter, but
    //       useListPageFilter doesn't yet provide a better way to add a filter like this
    {
      filter: (filter, rule: Rule) => fuzzyCaseInsensitive(filter.selected?.[0], rule.name),
      filterGroupName: '',
      items: [],
      type: 'name',
    } as RowFilter,
    alertStateFilter(t),
    severityRowFilter(t),
    {
      defaultSelected: defaultAlertTenant,
      filter: (filter, rule: Rule) =>
        filter.selected?.includes(alertingRuleSource(rule)) || _.isEmpty(filter.selected),
      filterGroupName: t('Source'),
      items: [
        { id: AlertSource.Platform, title: t('Platform') },
        { id: AlertSource.User, title: t('User') },
        ...ruleAdditionalSources,
      ],
      reducer: alertingRuleSource,
      type: 'alerting-rule-source',
    },
  ];

  const [staticData, filteredData, onFilterChange] = useListPageFilter(data, rowFilters);

  const columns = React.useMemo<TableColumn<Rule>[]>(
    () => [
      {
        id: 'name',
        props: { className: tableRuleClasses[0] },
        sort: 'name',
        title: t('Name'),
        transforms: [sortable],
      },
      {
        id: 'severity',
        props: { className: tableRuleClasses[1] },
        sort: (rules: Rule[], direction: 'asc' | 'desc') =>
          _.orderBy(rules, alertSeverityOrder, [direction]) as Rule[],
        title: t('Severity'),
        transforms: [sortable],
      },
      {
        id: 'state',
        props: { className: tableRuleClasses[2] },
        sort: (rules: Rule[], direction: 'asc' | 'desc') =>
          _.orderBy(rules, alertingRuleStateOrder, [direction]),
        title: t('Alert state'),
        transforms: [sortable],
      },
      {
        id: 'source',
        props: { className: tableRuleClasses[3] },
        sort: (rules: Rule[], direction: 'asc' | 'desc') =>
          _.orderBy(rules, alertingRuleSource, [direction]),
        title: t('Source'),
        transforms: [sortable],
      },
    ],
    [t],
  );

  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
      <div className="co-m-pane__body">
        <ListPageFilter
          data={staticData}
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore TODO
          labelFilter="observe-rules"
          labelPath="labels"
          loaded={loaded}
          onFilterChange={onFilterChange}
          rowFilters={rowFilters}
        />
        {silencesLoadError && <SilencesNotLoadedWarning silencesLoadError={silencesLoadError} />}
        <div className="row">
          <div className="col-xs-12">
            <VirtualizedTable<Rule>
              aria-label={t('Alerting rules')}
              label={t('Alerting rules')}
              columns={columns}
              data={filteredData ?? []}
              loaded={loaded}
              loadError={loadError}
              Row={RuleTableRow}
              unfilteredData={data}
              NoDataEmptyMsg={() => {
                return <EmptyBox label={t('Alerting rules')} />;
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
const RulesPage = withFallback(RulesPage_);

const Tab: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <li
    className={classNames('co-m-horizontal-nav__menu-item', {
      'co-m-horizontal-nav-item--active': active,
    })}
  >
    {children}
  </li>
);

const AlertingPage: React.FC<RouteComponentProps<{ url: string }>> = ({ match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const alertsPath = getAlertsUrl(perspective);
  const rulesPath = getAlertRulesUrl(perspective);
  const silencesPath = getSilencesUrl(perspective);

  const { url } = match;

  return (
    <>
      <div className="co-m-nav-title co-m-nav-title--detail">
        <h1 className="co-m-pane__heading">
          <div className="co-m-pane__name co-resource-item">
            <span className="co-resource-item__resource-name" data-test-id="resource-title">
              {t('Alerting')}
            </span>
          </div>
        </h1>
      </div>
      <ul className="co-m-horizontal-nav__menu">
        <Tab active={url === alertsPath}>
          <Link to={alertsPath}>{t('Alerts')}</Link>
        </Tab>
        <Tab active={url === silencesPath}>
          <Link to={silencesPath}>{t('Silences')}</Link>
        </Tab>
        <Tab active={url === rulesPath}>
          <Link to={rulesPath}>{t('Alerting rules')}</Link>
        </Tab>
      </ul>
      <Switch>
        <Route path={alertsPath} exact component={AlertsPage} />
        <Route path={rulesPath} exact component={RulesPage} />
        <Route path={silencesPath} exact component={SilencesPage} />
      </Switch>
    </>
  );
};

const PollerPages = () => {
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
        <Route
          path="/virt-monitoring/(alerts|alertrules|silences)"
          exact
          component={AlertingPage}
        />
        <Route path="/virt-monitoring/alertrules/:id" exact component={AlertRulesDetailsPage} />
        <Route path="/virt-monitoring/alerts/:ruleID" exact component={AlertsDetailsPage} />
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
const PrometheusUIRedirect = () => {
  const params = getAllQueryArguments();
  // leaving perspective redirect to future work
  return <Redirect to={`/monitoring/query-browser?query0=${params['g0.expr'] || ''}`} />;
};

const MonitoringUI = () => {
  const { perspective } = usePerspective();

  if (perspective === 'acm') {
    return <AcmAlertingUI />;
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
      <Route path="/monitoring/graph" exact component={PrometheusUIRedirect} />
      <Route path="/monitoring/query-browser" exact component={QueryBrowserPage} />
      <Route path="/monitoring/silences/~new" exact component={CreateSilence} />
      <Route path="/dev-monitoring/ns/:ns/silences/~new" exact component={CreateSilence} />
      <Route path="/monitoring/targets" component={TargetsUI} />
      <Route component={PollerPages} />
    </Switch>
  );
};

const AcmAlertingUI = () => (
  <Switch>
    {/* This redirect also handles the `/monitoring/#/alerts?...` link URLs generated by
    Alertmanager (because the `#` is considered the end of the URL) */}
    <Redirect from="/multicloud/monitoring" exact to="/monitoring/alerts" />
    <Route path="/multicloud/monitoring/silences/~new" exact component={CreateSilence} />
    <Route component={PollerPages} />
  </Switch>
);

export default MonitoringUI;
