import * as React from 'react';
import { withFallback } from '../console/console-shared/error/error-boundary';
import { useTranslation } from 'react-i18next';
import { usePerspective } from '../hooks/usePerspective';
import { Alerts, AlertSource, RootState } from '../types';
import { useSelector } from 'react-redux';

import * as _ from 'lodash-es';
import {
  alertSource,
  AlertState,
  AlertStateDescription,
  devRuleURL,
  getAdditionalSources,
  isActionWithCallback,
  isActionWithHref,
  MonitoringResourceIcon,
  ruleURL,
  Severity,
  SilencesNotLoadedWarning,
} from './AlertUtils';
import { newSilenceAlertURL, newDevSilenceAlertURL } from './SilencesUtils';
import {
  Action,
  Alert,
  AlertStates,
  ActionServiceProvider,
  ListPageFilter,
  RowFilter,
  RowProps,
  TableColumn,
  useListPageFilter,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  AlertResource,
  alertSeverityOrder,
  alertState,
  alertURL,
  devAlertURL,
  fuzzyCaseInsensitive,
} from '../utils';
import { severityRowFilter } from '../alerting';
import { sortable } from '@patternfly/react-table';
import { Helmet } from 'react-helmet';
import { DropdownItem } from '@patternfly/react-core';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import KebabDropdown from '../kebab-dropdown';

const tableAlertClasses = [
  'pf-u-w-50 pf-u-w-33-on-sm', // Name
  'pf-m-hidden pf-m-visible-on-sm', // Severity
  '', // State
  'pf-m-hidden pf-m-visible-on-sm', // Source
  'dropdown-kebab-pf pf-c-table__action',
];

const AlertsPage_: React.FC<AlertsPageProps> = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { isDev, alertsKey, defaultAlertTenant } = usePerspective();

  const {
    data,
    loaded = false,
    loadError,
  }: Alerts = useSelector(({ observe }: RootState) => observe.get(alertsKey) || {});
  const silencesLoadError = useSelector(
    ({ observe }: RootState) => observe.get(isDev ? 'devSilences' : 'silences')?.loadError,
  );

  const alertAdditionalSources = React.useMemo(
    () => getAdditionalSources(data, alertSource),
    [data],
  );

  let rowFilters: RowFilter[] = [
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
      defaultSelected: [defaultAlertTenant],
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

  if (isDev) {
    rowFilters = rowFilters.filter((filter) => filter.type !== 'alert-source');
  }

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

// Sort alerts by their state (sort first by the state itself, then by the timestamp relevant to
// the state)
const alertStateOrder = (alert: Alert) => [
  [AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced].indexOf(alertState(alert)),
  alertState(alert) === AlertStates.Silenced
    ? _.max(_.map(alert.silencedBy, 'endsAt'))
    : _.get(alert, 'activeAt'),
];

const AlertTableRow_: React.FC<AlertTableRowProps> = ({ history, obj, match }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { isDev } = usePerspective();
  const namespace = match.params.ns;

  const { annotations = {}, labels } = obj;
  const description = annotations.description || annotations.message;
  const state = alertState(obj);

  const title: string = obj.annotations?.description || obj.annotations?.message;

  const dropdownItems = [
    <DropdownItem
      key="view-rule"
      onClick={() => history.push(isDev ? devRuleURL(obj.rule, namespace) : ruleURL(obj.rule))}
    >
      {t('View alerting rule')}
    </DropdownItem>,
  ];
  if (state !== AlertStates.Silenced) {
    dropdownItems.unshift(
      <DropdownItem
        key="silence-alert"
        onClick={() =>
          history.push(isDev ? newDevSilenceAlertURL(obj, namespace) : newSilenceAlertURL(obj))
        }
      >
        {t('Silence alert')}
      </DropdownItem>,
    );
  }

  const getDropdownItemsWithExtension = (actions: Action[]) => {
    const extensionDropdownItems = [];
    actions.forEach((action) => {
      if (isActionWithHref(action)) {
        extensionDropdownItems.push(
          <DropdownItem key={action.id} href={action.cta.href}>
            {action.label}
          </DropdownItem>,
        );
      } else if (isActionWithCallback(action)) {
        extensionDropdownItems.push(
          <DropdownItem key={action.id} onClick={action.cta}>
            {action.label}
          </DropdownItem>,
        );
      }
    });
    return dropdownItems.concat(extensionDropdownItems);
  };

  return (
    <>
      <td className={tableAlertClasses[0]} title={title}>
        <div className="co-resource-item">
          <MonitoringResourceIcon resource={AlertResource} />
          <Link
            to={isDev ? devAlertURL(obj, obj.rule.id, namespace) : alertURL(obj, obj.rule.id)}
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
        <ActionServiceProvider context={{ 'monitoring-alert-list-item': { alert: obj } }}>
          {({ actions, loaded }) => {
            if (loaded && actions.length > 0) {
              return <KebabDropdown dropdownItems={getDropdownItemsWithExtension(actions)} />;
            } else {
              return <KebabDropdown dropdownItems={dropdownItems} />;
            }
          }}
        </ActionServiceProvider>
      </td>
    </>
  );
};
const AlertTableRow = withRouter(AlertTableRow_);

export default AlertsPage;

type AlertTableRowProps = RouteComponentProps<AlertsPageProps> & RowProps<Alert>;

type AlertsPageProps = {
  ns: string | undefined;
};
