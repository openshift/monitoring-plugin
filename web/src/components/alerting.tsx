import {
  Alert,
  AlertSeverity,
  AlertStates,
  consoleFetchJSON,
  ListPageFilter,
  PrometheusAlert,
  RowFilter,
  RowProps,
  Rule,
  Silence,
  SilenceStates,
  TableColumn,
  Timestamp,
  useListPageFilter,
  useResolvedExtensions,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert as PFAlert,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Checkbox,
  CodeBlock,
  CodeBlockCode,
  Flex,
  FlexItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import {
  DropdownItem as DropdownItemDeprecated,
  DropdownToggle as DropdownToggleDeprecated,
} from '@patternfly/react-core/deprecated';
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
import { EmptyBox, LoadingInline, StatusBox } from './console/utils/status-box';

import MonitoringDashboardsPage from './dashboards';
import { useBoolean } from './hooks/useBoolean';
import KebabDropdown from './kebab-dropdown';
import { Labels } from './labels';
import { QueryBrowserPage, ToggleGraph } from './metrics';
import { CreateSilence, EditSilence } from './silence-form';
import { TargetsUI } from './targets';
import { Alerts, AlertSource, RootState, Silences } from './types';
import {
  alertDescription,
  alertingRuleStateOrder,
  alertSeverityOrder,
  alertURL,
  fuzzyCaseInsensitive,
  labelsToParams,
  refreshSilences,
  RuleResource,
  SilenceResource,
  silenceState,
} from './utils';

import './_monitoring.scss';
import { usePerspective } from './hooks/usePerspective';
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
  queryBrowserURL,
  ruleURL,
  Severity,
  SeverityBadge,
  SeverityCounts,
  SeverityHelp,
  SilencesNotLoadedWarning,
  SourceHelp,
} from './alerting/AlertUtils';
import AlertsPage from './alerting/AlertsPage';
import AlertsDetailsPage from './alerting/AlertsDetailPage';
import {
  SelectedSilencesContext,
  SilenceDropdown,
  SilenceMatchersList,
  SilenceState,
  SilenceTableRow,
  tableSilenceClasses,
  newSilenceAlertURL,
} from './alerting/SilencesUtils';
import { OnToggle } from './alerting/AlertUtils';
import { useRulesAlertsPoller } from './hooks/useRulesAlertsPoller';
import { useSilencesPoller } from './hooks/useSilencesPoller';

const StateCounts: React.FC<{ alerts: PrometheusAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

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

const SilenceTableRowWithCheckbox: React.FC<RowProps<Silence>> = ({ obj }) => (
  <SilenceTableRow showCheckbox={true} obj={obj} />
);

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
  const { t } = useTranslation('plugin__monitoring-plugin');

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
                to={
                  namespace
                    ? `/dev-monitoring/ns/${namespace}/alerts/${ruleID}?${labelsToParams(a.labels)}`
                    : alertURL(a, ruleID)
                }
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
                      onClick={() => history.push(newSilenceAlertURL(a))}
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
  const { t } = useTranslation('plugin__monitoring-plugin');

  const { rulesKey, alertsKey } = usePerspective();
  const namespace = match.params?.ns;

  const rules: Rule[] = useSelector(({ observe }: RootState) => observe.get(rulesKey));
  const rule = _.find(rules, { id: _.get(match, 'params.id') });

  const { loaded, loadError }: Alerts = useSelector(
    ({ observe }: RootState) => observe.get(alertsKey) || {},
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
              <Link
                className="pf-c-breadcrumb__link"
                to={namespace ? `/dev-monitoring/ns/${namespace}/alerts` : '/monitoring/alertrules'}
              >
                {namespace ? t('Alerts') : t('Alerting rules')}
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
                      <Link to={queryBrowserURL(rule?.query, namespace)}>
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

const ActionsToggle: React.FC<{ onToggle: OnToggle }> = ({ onToggle, ...props }) => (
  <DropdownToggleDeprecated
    data-test="silence-actions-toggle"
    onToggle={(event, isOpen) => onToggle(isOpen, event as MouseEvent)}
    {...props}
  >
    Actions
  </DropdownToggleDeprecated>
);

const SilenceDropdownActions: React.FC<{ silence: Silence }> = ({ silence }) => (
  <SilenceDropdown className="co-actions-menu" silence={silence} Toggle={ActionsToggle} />
);

type SilencedAlertsListProps = RouteComponentProps & { alerts: Alert[] };

const SilencedAlertsList_: React.FC<SilencedAlertsListProps> = ({ alerts, history }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return _.isEmpty(alerts) ? (
    <div className="pf-u-text-align-center">{t('None found')}</div>
  ) : (
    <div className="co-m-table-grid co-m-table-grid--bordered">
      <div className="row co-m-table-grid__head">
        <div className="col-xs-9">{t('Name')}</div>
        <div className="col-xs-3">{t('Severity')}</div>
      </div>
      <div className="co-m-table-grid__body">
        {_.sortBy<Alert>(alerts, alertDescription).map((a, i) => (
          <div className="row co-resource-list__item" key={i}>
            <div className="col-xs-9">
              <Link
                className="co-resource-item"
                data-test="firing-alerts"
                to={alertURL(a, a.rule.id)}
              >
                {a.labels.alertname}
              </Link>
              <div className="monitoring-description">{alertDescription(a)}</div>
            </div>
            <div className="col-xs-3">
              <Severity severity={a.labels.severity} />
            </div>
            <div className="dropdown-kebab-pf">
              <KebabDropdown
                dropdownItems={[
                  <DropdownItemDeprecated
                    key="view-rule"
                    onClick={() => history.push(ruleURL(a.rule))}
                  >
                    {t('View alerting rule')}
                  </DropdownItemDeprecated>,
                ]}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
const SilencedAlertsList = withRouter(SilencedAlertsList_);

const SilencesDetailsPage_: React.FC<RouteComponentProps<{ id: string }>> = ({ match }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const namespace = useActiveNamespace();
  const { isDev, alertsKey } = usePerspective();
  useSilencesPoller({ namespace });

  const alertsLoaded = useSelector(({ observe }: RootState) => observe.get(alertsKey)?.loaded);

  const silences: Silences = useSelector(({ observe }: RootState) => observe.get('silences'));
  const silence = _.find(silences?.data, { id: _.get(match, 'params.id') });

  return (
    <>
      <Helmet>
        <title>{t('{{name}} details', { name: silence?.name || SilenceResource.label })}</title>
      </Helmet>
      <StatusBox
        data={silence}
        label={SilenceResource.label}
        loaded={silences?.loaded}
        loadError={silences?.loadError}
      >
        <div className="pf-c-page__main-breadcrumb">
          <Breadcrumb className="monitoring-breadcrumbs">
            <BreadcrumbItem>
              <Link
                className="pf-c-breadcrumb__link"
                to={isDev ? `/dev-monitoring/ns/${namespace}/alerts` : '/monitoring/silences'}
              >
                {isDev ? t('Alerts') : t('Silences')}
              </Link>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{t('Silence details')}</BreadcrumbItem>
          </Breadcrumb>
        </div>
        <div className="co-m-nav-title co-m-nav-title--detail co-m-nav-title--breadcrumbs">
          <h1 className="co-m-pane__heading">
            <div data-test="resource-title" className="co-resource-item">
              <MonitoringResourceIcon
                className="co-m-resource-icon--lg"
                resource={SilenceResource}
              />
              {silence?.name}
            </div>
            <div className="co-actions" data-test-id="details-actions">
              {silence && <SilenceDropdownActions silence={silence} />}
            </div>
          </h1>
        </div>
        <div className="co-m-pane__body">
          <SectionHeading text={t('Silence details')} />
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  {silence?.name && (
                    <>
                      <dt>{t('Name')}</dt>
                      <dd>{silence?.name}</dd>
                    </>
                  )}
                  <dt>{t('Matchers')}</dt>
                  <dd data-test="label-list">
                    {_.isEmpty(silence?.matchers) ? (
                      <div className="text-muted">{t('No matchers')}</div>
                    ) : (
                      <SilenceMatchersList silence={silence} />
                    )}
                  </dd>
                  <dt>{t('State')}</dt>
                  <dd>
                    <SilenceState silence={silence} />
                  </dd>
                  <dt>{t('Last updated at')}</dt>
                  <dd>
                    <Timestamp timestamp={silence?.updatedAt} />
                  </dd>
                </dl>
              </div>
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>{t('Starts at')}</dt>
                  <dd>
                    <Timestamp timestamp={silence?.startsAt} />
                  </dd>
                  <dt>{t('Ends at')}</dt>
                  <dd>
                    <Timestamp timestamp={silence?.endsAt} />
                  </dd>
                  <dt>{t('Created by')}</dt>
                  <dd>{silence?.createdBy || '-'}</dd>
                  <dt>{t('Comment')}</dt>
                  <dd>{silence?.comment || '-'}</dd>
                  <dt>{t('Firing alerts')}</dt>
                  <dd>
                    {alertsLoaded ? (
                      <SeverityCounts alerts={silence?.firingAlerts} />
                    ) : (
                      <LoadingInline />
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="co-m-pane__body">
          <div className="co-m-pane__body-group">
            <SectionHeading text={t('Firing alerts')} />
            <div className="row">
              <div className="col-xs-12">
                {alertsLoaded ? (
                  <SilencedAlertsList alerts={silence?.firingAlerts} />
                ) : (
                  <LoadingInline />
                )}
              </div>
            </div>
          </div>
        </div>
      </StatusBox>
    </>
  );
};
const SilencesDetailsPage = withFallback(SilencesDetailsPage_);

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
  const { t } = useTranslation('plugin__monitoring-plugin');

  const title: string = obj.annotations?.description || obj.annotations?.message;

  return (
    <>
      <td className={tableRuleClasses[0]} title={title}>
        <div className="co-resource-item">
          <MonitoringResourceIcon resource={RuleResource} />
          <Link to={ruleURL(obj)} className="co-resource-item__resource-name">
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
  const { t } = useTranslation('plugin__monitoring-plugin');

  const data: Rule[] = useSelector(({ observe }: RootState) => observe.get('rules'));
  const { loaded = false, loadError }: Alerts = useSelector(
    ({ observe }: RootState) => observe.get('alerts') || {},
  );
  const silencesLoadError = useSelector(
    ({ observe }: RootState) => observe.get('silences')?.loadError,
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
      defaultSelected: [AlertSource.Platform],
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

const CreateSilenceButton: React.FC = React.memo(() => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <Link className="co-m-primary-action" to="/monitoring/silences/~new">
      <Button data-test="create-silence-btn" variant="primary">
        {t('Create silence')}
      </Button>
    </Link>
  );
});

type ExpireAllSilencesButtonProps = {
  setErrorMessage: (string) => void;
};

const ExpireAllSilencesButton: React.FC<ExpireAllSilencesButtonProps> = ({ setErrorMessage }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const { perspective } = usePerspective();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);

  const dispatch = useDispatch();

  const { selectedSilences, setSelectedSilences } = React.useContext(SelectedSilencesContext);

  const onClick = () => {
    setInProgress();
    Promise.allSettled(
      [...selectedSilences].map((silenceID) =>
        consoleFetchJSON.delete(
          `${window.SERVER_FLAGS.alertManagerBaseURL}/api/v2/silence/${silenceID}`,
        ),
      ),
    ).then((values) => {
      setNotInProgress();
      setSelectedSilences(new Set());
      refreshSilences(dispatch, perspective);
      const errors = values
        .filter((v) => v.status === 'rejected')
        .map((v: PromiseRejectedResult) => v.reason);
      if (errors.length > 0) {
        const messages = errors.map(
          (err) => _.get(err, 'json.error') || err.message || 'Error expiring silence',
        );
        setErrorMessage(messages.join(', '));
      }
    });
  };

  return (
    <Button
      isDisabled={selectedSilences.size === 0}
      isLoading={isInProgress}
      onClick={onClick}
      variant="secondary"
    >
      {t('Expire {{count}} silence', { count: selectedSilences.size })}
    </Button>
  );
};

const silenceFiringAlertsOrder = (silence: Silence) => {
  const counts = _.countBy(silence.firingAlerts, 'labels.severity');
  return [
    Number.MAX_SAFE_INTEGER - (counts[AlertSeverity.Critical] ?? 0),
    Number.MAX_SAFE_INTEGER - (counts[AlertSeverity.Warning] ?? 0),
    silence.firingAlerts.length,
  ];
};

const silenceStateOrder = (silence: Silence) => [
  [SilenceStates.Active, SilenceStates.Pending, SilenceStates.Expired].indexOf(
    silenceState(silence),
  ),
  _.get(silence, silenceState(silence) === SilenceStates.Pending ? 'startsAt' : 'endsAt'),
];

const SelectAllCheckbox: React.FC<{ silences: Silence[] }> = ({ silences }) => {
  const { selectedSilences, setSelectedSilences } = React.useContext(SelectedSilencesContext);

  const activeSilences = _.filter(silences, (s) => silenceState(s) !== SilenceStates.Expired);
  const isAllSelected =
    activeSilences.length > 0 && _.every(activeSilences, (s) => selectedSilences.has(s.id));

  const onChange = React.useCallback(
    (isChecked: boolean) => {
      const ids = isChecked ? activeSilences.map((s) => s.id) : [];
      setSelectedSilences(new Set(ids));
    },
    [activeSilences, setSelectedSilences],
  );

  return (
    <Checkbox
      id="select-all-silences-checkbox"
      isChecked={isAllSelected}
      isDisabled={activeSilences.length === 0}
      onChange={(_e, checked) => onChange(checked)}
    />
  );
};

const SilencesPage_: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const [selectedSilences, setSelectedSilences] = React.useState(new Set());
  const [errorMessage, setErrorMessage] = React.useState();

  const {
    data,
    loaded = false,
    loadError,
  }: Silences = useSelector(({ observe }: RootState) => observe.get('silences') || {});

  const rowFilters: RowFilter[] = [
    // TODO: The "name" filter doesn't really fit useListPageFilter's idea of a RowFilter, but
    //       useListPageFilter doesn't yet provide a better way to add a filter like this
    {
      filter: (filter, silence: Silence) =>
        fuzzyCaseInsensitive(filter.selected?.[0], silence.name),
      filterGroupName: '',
      items: [],
      type: 'name',
    } as RowFilter,
    {
      defaultSelected: [SilenceStates.Active, SilenceStates.Pending],
      filter: (filter, silence: Silence) =>
        filter.selected?.includes(silenceState(silence)) || _.isEmpty(filter.selected),
      filterGroupName: t('Silence State'),
      items: [
        { id: SilenceStates.Active, title: t('Active') },
        { id: SilenceStates.Pending, title: t('Pending') },
        { id: SilenceStates.Expired, title: t('Expired') },
      ],
      reducer: silenceState,
      type: 'silence-state',
    },
  ];

  const [staticData, filteredData, onFilterChange] = useListPageFilter(data, rowFilters);

  const columns = React.useMemo<TableColumn<Silence>[]>(
    () => [
      {
        id: 'checkbox',
        props: { className: tableSilenceClasses[0] },
        title: (<SelectAllCheckbox silences={filteredData} />) as any,
      },
      {
        id: 'name',
        props: { className: tableSilenceClasses[1] },
        sort: 'name',
        title: t('Name'),
        transforms: [sortable],
      },
      {
        id: 'firingAlerts',
        props: { className: tableSilenceClasses[2] },
        sort: (silences: Silence[], direction: 'asc' | 'desc') =>
          _.orderBy(silences, silenceFiringAlertsOrder, [direction]),
        title: t('Firing alerts'),
        transforms: [sortable],
      },
      {
        id: 'state',
        props: { className: tableSilenceClasses[3] },
        sort: (silences: Silence[], direction: 'asc' | 'desc') =>
          _.orderBy(silences, silenceStateOrder, [direction]),
        title: t('State'),
        transforms: [sortable],
      },
      {
        id: 'createdBy',
        props: { className: tableSilenceClasses[4] },
        sort: 'createdBy',
        title: t('Creator'),
        transforms: [sortable],
      },
      {
        id: 'actions',
        props: { className: tableSilenceClasses[5] },
        title: '',
      },
    ],
    [filteredData, t],
  );

  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
      <div className="co-m-pane__body">
        <SelectedSilencesContext.Provider value={{ selectedSilences, setSelectedSilences }}>
          <Flex>
            <FlexItem>
              <ListPageFilter
                data={staticData}
                hideLabelFilter
                loaded={loaded}
                onFilterChange={onFilterChange}
                rowFilters={rowFilters}
              />
            </FlexItem>
            <FlexItem>
              <CreateSilenceButton />
            </FlexItem>
            <FlexItem>
              <ExpireAllSilencesButton setErrorMessage={setErrorMessage} />
            </FlexItem>
          </Flex>
          {loadError && (
            <PFAlert
              className="co-alert"
              isInline
              title={t(
                'Error loading silences from Alertmanager. Alertmanager may be unavailable.',
              )}
              variant="danger"
            >
              {typeof loadError === 'string' ? loadError : loadError.message}
            </PFAlert>
          )}
          {errorMessage && (
            <PFAlert className="co-alert" isInline title={t('Error')} variant="danger">
              {errorMessage}
            </PFAlert>
          )}
          <div className="row">
            <div className="col-xs-12">
              <VirtualizedTable<Silence>
                aria-label={t('Silences')}
                label={t('Silences')}
                columns={columns}
                data={filteredData ?? []}
                loaded={loaded}
                loadError={loadError}
                Row={SilenceTableRowWithCheckbox}
                unfilteredData={data}
                NoDataEmptyMsg={() => {
                  return <EmptyBox label={t('Silences')} />;
                }}
              />
            </div>
          </div>
        </SelectedSilencesContext.Provider>
      </div>
    </>
  );
};
const SilencesPage = withFallback(SilencesPage_);

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
  const { t } = useTranslation('plugin__monitoring-plugin');

  const alertsPath = '/monitoring/alerts';
  const rulesPath = '/monitoring/alertrules';
  const silencesPath = '/monitoring/silences';

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

  const { isDev } = usePerspective();
  const namespace = useActiveNamespace();

  const [customExtensions] =
    useResolvedExtensions<AlertingRulesSourceExtension>(isAlertingRulesSource);

  const alertsSource = React.useMemo(
    () =>
      customExtensions
        .filter(
          (extension) =>
            extension.properties.contextId ===
            (isDev ? 'dev-observe-alerting' : 'observe-alerting'),
        )
        .map((extension) => extension.properties),
    [customExtensions, isDev],
  );

  useRulesAlertsPoller(namespace, dispatch, alertsSource);

  if (isDev) {
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
      <Route path="/monitoring/(alerts|alertrules|silences)" exact component={AlertingPage} />
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
  return <Redirect to={`/monitoring/query-browser?query0=${params['g0.expr'] || ''}`} />;
};

const MonitoringUI = () => (
  <Switch>
    {/* This redirect also handles the `/monitoring/#/alerts?...` link URLs generated by
    Alertmanager (because the `#` is considered the end of the URL) */}
    <Redirect from="/monitoring" exact to="/monitoring/alerts" />
    <Route path="/monitoring/dashboards/:board?" exact component={MonitoringDashboardsPage} />
    <Route path="/monitoring/graph" exact component={PrometheusUIRedirect} />
    <Route path="/monitoring/query-browser" exact component={QueryBrowserPage} />
    <Route path="/monitoring/silences/~new" exact component={CreateSilence} />
    <Route path="/monitoring/targets" component={TargetsUI} />
    <Route component={PollerPages} />
  </Switch>
);

export default MonitoringUI;
