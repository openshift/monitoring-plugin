import {
  AlertStates,
  ListPageFilter,
  PrometheusAlert,
  ResourceIcon,
  RowFilter,
  RowProps,
  Rule,
  TableColumn,
  useActiveNamespace,
  useListPageFilter,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import { sortable, Td } from '@patternfly/react-table';
import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom-v5-compat';

import { Alerts, AlertSource } from '../types';
import {
  alertingRuleStateOrder,
  alertSeverityOrder,
  fuzzyCaseInsensitive,
  RuleResource,
} from '../utils';

import { Flex, FlexItem, PageSection, Truncate } from '@patternfly/react-core';
import { MonitoringState } from '../../reducers/observe';
import {
  alertingRuleSource,
  AlertStateIcon,
  getAdditionalSources,
  getAlertStateKey,
  SeverityBadge,
  SilencesNotLoadedWarning,
} from '../alerting/AlertUtils';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import { useAlertsPoller } from '../hooks/useAlertsPoller';
import { getLegacyObserveState, getRuleUrl, usePerspective } from '../hooks/usePerspective';
import { severityRowFilter } from './AlertUtils';
import { AlertingRulesPageTestIDs } from '../data-test';

const StateCounts: React.FC<{ alerts: PrometheusAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const counts = _.countBy(alerts, 'state');
  const states = [AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced].filter(
    (s) => counts[s] > 0,
  );

  return (
    <>
      {states.map((s) => (
        <div key={s}>
          <AlertStateIcon state={s} /> {counts[s]} {getAlertStateKey(s, t)}
        </div>
      ))}
    </>
  );
};

const ruleHasAlertState = (rule: Rule, state: AlertStates): boolean =>
  state === AlertStates.NotFiring ? _.isEmpty(rule.alerts) : _.some(rule.alerts, { state });

const ruleAlertStateFilter = (filter, rule: Rule) =>
  (filter.selected?.includes(AlertStates.NotFiring) && _.isEmpty(rule.alerts)) ||
  _.some(rule.alerts, (a) => filter.selected?.includes(a.state)) ||
  _.isEmpty(filter.selected);

const alertStateFilter = (t): RowFilter => ({
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

const RuleTableRow: React.FC<RowProps<Rule>> = ({ obj }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const title: string = obj.annotations?.description || obj.annotations?.message;

  return (
    <>
      <Td title={title} width={50}>
        <Flex spaceItems={{ default: 'spaceItemsNone' }} flexWrap={{ default: 'nowrap' }}>
          <FlexItem data-test={AlertingRulesPageTestIDs.AlertingRuleRow.AlertingRuleResourceIcon}>
            <ResourceIcon kind={RuleResource.kind} />
          </FlexItem>
          <FlexItem>
            <Link
              to={getRuleUrl(perspective, obj, obj.labels.namespace)}
              data-test={AlertingRulesPageTestIDs.AlertingRuleRow.AlertingRuleResourceLink}
            >
              <Truncate content={obj.name} />
            </Link>
          </FlexItem>
        </Flex>
      </Td>
      <Td
        title={title}
        width={20} 
        data-test={AlertingRulesPageTestIDs.AlertingRuleRow.AlertingRuleSeverityBadge}
      >
        <SeverityBadge severity={obj.labels?.severity} />
      </Td>
      <Td
        title={title}
        width={15}
        data-test={AlertingRulesPageTestIDs.AlertingRuleRow.AlertingRuleStateBadge}
      >
        {_.isEmpty(obj.alerts) ? '-' : <StateCounts alerts={obj.alerts} />}
      </Td>
      <Td
        title={title}
        width={15}
        data-test={AlertingRulesPageTestIDs.AlertingRuleRow.AlertingRuleSource}
      >
        {alertingRuleSource(obj) === AlertSource.User ? t('User') : t('Platform')}
      </Td>
    </>
  );
};

const AlertRulesPage_: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { alertsKey, silencesKey, rulesKey, perspective, defaultAlertTenant } = usePerspective();
  const [namespace] = useActiveNamespace();

  useAlertsPoller();

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

  const namespacedData = React.useMemo(() => {
    if (perspective === 'dev') {
      return data?.filter((rule) => rule.labels?.namespace === namespace);
    }

    return data;
  }, [data, perspective, namespace]);

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

  const [staticData, filteredData, onFilterChange] = useListPageFilter(namespacedData, rowFilters);

  const columns = React.useMemo<TableColumn<Rule>[]>(
    () => [
      {
        id: 'name',
        sort: 'name',
        title: t('Name'),
        transforms: [sortable],
        props: { width: 50 },
      },
      {
        id: 'severity',
        sort: (rules: Rule[], direction: 'asc' | 'desc') =>
          _.orderBy(rules, alertSeverityOrder, [direction]) as Rule[],
        title: t('Severity'),
        transforms: [sortable],
        props: { width: 20 },
      },
      {
        id: 'state',
        sort: (rules: Rule[], direction: 'asc' | 'desc') =>
          _.orderBy(rules, alertingRuleStateOrder, [direction]),
        title: t('Alert state'),
        transforms: [sortable],
        props: { width: 15 },
      },
      {
        id: 'source',
        sort: (rules: Rule[], direction: 'asc' | 'desc') =>
          _.orderBy(rules, alertingRuleSource, [direction]),
        title: t('Source'),
        transforms: [sortable],
        props: { width: 15 },
      },
    ],
    [t],
  );

  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
      <PageSection hasBodyWrapper={false}>
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
        <div id="alert-rules-table-scroll">
          <VirtualizedTable<Rule>
            aria-label={t('Alerting rules')}
            label={t('Alerting rules')}
            columns={columns}
            data={filteredData ?? []}
            loaded={loaded}
            loadError={loadError}
            Row={RuleTableRow}
            unfilteredData={data}
            scrollNode={() => document.getElementById('alert-rules-table-scroll')}
            NoDataEmptyMsg={() => {
              return <EmptyBox label={t('Alerting rules')} />;
            }}
          />
        </div>
      </PageSection>
    </>
  );
};
const AlertRulesPage = withFallback(AlertRulesPage_);

export default AlertRulesPage;
