import {
  Action,
  ActionServiceProvider,
  Alert,
  AlertSeverity,
  AlertStates,
  BlueInfoCircleIcon,
  consoleFetchJSON,
  GreenCheckCircleIcon,
  ListPageFilter,
  PrometheusAlert,
  PrometheusEndpoint,
  PrometheusLabels,
  RedExclamationCircleIcon,
  ResourceLink,
  ResourceStatus,
  RowFilter,
  RowProps,
  Rule,
  Silence,
  SilenceStates,
  TableColumn,
  Timestamp,
  useActivePerspective,
  useListPageFilter,
  useResolvedExtensions,
  VirtualizedTable,
  YellowExclamationTriangleIcon,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert as PFAlert,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Checkbox,
  CodeBlock,
  CodeBlockCode,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Flex,
  FlexItem,
  KebabToggle,
  Label,
  Modal,
  ModalVariant,
  Popover,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import {
  BanIcon,
  BellIcon,
  BellSlashIcon,
  HourglassHalfIcon,
  OutlinedBellIcon,
} from '@patternfly/react-icons';
import { sortable } from '@patternfly/react-table';
import classNames from 'classnames';
import { TFunction } from 'i18next';
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
import { getPrometheusURL } from './console/graphs/helpers';
import {
  ContainerModel,
  DaemonSetModel,
  DeploymentModel,
  JobModel,
  NamespaceModel,
  NodeModel,
  PodModel,
  StatefulSetModel,
} from './console/models';
import { SectionHeading } from './console/utils/headings';
import { ExternalLink, LinkifyExternal } from './console/utils/link';
import { getAllQueryArguments } from './console/utils/router';
import { LoadingInline, StatusBox } from './console/utils/status-box';

import {
  alertingErrored,
  alertingLoaded,
  alertingLoading,
  alertingSetRules,
} from '../actions/observe';
import MonitoringDashboardsPage from './dashboards';
import { fetchAlerts } from './fetch-alerts';
import { useBoolean } from './hooks/useBoolean';
import KebabDropdown from './kebab-dropdown';
import { Labels } from './labels';
import { QueryBrowserPage, ToggleGraph } from './metrics';
import { FormatSeriesTitle, QueryBrowser } from './query-browser';
import { CreateSilence, EditSilence } from './silence-form';
import { TargetsUI } from './targets';
import { Alerts, AlertSource, MonitoringResource, RootState, Silences } from './types';
import {
  alertDescription,
  alertingRuleStateOrder,
  AlertResource,
  alertSeverityOrder,
  alertState,
  alertURL,
  fuzzyCaseInsensitive,
  getAlertsAndRules,
  labelsToParams,
  refreshSilences,
  RuleResource,
  silenceMatcherEqualitySymbol,
  SilenceResource,
  silenceState,
} from './utils';

import './_monitoring.scss';

const SelectedSilencesContext = React.createContext({
  selectedSilences: new Set(),
  setSelectedSilences: undefined,
});

const ruleURL = (rule: Rule) => `${RuleResource.plural}/${_.get(rule, 'id')}`;

const alertingRuleSource = (rule: Rule): AlertSource | string => {
  if (rule.sourceId === undefined || rule.sourceId === 'prometheus') {
    return rule.labels?.prometheus === 'openshift-monitoring/k8s'
      ? AlertSource.Platform
      : AlertSource.User;
  }

  return rule.sourceId;
};

const alertSource = (alert: Alert): AlertSource | string => alertingRuleSource(alert.rule);

const pollers = {};
const pollerTimeouts = {};

const silenceAlertURL = (alert: Alert) =>
  `${SilenceResource.plural}/~new?${labelsToParams(alert.labels)}`;

const MonitoringResourceIcon: React.FC<MonitoringResourceIconProps> = ({ className, resource }) => (
  <span
    className={classNames(
      `co-m-resource-icon co-m-resource-${resource.kind.toLowerCase()}`,
      className,
    )}
    title={resource.label}
  >
    {resource.abbr}
  </span>
);

const AlertStateIcon: React.FC<{ state: string }> = React.memo(({ state }) => {
  switch (state) {
    case AlertStates.Firing:
      return <BellIcon />;
    case AlertStates.Pending:
      return <OutlinedBellIcon />;
    case AlertStates.Silenced:
      return <BellSlashIcon className="text-muted" />;
    default:
      return null;
  }
});

const getAlertStateKey = (state, t) => {
  switch (state) {
    case AlertStates.Firing:
      return t('Firing');
    case AlertStates.Pending:
      return t('Pending');
    case AlertStates.Silenced:
      return t('Silenced');
    default:
      return t('Not Firing');
  }
};

export const AlertState: React.FC<AlertStateProps> = React.memo(({ state }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const icon = <AlertStateIcon state={state} />;

  return icon ? (
    <>
      {icon} {getAlertStateKey(state, t)}
    </>
  ) : null;
});

const SilenceState = ({ silence }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const state = silenceState(silence);
  const icon = {
    [SilenceStates.Active]: <GreenCheckCircleIcon />,
    [SilenceStates.Pending]: <HourglassHalfIcon className="monitoring-state-icon--pending" />,
    [SilenceStates.Expired]: <BanIcon className="text-muted" data-test-id="ban-icon" />,
  }[state];

  const getStateKey = (stateData) => {
    switch (stateData) {
      case SilenceStates.Active:
        return t('Active');
      case SilenceStates.Pending:
        return t('Pending');
      default:
        return t('Expired');
    }
  };

  return icon ? (
    <>
      {icon} {getStateKey(state)}
    </>
  ) : null;
};

export const StateTimestamp = ({ text, timestamp }) => (
  <div className="text-muted monitoring-timestamp">
    {text}&nbsp;
    <Timestamp timestamp={timestamp} />
  </div>
);

const AlertStateDescription: React.FC<{ alert }> = ({ alert }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  if (alert && !_.isEmpty(alert.silencedBy)) {
    return <StateTimestamp text={t('Ends')} timestamp={_.max(_.map(alert.silencedBy, 'endsAt'))} />;
  }
  if (alert && alert.activeAt) {
    return <StateTimestamp text={t('Since')} timestamp={alert.activeAt} />;
  }
  return null;
};

const SeverityIcon: React.FC<{ severity: string }> = React.memo(({ severity }) => {
  const Icon =
    {
      [AlertSeverity.Critical]: RedExclamationCircleIcon,
      [AlertSeverity.Info]: BlueInfoCircleIcon,
      [AlertSeverity.None]: BlueInfoCircleIcon,
      [AlertSeverity.Warning]: YellowExclamationTriangleIcon,
    }[severity] || YellowExclamationTriangleIcon;
  return <Icon />;
});

export const Severity: React.FC<{ severity: string }> = React.memo(({ severity }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const getSeverityKey = (severityData: string) => {
    switch (severityData) {
      case AlertSeverity.Critical:
        return t('Critical');
      case AlertSeverity.Info:
        return t('Info');
      case AlertSeverity.Warning:
        return t('Warning');
      case AlertSeverity.None:
        return t('None');
      default:
        return severityData;
    }
  };

  return _.isNil(severity) ? (
    <>-</>
  ) : (
    <>
      <SeverityIcon severity={severity} /> {getSeverityKey(severity)}
    </>
  );
});

const SeverityBadge: React.FC<{ severity: string }> = React.memo(({ severity }) =>
  _.isNil(severity) || severity === 'none' ? null : (
    <ResourceStatus>
      <Severity severity={severity} />
    </ResourceStatus>
  ),
);

const SeverityCounts: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  if (_.isEmpty(alerts)) {
    return <>-</>;
  }

  const counts = _.countBy(alerts, (a) => {
    const { severity } = a.labels;
    return severity === AlertSeverity.Critical || severity === AlertSeverity.Warning
      ? severity
      : AlertSeverity.Info;
  });

  const severities = [AlertSeverity.Critical, AlertSeverity.Warning, AlertSeverity.Info].filter(
    (s) => counts[s] > 0,
  );

  return (
    <>
      {severities.map((s) => (
        <span className="monitoring-icon-wrap" key={s}>
          <SeverityIcon severity={s} /> {counts[s]}
        </span>
      ))}
    </>
  );
};

export const StateCounts: React.FC<{ alerts: PrometheusAlert[] }> = ({ alerts }) => {
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

const PopoverField: React.FC<{ bodyContent: React.ReactNode; label: string }> = ({
  bodyContent,
  label,
}) => (
  <Popover headerContent={label} bodyContent={bodyContent}>
    <Button variant="plain" className="details-item__popover-button">
      {label}
    </Button>
  </Popover>
);

const AlertStateHelp: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <dl className="co-inline">
      <dt>
        <AlertStateIcon state={AlertStates.Pending} /> <strong>{t('Pending: ')}</strong>
      </dt>
      <dd>
        {t(
          'The alert is active but is waiting for the duration that is specified in the alerting rule before it fires.',
        )}
      </dd>
      <dt>
        <AlertStateIcon state={AlertStates.Firing} /> <strong>{t('Firing: ')}</strong>
      </dt>
      <dd>
        {t(
          'The alert is firing because the alert condition is true and the optional `for` duration has passed. The alert will continue to fire as long as the condition remains true.',
        )}
      </dd>
      <dt>
        <AlertStateIcon state={AlertStates.Silenced} /> <strong>{t('Silenced: ')}</strong>
      </dt>
      <dt></dt>
      <dd>
        {t(
          'The alert is now silenced for a defined time period. Silences temporarily mute alerts based on a set of label selectors that you define. Notifications will not be sent for alerts that match all the listed values or regular expressions.',
        )}
      </dd>
    </dl>
  );
};

const SeverityHelp: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <dl className="co-inline">
      <dt>
        <SeverityIcon severity={AlertSeverity.Critical} /> <strong>{t('Critical: ')}</strong>
      </dt>
      <dd>
        {t(
          'The condition that triggered the alert could have a critical impact. The alert requires immediate attention when fired and is typically paged to an individual or to a critical response team.',
        )}
      </dd>
      <dt>
        <SeverityIcon severity={AlertSeverity.Warning} /> <strong>{t('Warning: ')}</strong>
      </dt>
      <dd>
        {t(
          'The alert provides a warning notification about something that might require attention in order to prevent a problem from occurring. Warnings are typically routed to a ticketing system for non-immediate review.',
        )}
      </dd>
      <dt>
        <SeverityIcon severity={AlertSeverity.Info} /> <strong>{t('Info: ')}</strong>
      </dt>
      <dd>{t('The alert is provided for informational purposes only.')}</dd>
      <dt>
        <SeverityIcon severity={AlertSeverity.None} /> <strong>{t('None: ')}</strong>
      </dt>
      <dd>{t('The alert has no defined severity.')}</dd>
      <dd>{t('You can also create custom severity definitions for user workload alerts.')}</dd>
    </dl>
  );
};

const SourceHelp: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <dl className="co-inline">
      <dt>
        <strong>{t('Platform: ')}</strong>
      </dt>
      <dd>
        {t(
          'Platform-level alerts relate only to OpenShift namespaces. OpenShift namespaces provide core OpenShift functionality.',
        )}
      </dd>
      <dt>
        <strong>{t('User: ')}</strong>
      </dt>
      <dd>
        {t(
          'User workload alerts relate to user-defined namespaces. These alerts are user-created and are customizable. User workload monitoring can be enabled post-installation to provide observability into your own services.',
        )}
      </dd>
    </dl>
  );
};

type ActionWithHref = Omit<Action, 'cta'> & { cta: { href: string; external?: boolean } };

const isActionWithHref = (action: Action): action is ActionWithHref => 'href' in action.cta;

const queryBrowserURL = (query: string, namespace: string) =>
  namespace
    ? `/dev-monitoring/ns/${namespace}/metrics?query0=${encodeURIComponent(query)}`
    : `/monitoring/query-browser?query0=${encodeURIComponent(query)}`;

const Graph: React.FC<GraphProps> = ({
  filterLabels = undefined,
  formatSeriesTitle,
  namespace,
  query,
  ruleDuration,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  // 3 times the rule's duration, but not less than 30 minutes
  const timespan = Math.max(3 * ruleDuration, 30 * 60) * 1000;

  const GraphLink = () =>
    query ? (
      <Link aria-label={t('View in Metrics')} to={queryBrowserURL(query, namespace)}>
        {t('View in Metrics')}
      </Link>
    ) : null;

  return (
    <QueryBrowser
      namespace={namespace}
      defaultTimespan={timespan}
      filterLabels={filterLabels}
      formatSeriesTitle={formatSeriesTitle}
      GraphLink={GraphLink}
      pollInterval={Math.round(timespan / 120)}
      queries={[query]}
    />
  );
};

const tableSilenceClasses = [
  'pf-c-table__action', // Checkbox
  'pf-u-w-50 pf-u-w-33-on-sm', // Name
  'pf-m-hidden pf-m-visible-on-sm', // Firing alerts
  '', // State
  'pf-m-hidden pf-m-visible-on-sm', // Creator
  'dropdown-kebab-pf pf-c-table__action',
];

const SilenceMatchersList = ({ silence }) => (
  <div className={`co-text-${SilenceResource.kind.toLowerCase()}`}>
    {_.map(silence.matchers, ({ name, isEqual, isRegex, value }, i) => (
      <Label className="co-label" key={i}>
        <span className="co-label__key">{name}</span>
        <span className="co-label__eq">{silenceMatcherEqualitySymbol(isEqual, isRegex)}</span>
        <span className="co-label__value">{value}</span>
      </Label>
    ))}
  </div>
);

type SilenceTableRowProps = {
  obj: Silence;
  showCheckbox?: boolean;
};

const SilenceTableRow: React.FC<SilenceTableRowProps> = ({ obj, showCheckbox }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const { createdBy, endsAt, firingAlerts, id, name, startsAt } = obj;
  const state = silenceState(obj);

  const { selectedSilences, setSelectedSilences } = React.useContext(SelectedSilencesContext);

  const onCheckboxChange = React.useCallback(
    (isChecked: boolean) => {
      setSelectedSilences((oldSet) => {
        const newSet = new Set(oldSet);
        if (isChecked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return newSet;
      });
    },
    [id, setSelectedSilences],
  );

  return (
    <>
      {showCheckbox && (
        <td className={tableSilenceClasses[0]}>
          <Checkbox
            id={id}
            isChecked={selectedSilences.has(id)}
            isDisabled={state === SilenceStates.Expired}
            onChange={onCheckboxChange}
          />
        </td>
      )}
      <td className={tableSilenceClasses[1]}>
        <div className="co-resource-item">
          <MonitoringResourceIcon resource={SilenceResource} />
          <Link
            className="co-resource-item__resource-name"
            data-test-id="silence-resource-link"
            title={id}
            to={`${SilenceResource.plural}/${id}`}
          >
            {name}
          </Link>
        </div>
        <div className="monitoring-label-list">
          <SilenceMatchersList silence={obj} />
        </div>
      </td>
      <td className={tableSilenceClasses[2]}>
        <SeverityCounts alerts={firingAlerts} />
      </td>
      <td className={classNames(tableSilenceClasses[3], 'co-break-word')}>
        <SilenceState silence={obj} />
        {state === SilenceStates.Pending && (
          <StateTimestamp text={t('Starts')} timestamp={startsAt} />
        )}
        {state === SilenceStates.Active && <StateTimestamp text={t('Ends')} timestamp={endsAt} />}
        {state === SilenceStates.Expired && (
          <StateTimestamp text={t('Expired')} timestamp={endsAt} />
        )}
      </td>
      <td className={tableSilenceClasses[4]}>{createdBy || '-'}</td>
      <td className={tableSilenceClasses[5]}>
        <SilenceDropdownKebab silence={obj} />
      </td>
    </>
  );
};

const SilenceTableRowWithCheckbox: React.FC<RowProps<Silence>> = ({ obj }) => (
  <SilenceTableRow showCheckbox={true} obj={obj} />
);

export const alertMessageResources: {
  [labelName: string]: { kind: string; namespaced?: boolean };
} = {
  container: ContainerModel,
  daemonset: DaemonSetModel,
  deployment: DeploymentModel,
  job: JobModel,
  namespace: NamespaceModel,
  node: NodeModel,
  pod: PodModel,
  statefulset: StatefulSetModel,
};

const matchCount = (haystack: string, regExpString: string) =>
  _.size(haystack.match(new RegExp(regExpString, 'g')));

const AlertMessage: React.FC<AlertMessageProps> = ({ alertText, labels, template }) => {
  if (_.isEmpty(alertText)) {
    return null;
  }

  let messageParts: React.ReactNode[] = [alertText];

  // Go through each recognized resource type and replace any resource names that exist in alertText
  // with a link to the resource's details page
  _.each(alertMessageResources, (model, label) => {
    const labelValue = labels[label];

    if (labelValue && !(model.namespaced && _.isEmpty(labels.namespace))) {
      const tagCount = matchCount(template, `\\{\\{ *\\$labels\\.${label} *\\}\\}`);
      const resourceNameCount = matchCount(alertText, _.escapeRegExp(labelValue));

      // Don't do the replacement unless the counts match. This avoids overwriting the wrong string
      // if labelValue happens to appear elsewhere in alertText
      if (tagCount > 0 && tagCount === resourceNameCount) {
        const link = (
          <ResourceLink
            className="co-resource-item--monitoring-alert"
            inline
            key={model.kind}
            kind={model.kind}
            name={labelValue}
            namespace={model.namespaced ? labels.namespace : undefined}
          />
        );
        messageParts = _.flatMap(messageParts, (part) => {
          if (_.isString(part) && part.indexOf(labelValue) !== -1) {
            // `part` contains at least one instance of the resource name, so replace each instance
            // with the link to the resource. Since the link is a component, we can't simply do a
            // string substitution. Instead, create an array that contains each of the string parts
            // and the resource links in the correct order.
            const splitParts = part.split(labelValue);
            return _.flatMap(splitParts, (p) => [p, link]).slice(0, -1);
          }
          return [part];
        });
      }
    }
  });

  return (
    <div className="co-alert-manager">
      <p>
        <LinkifyExternal>{messageParts}</LinkifyExternal>
      </p>
    </div>
  );
};

const HeaderAlertMessage: React.FC<{ alert: Alert; rule: Rule }> = ({ alert, rule }) => {
  const annotation = alert.annotations.description ? 'description' : 'message';
  return (
    <AlertMessage
      alertText={alert.annotations[annotation]}
      labels={alert.labels}
      template={rule.annotations[annotation]}
    />
  );
};

const getSourceKey = (source, t: TFunction) => {
  switch (source) {
    case 'Platform':
      return t('Platform');
    case 'User':
      return t('User');
    default:
      return source;
  }
};

const SilencedByList: React.FC<{ silences: Silence[] }> = ({ silences }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const columns = React.useMemo<TableColumn<Silence>[]>(
    () => [
      {
        id: 'name',
        props: { className: tableSilenceClasses[1] },
        title: t('Name'),
      },
      {
        id: 'firingAlerts',
        props: { className: tableSilenceClasses[2] },
        title: t('Firing alerts'),
      },
      {
        id: 'state',
        props: { className: tableSilenceClasses[3] },
        title: t('State'),
      },
      {
        id: 'createdBy',
        props: { className: tableSilenceClasses[4] },
        title: t('Creator'),
      },
      {
        id: 'actions',
        props: { className: tableSilenceClasses[5] },
        title: '',
      },
    ],
    [t],
  );

  return (
    <VirtualizedTable<Silence>
      aria-label={t('Silenced by')}
      columns={columns}
      data={silences}
      loaded={true}
      loadError={undefined}
      Row={SilenceTableRow}
      unfilteredData={silences}
    />
  );
};

type AlertsDetailsPageProps = RouteComponentProps<{ ns?: string; ruleID: string }>;

const AlertsDetailsPage_: React.FC<AlertsDetailsPageProps> = ({ history, match }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const isDevPerspective = _.has(match.params, 'ns');
  const namespace = match.params?.ns;
  const hideGraphs = useSelector(({ observe }: RootState) => !!observe.get('hideGraphs'));

  const alerts: Alerts = useSelector(({ observe }: RootState) =>
    observe.get(isDevPerspective ? 'devAlerts' : 'alerts'),
  );

  const silencesLoaded = ({ observe }) => observe.get('silences')?.loaded;

  const ruleAlerts = _.filter(alerts?.data, (a) => a.rule.id === match?.params?.ruleID);
  const rule = ruleAlerts?.[0]?.rule;
  const alert = _.find(ruleAlerts, (a) => _.isEqual(a.labels, getAllQueryArguments()));

  const state = alertState(alert);

  const labelsMemoKey = JSON.stringify(alert?.labels);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels: PrometheusLabels = React.useMemo(() => alert?.labels, [labelsMemoKey]);

  // eslint-disable-next-line camelcase
  const runbookURL = alert?.annotations?.runbook_url;

  const sourceId = rule?.sourceId;

  // Load alert metrics chart from plugin
  const [alertsChartExtensions] =
    useResolvedExtensions<AlertingRuleChartExtension>(isAlertingRuleChart);
  const alertsChart = alertsChartExtensions
    .filter((extension) => extension.properties.sourceId === sourceId)
    .map((extension) => extension.properties.chart);

  const AlertsChart = alertsChart?.[0];

  return (
    <>
      <StatusBox
        data={alert}
        label={AlertResource.label}
        loaded={alerts?.loaded}
        loadError={alerts?.loadError}
      >
        <div className="pf-c-page__main-breadcrumb">
          <Breadcrumb className="monitoring-breadcrumbs">
            <BreadcrumbItem>
              <Link
                className="pf-c-breadcrumb__link"
                to={namespace ? `/dev-monitoring/ns/${namespace}/alerts` : '/monitoring/alerts'}
              >
                {t('Alerts')}
              </Link>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{t('Alert details')}</BreadcrumbItem>
          </Breadcrumb>
        </div>
        <div className="co-m-nav-title co-m-nav-title--detail co-m-nav-title--breadcrumbs">
          <h1 className="co-m-pane__heading">
            <div data-test="resource-title" className="co-resource-item">
              <MonitoringResourceIcon className="co-m-resource-icon--lg" resource={AlertResource} />
              {labels?.alertname}
              <SeverityBadge severity={labels?.severity} />
            </div>
            {state !== AlertStates.Silenced && (
              <div data-test-id="details-actions">
                <Button
                  className="co-action-buttons__btn"
                  onClick={() => history.push(silenceAlertURL(alert))}
                  variant="primary"
                >
                  {t('Silence alert')}
                </Button>
              </div>
            )}
          </h1>
          <HeaderAlertMessage alert={alert} rule={rule} />
        </div>
        <div className="co-m-pane__body">
          <Toolbar className="monitoring-alert-detail-toolbar">
            <ToolbarContent>
              <ToolbarItem variant="label">
                <SectionHeading text={t('Alert details')} />
              </ToolbarItem>
              <ToolbarGroup alignment={{ default: 'alignRight' }}>
                <ActionServiceProvider context={{ 'alert-detail-toolbar-actions': { alert } }}>
                  {({ actions, loaded }) =>
                    loaded
                      ? actions.filter(isActionWithHref).map((action) => (
                          <ToolbarItem key={action.id}>
                            <Link to={action.cta.href}>{action.label}</Link>
                          </ToolbarItem>
                        ))
                      : null
                  }
                </ActionServiceProvider>
                <ToolbarItem>
                  <ToggleGraph />
                </ToolbarItem>
              </ToolbarGroup>
            </ToolbarContent>
          </Toolbar>

          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-sm-12">
                {!sourceId || sourceId === 'prometheus' ? (
                  <Graph
                    filterLabels={labels}
                    namespace={namespace}
                    query={rule?.query}
                    ruleDuration={rule?.duration}
                  />
                ) : AlertsChart && !hideGraphs ? (
                  <AlertsChart rule={rule} />
                ) : null}
              </div>
            </div>
            <div className="row">
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>{t('Name')}</dt>
                  <dd>{labels?.alertname}</dd>
                  <dt>
                    <PopoverField bodyContent={<SeverityHelp />} label={t('Severity')} />
                  </dt>
                  <dd>
                    <Severity severity={labels?.severity} />
                  </dd>
                  {alert?.annotations?.description && (
                    <>
                      <dt>{t('Description')}</dt>
                      <dd>
                        <AlertMessage
                          alertText={alert.annotations.description}
                          labels={labels}
                          template={rule?.annotations?.description}
                        />
                      </dd>
                    </>
                  )}
                  {alert?.annotations?.summary && (
                    <>
                      <dt>{t('Summary')}</dt>
                      <dd>{alert.annotations.summary}</dd>
                    </>
                  )}
                  {alert?.annotations?.message && (
                    <>
                      <dt>{t('Message')}</dt>
                      <dd>
                        <AlertMessage
                          alertText={alert.annotations.message}
                          labels={labels}
                          template={rule?.annotations?.message}
                        />
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
                  <dd>{alert && getSourceKey(_.startCase(alertSource(alert)), t)}</dd>
                  <dt>
                    <PopoverField bodyContent={<AlertStateHelp />} label={t('State')} />
                  </dt>
                  <dd>
                    <AlertState state={state} />
                    <AlertStateDescription alert={alert} />
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-xs-12">
                <dl className="co-m-pane__details" data-test="label-list">
                  <dt>{t('Labels')}</dt>
                  <dd>
                    <Labels kind="alert" labels={labels} />
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-xs-12">
                <dl className="co-m-pane__details">
                  <dt>{t('Alerting rule')}</dt>
                  <dd>
                    <div className="co-resource-item">
                      <MonitoringResourceIcon resource={RuleResource} />
                      <Link
                        to={
                          namespace
                            ? `/dev-monitoring/ns/${namespace}/rules/${rule?.id}`
                            : ruleURL(rule)
                        }
                        data-test="alert-rules-detail-resource-link"
                        className="co-resource-item__resource-name"
                      >
                        {_.get(rule, 'name')}
                      </Link>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        {silencesLoaded && !_.isEmpty(alert?.silencedBy) && (
          <div className="co-m-pane__body">
            <div className="co-m-pane__body-group">
              <SectionHeading text={t('Silenced by')} />
              <div className="row">
                <div className="col-xs-12">
                  <SilencedByList silences={alert?.silencedBy} />
                </div>
              </div>
            </div>
          </div>
        )}
      </StatusBox>
    </>
  );
};
export const AlertsDetailsPage = withFallback(withRouter(AlertsDetailsPage_));

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
  alerts: Alert[];
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
        {_.sortBy(alerts, alertDescription).map((a, i) => (
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
                    <DropdownItem
                      component="button"
                      key="silence"
                      onClick={() => history.push(silenceAlertURL(a))}
                    >
                      {t('Silence alert')}
                    </DropdownItem>,
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

  const isDevPerspective = _.has(match.params, 'ns');
  const namespace = match.params?.ns;

  const rules: Rule[] = useSelector(({ observe }: RootState) =>
    observe.get(isDevPerspective ? 'devRules' : 'rules'),
  );
  const rule = _.find(rules, { id: _.get(match, 'params.id') });

  const { loaded, loadError }: Alerts = useSelector(
    ({ observe }: RootState) => observe.get(isDevPerspective ? 'devAlerts' : 'alerts') || {},
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
                    <Link to={queryBrowserURL(rule?.query, namespace)}>
                      <CodeBlock>
                        <CodeBlockCode>{rule?.query}</CodeBlockCode>
                      </CodeBlock>
                    </Link>
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
                <ToolbarGroup alignment={{ default: 'alignRight' }}>
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

type ExpireSilenceModalProps = {
  isOpen: boolean;
  setClosed: () => void;
  silenceID: string;
};

const ExpireSilenceModal: React.FC<ExpireSilenceModalProps> = ({
  isOpen,
  setClosed,
  silenceID,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const dispatch = useDispatch();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);
  const [errorMessage, setErrorMessage] = React.useState();

  const expireSilence = () => {
    setInProgress();
    consoleFetchJSON
      .delete(`${window.SERVER_FLAGS.alertManagerBaseURL}/api/v2/silence/${silenceID}`)
      .then(() => {
        refreshSilences(dispatch);
        setClosed();
      })
      .catch((err) => {
        setErrorMessage(_.get(err, 'json.error') || err.message || 'Error expiring silence');
        setNotInProgress();
      })
      .then(setNotInProgress);
  };

  return (
    <Modal
      isOpen={isOpen}
      position="top"
      showClose={false}
      title={t('Expire silence')}
      variant={ModalVariant.small}
    >
      <Flex direction={{ default: 'column' }}>
        <FlexItem>{t('Are you sure you want to expire this silence?')}</FlexItem>
        <Flex direction={{ default: 'column' }}>
          <FlexItem>
            {errorMessage && (
              <PFAlert
                className="co-alert co-alert--scrollable"
                isInline
                title={t('An error occurred')}
                variant="danger"
              >
                <div className="co-pre-line">{errorMessage}</div>
              </PFAlert>
            )}
          </FlexItem>
          <Flex>
            <FlexItem>{isInProgress && <LoadingInline />}</FlexItem>
            <FlexItem align={{ default: 'alignRight' }}>
              <Button variant="secondary" onClick={setClosed}>
                {t('Cancel')}
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" onClick={expireSilence}>
                {t('Expire silence')}
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
};

type SilenceDropdownProps = RouteComponentProps & {
  className?: string;
  isPlain?: boolean;
  silence: Silence;
  Toggle: React.FC<{ onToggle: OnToggle }>;
};

const SilenceDropdown_: React.FC<SilenceDropdownProps> = ({
  className,
  history,
  isPlain,
  silence,
  Toggle,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const editSilence = () => {
    history.push(`${SilenceResource.plural}/${silence.id}/edit`);
  };

  const dropdownItems =
    silenceState(silence) === SilenceStates.Expired
      ? [
          <DropdownItem key="edit-silence" component="button" onClick={editSilence}>
            {t('Recreate silence')}
          </DropdownItem>,
        ]
      : [
          <DropdownItem key="edit-silence" component="button" onClick={editSilence}>
            {t('Edit silence')}
          </DropdownItem>,
          <DropdownItem key="cancel-silence" component="button" onClick={setModalOpen}>
            {t('Expire silence')}
          </DropdownItem>,
        ];

  return (
    <>
      <Dropdown
        className={className}
        data-test="silence-actions"
        dropdownItems={dropdownItems}
        isOpen={isOpen}
        isPlain={isPlain}
        onSelect={setClosed}
        position={DropdownPosition.right}
        toggle={<Toggle onToggle={setIsOpen} />}
      />
      <ExpireSilenceModal isOpen={isModalOpen} setClosed={setModalClosed} silenceID={silence.id} />
    </>
  );
};
const SilenceDropdown = withRouter(SilenceDropdown_);

const SilenceDropdownKebab: React.FC<{ silence: Silence }> = ({ silence }) => (
  <SilenceDropdown isPlain silence={silence} Toggle={KebabToggle} />
);

const ActionsToggle: React.FC<{ onToggle: OnToggle }> = ({ onToggle, ...props }) => (
  <DropdownToggle data-test="silence-actions-toggle" onToggle={onToggle} {...props}>
    Actions
  </DropdownToggle>
);

const SilenceDropdownActions: React.FC<{ silence: Silence }> = ({ silence }) => (
  <SilenceDropdown className="co-actions-menu" silence={silence} Toggle={ActionsToggle} />
);

type SilencedAlertsListProps = RouteComponentProps & { alerts: Alerts[] };

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
        {_.sortBy(alerts, alertDescription).map((a, i) => (
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
                  <DropdownItem key="view-rule" onClick={() => history.push(ruleURL(a.rule))}>
                    {t('View alerting rule')}
                  </DropdownItem>,
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

  const [namespace] = useActiveNamespace();
  const [perspective] = useActivePerspective();

  const alertsLoaded = useSelector(
    ({ observe }: RootState) => observe.get(perspective === 'dev' ? 'devAlerts' : 'alerts')?.loaded,
  );

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
                to={
                  perspective === 'dev'
                    ? `/dev-monitoring/ns/${namespace}/alerts`
                    : '/monitoring/silences'
                }
              >
                {perspective === 'dev' ? t('Alerts') : t('Silences')}
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

const tableAlertClasses = [
  'pf-u-w-50 pf-u-w-33-on-sm', // Name
  'pf-m-hidden pf-m-visible-on-sm', // Severity
  '', // State
  'pf-m-hidden pf-m-visible-on-sm', // Source
  'dropdown-kebab-pf pf-c-table__action',
];

type AlertTableRowProps = RouteComponentProps & RowProps<Alert>;

const AlertTableRow_: React.FC<AlertTableRowProps> = ({ history, obj }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const { annotations = {}, labels } = obj;
  const description = annotations.description || annotations.message;
  const state = alertState(obj);

  const title: string = obj.annotations?.description || obj.annotations?.message;

  const dropdownItems = [
    <DropdownItem key="view-rule" onClick={() => history.push(ruleURL(obj.rule))}>
      {t('View alerting rule')}
    </DropdownItem>,
  ];
  if (state !== AlertStates.Silenced) {
    dropdownItems.unshift(
      <DropdownItem key="silence-alert" onClick={() => history.push(silenceAlertURL(obj))}>
        {t('Silence alert')}
      </DropdownItem>,
    );
  }

  return (
    <>
      <td className={tableAlertClasses[0]} title={title}>
        <div className="co-resource-item">
          <MonitoringResourceIcon resource={AlertResource} />
          <Link
            to={alertURL(obj, obj.rule.id)}
            data-test-id="alert-resource-link"
            className="co-resource-item__resource-name"
          >
            {labels?.alertname}
          </Link>
        </div>
        <div className="monitoring-description">{description}</div>
      </td>
      <td className={tableAlertClasses[1]} title={title}>
        <Severity severity={labels?.severity} />
      </td>
      <td className={tableAlertClasses[2]} title={title}>
        <AlertState state={state} />
        <AlertStateDescription alert={obj} />
      </td>
      <td className={tableAlertClasses[3]} title={title}>
        {alertSource(obj) === AlertSource.User ? t('User') : t('Platform')}
      </td>
      <td className={tableAlertClasses[4]} title={title}>
        <KebabDropdown dropdownItems={dropdownItems} />
      </td>
    </>
  );
};
const AlertTableRow = withRouter(AlertTableRow_);

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

const SilencesNotLoadedWarning: React.FC<{ silencesLoadError: any }> = ({ silencesLoadError }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <PFAlert
      className="co-alert"
      isInline
      title={t(
        'Error loading silences from Alertmanager. Some of the alerts below may actually be silenced.',
      )}
      variant="warning"
    >
      {silencesLoadError.json?.error || silencesLoadError.message}
    </PFAlert>
  );
};

// Sort alerts by their state (sort first by the state itself, then by the timestamp relevant to
// the state)
const alertStateOrder = (alert: Alert) => [
  [AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced].indexOf(alertState(alert)),
  alertState(alert) === AlertStates.Silenced
    ? _.max(_.map(alert.silencedBy, 'endsAt'))
    : _.get(alert, 'activeAt'),
];

const getAdditionalSources = <T extends Alert | Rule>(
  data: Array<T>,
  itemSource: (item: T) => string,
) => {
  if (data) {
    const additionalSources = new Set<string>();
    data.forEach((item) => {
      const source = itemSource(item);
      if (source !== AlertSource.Platform && source !== AlertSource.User) {
        additionalSources.add(source);
      }
    });
    return Array.from(additionalSources).map((item) => ({ id: item, title: _.startCase(item) }));
  }
  return [];
};

const AlertsPage_: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const {
    data,
    loaded = false,
    loadError,
  }: Alerts = useSelector(({ observe }: RootState) => observe.get('alerts') || {});
  const silencesLoadError = useSelector(
    ({ observe }: RootState) => observe.get('silences')?.loadError,
  );

  const alertAdditionalSources = React.useMemo(
    () => getAdditionalSources(data, alertSource),
    [data],
  );

  const rowFilters: RowFilter[] = [
    // TODO: The "name" filter doesn't really fit useListPageFilter's idea of a RowFilter, but
    //       useListPageFilter doesn't yet provide a better way to add a filter like this
    {
      filter: (filter, alert: Alert) =>
        fuzzyCaseInsensitive(filter.selected?.[0], alert.labels?.alertname),
      filterGroupName: '',
      items: [],
      type: 'name',
    } as RowFilter,
    {
      defaultSelected: [AlertStates.Firing],
      filter: (filter, alert: Alert) =>
        filter.selected?.includes(alertState(alert)) || _.isEmpty(filter.selected),
      filterGroupName: t('Alert State'),
      items: [
        { id: AlertStates.Firing, title: t('Firing') },
        { id: AlertStates.Pending, title: t('Pending') },
        { id: AlertStates.Silenced, title: t('Silenced') },
      ],
      reducer: alertState,
      type: 'alert-state',
    },
    severityRowFilter(t),
    {
      defaultSelected: [AlertSource.Platform],
      filter: (filter, alert: Alert) =>
        filter.selected?.includes(alertSource(alert)) || _.isEmpty(filter.selected),
      filterGroupName: t('Source'),
      items: [
        { id: AlertSource.Platform, title: t('Platform') },
        { id: AlertSource.User, title: t('User') },
        ...alertAdditionalSources,
      ],
      reducer: alertSource,
      type: 'alert-source',
    },
  ];

  const [staticData, filteredData, onFilterChange] = useListPageFilter(data, rowFilters);

  const columns = React.useMemo<TableColumn<Alert>[]>(
    () => [
      {
        id: 'name',
        props: { className: tableAlertClasses[0] },
        sort: 'labels.alertname',
        title: t('Name'),
        transforms: [sortable],
      },
      {
        id: 'severity',
        props: { className: tableAlertClasses[1] },
        sort: (alerts: Alert[], direction: 'asc' | 'desc') =>
          _.orderBy(alerts, alertSeverityOrder, [direction]) as Alert[],
        title: t('Severity'),
        transforms: [sortable],
      },
      {
        id: 'state',
        props: { className: tableAlertClasses[2] },
        sort: (alerts: Alert[], direction: 'asc' | 'desc') =>
          _.orderBy(alerts, alertStateOrder, [direction]),
        title: t('State'),
        transforms: [sortable],
      },
      {
        id: 'source',
        props: { className: tableAlertClasses[3] },
        sort: (alerts: Alert[], direction: 'asc' | 'desc') =>
          _.orderBy(alerts, alertSource, [direction]),
        title: t('Source'),
        transforms: [sortable],
      },
      {
        id: 'actions',
        props: { className: tableAlertClasses[4] },
        title: '',
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
          labelFilter="alerts"
          labelPath="labels"
          loaded={loaded}
          onFilterChange={onFilterChange}
          rowFilters={rowFilters}
        />
        {silencesLoadError && <SilencesNotLoadedWarning silencesLoadError={silencesLoadError} />}
        <div className="row">
          <div className="col-xs-12">
            <VirtualizedTable<Alert>
              aria-label={t('Alerts')}
              columns={columns}
              data={filteredData ?? []}
              loaded={loaded}
              loadError={loadError}
              Row={AlertTableRow}
              unfilteredData={data}
            />
          </div>
        </div>
      </div>
    </>
  );
};
const AlertsPage = withFallback(AlertsPage_);

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
              columns={columns}
              data={filteredData ?? []}
              loaded={loaded}
              loadError={loadError}
              Row={RuleTableRow}
              unfilteredData={data}
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
      refreshSilences(dispatch);
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
      onChange={onChange}
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
                columns={columns}
                data={filteredData ?? []}
                loaded={loaded}
                loadError={loadError}
                Row={SilenceTableRowWithCheckbox}
                unfilteredData={data}
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

  const [customExtensions] =
    useResolvedExtensions<AlertingRulesSourceExtension>(isAlertingRulesSource);

  const alertsSource = React.useMemo(
    () =>
      customExtensions
        .filter((extension) => extension.properties.contextId === 'observe-alerting')
        .map((extension) => extension.properties),
    [customExtensions],
  );

  React.useEffect(() => {
    const { prometheusBaseURL } = window.SERVER_FLAGS;

    if (prometheusBaseURL) {
      const alertsKey = 'alerts';
      const rulesKey = 'rules';
      dispatch(alertingLoading(alertsKey));
      const url = getPrometheusURL({ endpoint: PrometheusEndpoint.RULES });
      const poller = (): void => {
        fetchAlerts(url, alertsSource)
          .then(({ data }) => {
            const { alerts, rules } = getAlertsAndRules(data);
            dispatch(alertingLoaded(alertsKey, alerts));
            dispatch(alertingSetRules(rulesKey, rules));
          })
          .catch((e) => {
            dispatch(alertingErrored(alertsKey, e));
          })
          .then(() => {
            if (pollerTimeouts[alertsKey]) {
              clearTimeout(pollerTimeouts[alertsKey]);
            }
            pollerTimeouts[alertsKey] = setTimeout(poller, 15 * 1000);
          });
      };
      pollers[alertsKey] = poller;
      poller();
    } else {
      dispatch(alertingErrored('alerts', new Error('prometheusBaseURL not set')));
    }
    return () => _.each(pollerTimeouts, clearTimeout);
  }, [alertsSource, dispatch]);

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

type AlertStateProps = {
  state: AlertStates;
};

type AlertMessageProps = {
  alertText: string;
  labels: PrometheusLabels;
  template: string;
};

type GraphProps = {
  filterLabels?: PrometheusLabels;
  formatSeriesTitle?: FormatSeriesTitle;
  namespace?: string;
  query: string;
  ruleDuration: number;
  showLegend?: boolean;
};

type MonitoringResourceIconProps = {
  className?: string;
  resource: MonitoringResource;
};

type OnToggle = (value: boolean, e: MouseEvent) => void;

export default MonitoringUI;
