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
  Timestamp,
  useListPageFilter,
  useResolvedExtensions,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Breadcrumb,
  BreadcrumbItem,
  CodeBlock,
  CodeBlockCode,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { DropdownItem as DropdownItemDeprecated } from '@patternfly/react-core/deprecated';
import { sortable } from '@patternfly/react-table';
import classNames from 'classnames';
import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Redirect, Route, RouteComponentProps, Switch, withRouter } from 'react-router-dom';

// TODO: These will be available in future versions of the plugin SDK
import { formatPrometheusDuration } from './console/utils/datetime';
import { useActiveNamespace } from './console/console-shared/hooks/useActiveNamespace';

import { withFallback } from './console/console-shared/error/error-boundary';
import {
  AlertingRuleChartExtension,
  AlertingRulesSourceExtension,
  isAlertingRuleChart,
  isAlertingRulesSource,
} from './console/extensions/alerts';
import { SectionHeading } from './console/utils/headings';
import { ExternalLink } from './console/utils/link';
import { getAllQueryArguments } from './console/utils/router';
import { EmptyBox, StatusBox } from './console/utils/status-box';

import MonitoringDashboardsPage from './dashboards';
import KebabDropdown from './kebab-dropdown';
import { Labels } from './labels';
import { QueryBrowserPage, ToggleGraph } from './metrics';
import { CreateSilence, EditSilence } from './silence-form';
import { TargetsUI } from './targets';
import { Alerts, AlertSource } from './types';
import {
  alertDescription,
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
  getObserveState,
  getQueryBrowserUrl,
  getRuleUrl,
  getSilencesUrl,
  usePerspective,
} from './hooks/usePerspective';
import {
  alertingRuleSource,
  AlertState,
  AlertStateIcon,
  getAdditionalSources,
  getAlertStateKey,
  getSourceKey,
  Graph,
  MonitoringResourceIcon,
  PopoverField,
  Severity,
  SeverityBadge,
  SeverityHelp,
  SilencesNotLoadedWarning,
  SourceHelp,
} from './alerting/AlertUtils';
import AlertsPage from './alerting/AlertsPage';
import AlertsDetailsPage from './alerting/AlertsDetailPage';
import { useRulesAlertsPoller } from './hooks/useRulesAlertsPoller';
import { useSilencesPoller } from './hooks/useSilencesPoller';
import { MonitoringState } from '../reducers/observe';
import SilencesPage from './alerting/SilencesPage';
import SilencesDetailsPage from './alerting/SilencesDetailPage';
import IncidentsPage from '../components/Incidents/IncidentsPage';

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

// Renders Prometheus template text and highlights any {{ ... }} tags that it contains
const PrometheusTemplate = ({ text }) => (
  <>
    {text?.split(/(\{\{[^{}]*\}\})/)?.map((part: string, i: number) =>
      part.match(/^\{\{[^{}]*\}\}$/) ? (
        <code className="co-code prometheus-template-tag" key={i}>
          {part}
        </code>
      ) : (
        part
      ),
    )}
  </>
);

type ActiveAlertsProps = RouteComponentProps & {
  alerts: PrometheusAlert[];
  namespace: string;
  ruleID: string;
};

const ActiveAlerts_: React.FC<ActiveAlertsProps> = ({ alerts, history, namespace, ruleID }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  return (
    <div className="co-m-table-grid co-m-table-grid--bordered">
      <div className="row co-m-table-grid__head">
        <div className="col-xs-6">{t('Description')}</div>
        <div className="col-sm-2 hidden-xs">{t('Active since')}</div>
        <div className="col-sm-2 col-xs-3">{t('State')}</div>
        <div className="col-sm-2 col-xs-3">{t('Value')}</div>
      </div>
      <div className="co-m-table-grid__body">
        {_.sortBy<PrometheusAlert>(alerts, alertDescription).map((a, i) => (
          <div className="row co-resource-list__item" key={i}>
            <div className="col-xs-6">
              <Link
                className="co-resource-item"
                data-test="active-alerts"
                to={getAlertUrl(perspective, a, ruleID, namespace)}
              >
                {alertDescription(a)}
              </Link>
            </div>
            <div className="col-sm-2 hidden-xs">
              <Timestamp timestamp={a.activeAt} />
            </div>
            <div className="col-sm-2 col-xs-3">
              <AlertState state={a.state} />
            </div>
            <div className="col-sm-2 col-xs-3 co-truncate">{a.value}</div>
            {a.state !== AlertStates.Silenced && (
              <div className="dropdown-kebab-pf">
                <KebabDropdown
                  dropdownItems={[
                    <DropdownItemDeprecated
                      component="button"
                      key="silence"
                      onClick={() => history.push(getNewSilenceAlertUrl(perspective, a))}
                    >
                      {t('Silence alert')}
                    </DropdownItemDeprecated>,
                  ]}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
const ActiveAlerts = withRouter(ActiveAlerts_);

type AlertRulesDetailsPageProps = RouteComponentProps<{ id: string; ns?: string }>;

const AlertRulesDetailsPage_: React.FC<AlertRulesDetailsPageProps> = ({ match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { rulesKey, alertsKey, perspective } = usePerspective();
  const namespace = match.params?.ns;

  const rules: Rule[] = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.get(rulesKey),
  );
  const rule = _.find(rules, { id: _.get(match, 'params.id') });

  const { loaded, loadError }: Alerts = useSelector(
    (state: MonitoringState) => getObserveState(perspective, state)?.get(alertsKey) || {},
  );

  const sourceId = rule?.sourceId;

  // Load alert metrics chart from plugin
  const [resolvedAlertsChartExtensions] =
    useResolvedExtensions<AlertingRuleChartExtension>(isAlertingRuleChart);
  const alertChartExtensions = resolvedAlertsChartExtensions
    .filter((extension) => extension.properties.sourceId === sourceId)
    .map((extension) => extension.properties.chart);

  const AlertChart = alertChartExtensions[0];

  const formatSeriesTitle = (alertLabels) => {
    const nameLabel = alertLabels.__name__ ?? '';
    const otherLabels = _.omit(alertLabels, '__name__');
    return `${nameLabel}{${_.map(otherLabels, (v, k) => `${k}="${v}"`).join(',')}}`;
  };

  // eslint-disable-next-line camelcase
  const runbookURL = rule?.annotations?.runbook_url;

  return (
    <>
      <Helmet>
        <title>{t('{{name}} details', { name: rule?.name || RuleResource.label })}</title>
      </Helmet>
      <StatusBox data={rule} label={RuleResource.label} loaded={loaded} loadError={loadError}>
        <div className="pf-c-page__main-breadcrumb">
          <Breadcrumb className="monitoring-breadcrumbs">
            <BreadcrumbItem>
              <Link className="pf-c-breadcrumb__link" to={getAlertRulesUrl(perspective)}>
                {t('Alerting rules')}
              </Link>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{t('Alerting rule details')}</BreadcrumbItem>
          </Breadcrumb>
        </div>
        <div className="co-m-nav-title co-m-nav-title--detail co-m-nav-title--breadcrumbs">
          <h1 className="co-m-pane__heading">
            <div data-test="resource-title" className="co-resource-item">
              <MonitoringResourceIcon className="co-m-resource-icon--lg" resource={RuleResource} />
              {rule?.name}
              <SeverityBadge severity={rule?.labels?.severity} />
            </div>
          </h1>
        </div>
        <div className="co-m-pane__body">
          <div className="monitoring-heading">
            <SectionHeading text={t('Alerting rule details')} />
          </div>
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>{t('Name')}</dt>
                  <dd>{rule?.name}</dd>
                  <dt>
                    <PopoverField bodyContent={<SeverityHelp />} label={t('Severity')} />
                  </dt>
                  <dd>
                    <Severity severity={rule?.labels?.severity} />
                  </dd>
                  {rule?.annotations?.description && (
                    <>
                      <dt>{t('Description')}</dt>
                      <dd>
                        <PrometheusTemplate text={rule.annotations.description} />
                      </dd>
                    </>
                  )}
                  {rule?.annotations?.summary && (
                    <>
                      <dt>{t('Summary')}</dt>
                      <dd>{rule.annotations.summary}</dd>
                    </>
                  )}
                  {rule?.annotations?.message && (
                    <>
                      <dt>{t('Message')}</dt>
                      <dd>
                        <PrometheusTemplate text={rule.annotations.message} />
                      </dd>
                    </>
                  )}
                  {runbookURL && (
                    <>
                      <dt>{t('Runbook')}</dt>
                      <dd>
                        <ExternalLink href={runbookURL} text={runbookURL} />
                      </dd>
                    </>
                  )}
                </dl>
              </div>
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>
                    <PopoverField bodyContent={<SourceHelp />} label={t('Source')} />
                  </dt>
                  <dd>{rule && getSourceKey(_.startCase(alertingRuleSource(rule)), t)}</dd>
                  {_.isInteger(rule?.duration) && (
                    <>
                      <dt>{t('For')}</dt>
                      <dd>
                        {rule.duration === 0 ? '-' : formatPrometheusDuration(rule.duration * 1000)}
                      </dd>
                    </>
                  )}
                  <dt>{t('Expression')}</dt>
                  <dd>
                    {/* display a link only if its a metrics based alert */}
                    {!sourceId || sourceId === 'prometheus' ? (
                      <Link to={getQueryBrowserUrl(perspective, rule?.query, namespace)}>
                        <CodeBlock>
                          <CodeBlockCode>{rule?.query}</CodeBlockCode>
                        </CodeBlock>
                      </Link>
                    ) : (
                      <CodeBlock>
                        <CodeBlockCode>{rule?.query}</CodeBlockCode>
                      </CodeBlock>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-xs-12">
                <dl className="co-m-pane__details">
                  <dt>{t('Labels')}</dt>
                  <dd>
                    <Labels kind="alertrule" labels={rule?.labels} />
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="co-m-pane__body">
          <div className="co-m-pane__body-group">
            <Toolbar className="monitoring-alert-detail-toolbar">
              <ToolbarContent>
                <ToolbarItem variant="label">
                  <SectionHeading text={t('Active alerts')} />
                </ToolbarItem>
                <ToolbarGroup align={{ default: 'alignRight' }}>
                  <ToolbarItem>
                    <ToggleGraph />
                  </ToolbarItem>
                </ToolbarGroup>
              </ToolbarContent>
            </Toolbar>
            <div className="row">
              <div className="col-sm-12">
                {!sourceId || sourceId === 'prometheus' ? (
                  <Graph
                    formatSeriesTitle={formatSeriesTitle}
                    namespace={namespace}
                    query={rule?.query}
                    ruleDuration={rule?.duration}
                    showLegend
                  />
                ) : AlertChart ? (
                  <AlertChart rule={rule} />
                ) : null}
              </div>
            </div>
            <div className="row">
              <div className="col-xs-12">
                {_.isEmpty(rule?.alerts) ? (
                  <div className="pf-u-text-align-center">{t('None found')}</div>
                ) : (
                  <ActiveAlerts alerts={rule.alerts} ruleID={rule?.id} namespace={namespace} />
                )}
              </div>
            </div>
          </div>
        </div>
      </StatusBox>
    </>
  );
};
export const AlertRulesDetailsPage = withFallback(AlertRulesDetailsPage_);

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
  'pf-u-w-50 pf-u-w-33-on-sm', // Name
  'pf-m-hidden pf-m-visible-on-sm', // Severity
  '', // Alert state
  'pf-m-hidden pf-m-visible-on-sm', // Source
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
    getObserveState(perspective, state)?.get(rulesKey),
  );
  const { loaded = false, loadError }: Alerts = useSelector(
    (state: MonitoringState) => getObserveState(perspective, state)?.get(alertsKey) || {},
  );
  const silencesLoadError = useSelector(
    (state: MonitoringState) => getObserveState(perspective, state)?.get(silencesKey)?.loadError,
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
const incidentsPageWithFallback = withFallback(IncidentsPage);
const AlertingPage: React.FC<RouteComponentProps<{ url: string }>> = ({ match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const alertsPath = getAlertsUrl(perspective);
  const rulesPath = getAlertRulesUrl(perspective);
  const silencesPath = getSilencesUrl(perspective);
  const incidentsPath = '/monitoring/incidents';

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
        <Tab active={url === incidentsPath}>
          <Link to={incidentsPath}>{t('Incidents')}</Link>
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
        <Route path={incidentsPath} exact component={incidentsPageWithFallback} />
      </Switch>
    </>
  );
};

const PollerPages = () => {
  const dispatch = useDispatch();

  const { alertingContextId, perspective } = usePerspective();
  const namespace = useActiveNamespace();

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
        <Route path="/dev-monitoring/ns/:ns/alerts/:ruleID" component={AlertsDetailsPage} />
        <Route path="/dev-monitoring/ns/:ns/metrics" exact component={QueryBrowserPage} />
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
      <Route path="/monitoring/dashboards/:board?" exact component={MonitoringDashboardsPage} />
      <Route path="/monitoring/graph" exact component={PrometheusUIRedirect} />
      <Route path="/monitoring/query-browser" exact component={QueryBrowserPage} />
      <Route path="/monitoring/silences/~new" exact component={CreateSilence} />
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
