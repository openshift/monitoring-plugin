import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { getLegacyObserveState, usePerspective } from '../hooks/usePerspective';
import { Alerts, AlertSource } from '../types';
import { useSelector } from 'react-redux';

import * as _ from 'lodash-es';
import {
  alertCluster,
  alertingRuleSource,
  alertSource,
  getAdditionalSources,
  SilencesNotLoadedWarning,
} from './AlertUtils';
import {
  AlertSeverity,
  AlertStates,
  ListPageFilter,
  RowFilter,
  useListPageFilter,
} from '@openshift-console/dynamic-plugin-sdk';
import { fuzzyCaseInsensitive } from '../utils';
import { Table, TableGridBreakpoint, Th, Thead, Tr } from '@patternfly/react-table';
import { Helmet } from 'react-helmet';
import { MonitoringState } from '../../reducers/observe';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';
import { AggregatedAlert, getAggregateAlertsLists } from './AlertsAggregates';

import Error from './Error';
import AggregateAlertTableRow from './AlertList/AggregateAlertTableRow';
import DownloadCSVButton from './AlertList/DownloadCSVButton';
import useAggregateAlertColumns from './AlertList/hooks/useAggregateAlertColumns';
import useSelectedFilters from './useSelectedFilters';
import { Flex, PageSection } from '@patternfly/react-core';

const AlertsPage_: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { alertsKey, silencesKey, defaultAlertTenant, perspective } = usePerspective();

  const {
    data,
    loaded = false,
    loadError,
  }: Alerts = useSelector(
    (state: MonitoringState) => getLegacyObserveState(perspective, state)?.get(alertsKey) || {},
  );
  const silencesLoadError = useSelector(
    (state: MonitoringState) =>
      getLegacyObserveState(perspective, state)?.get(silencesKey)?.loadError,
  );

  const aggregatedAlertsList = getAggregateAlertsLists(data);

  const alertAdditionalSources = React.useMemo(
    () => getAdditionalSources(data, alertSource),
    [data],
  );

  const clusters = React.useMemo(() => {
    const clusterSet = new Set<string>();
    data?.forEach((alert) => {
      const clusterName = alert.labels?.cluster;
      if (clusterName) {
        clusterSet.add(clusterName);
      }
    });

    const clusterArray = Array.from(clusterSet);
    return clusterArray.sort();
  }, [data]);

  let rowFilters: RowFilter[] = [
    // TODO: The "name" filter doesn't really fit useListPageFilter's idea of a RowFilter, but
    //       useListPageFilter doesn't yet provide a better way to add a filter like this
    {
      filter: (filter, alert: AggregatedAlert) =>
        fuzzyCaseInsensitive(filter.selected?.[0], alert.name),
      filterGroupName: '',
      items: [],
      type: 'name',
    } as RowFilter,
    {
      defaultSelected: [AlertStates.Firing],
      filter: (filter, aggregatedAlert: AggregatedAlert) =>
        Array.from(aggregatedAlert.states).some((state) => filter.selected?.includes(state)) ||
        _.isEmpty(filter.selected),
      filterGroupName: t('Alert State'),
      items: [
        { id: AlertStates.Firing, title: t('Firing') },
        { id: AlertStates.Pending, title: t('Pending') },
        { id: AlertStates.Silenced, title: t('Silenced') },
      ],
      isMatch: (aggregatedAlert: AggregatedAlert, id: AlertStates) =>
        aggregatedAlert.states.has(id),
      type: 'alert-state',
    },
    {
      defaultSelected: [AlertStates.Firing],
      filter: (filter, aggregatedAlert: AggregatedAlert) =>
        _.isEmpty(filter.selected) || filter.selected?.includes(aggregatedAlert?.severity),
      filterGroupName: t('Severity'),
      items: [
        { id: AlertSeverity.Critical, title: t('Critical') },
        { id: AlertSeverity.Warning, title: t('Warning') },
        { id: AlertSeverity.Info, title: t('Info') },
        { id: AlertSeverity.None, title: t('None') },
      ],
      reducer: (aggregatedAlert: AggregatedAlert) => aggregatedAlert.severity,
      type: 'alert-severity',
    },
    {
      defaultSelected: defaultAlertTenant,
      filter: (filter, aggregatedAlert: AggregatedAlert) =>
        aggregatedAlert.alerts.some((alert) => filter.selected?.includes(alertSource(alert))) ||
        _.isEmpty(filter.selected),
      filterGroupName: t('Source'),
      items: [
        { id: AlertSource.Platform, title: t('Platform') },
        { id: AlertSource.User, title: t('User') },
        ...alertAdditionalSources,
      ],
      isMatch: (aggregatedAlert: AggregatedAlert, id: AlertSource) =>
        aggregatedAlert.alerts.some((alert) => id === alertingRuleSource(alert.rule)),
      type: 'alert-source',
    },
  ];

  if (perspective === 'dev') {
    rowFilters = rowFilters.filter((filter) => filter.type !== 'alert-source');
  } else if (perspective === 'acm') {
    rowFilters.splice(-1, 0, {
      type: 'alert-cluster',
      filter: (filter, aggregatedAlert: AggregatedAlert) =>
        aggregatedAlert.alerts.some(
          (alert) =>
            filter.selected.length === 0 ||
            filter.selected.some((selectedFilter) =>
              fuzzyCaseInsensitive(selectedFilter, alert.labels?.cluster),
            ),
        ),
      filterGroupName: t('Cluster'),
      items: clusters.map((clusterName) => ({ id: clusterName, title: clusterName })),
      isMatch: (aggregatedAlert: AggregatedAlert, clusterName: string) =>
        aggregatedAlert.alerts.some((alert) =>
          fuzzyCaseInsensitive(clusterName, alert.labels?.cluster),
        ),
      reducer: alertCluster,
    } as RowFilter);
  }

  const [staticData, filteredData, onFilterChange] = useListPageFilter(
    aggregatedAlertsList,
    rowFilters,
  );

  const columns = useAggregateAlertColumns();
  const selectedFilters = useSelectedFilters();

  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
      <PageSection hasBodyWrapper={false}>
        <Flex>
          <ListPageFilter
            data={staticData}
            labelFilter="alerts"
            labelPath="labels"
            loaded={loaded}
            onFilterChange={onFilterChange}
            rowFilters={rowFilters}
          />

          <DownloadCSVButton loaded={loaded} filteredData={filteredData} />
        </Flex>
        {silencesLoadError && <SilencesNotLoadedWarning silencesLoadError={silencesLoadError} />}

        {filteredData?.length > 0 && loaded && (
          <Table gridBreakPoint={TableGridBreakpoint.none} role="presentation">
            <Thead>
              <Tr>
                {columns.map((column) => (
                  <Th key={column.id} {...column?.props}>
                    {column.title}
                  </Th>
                ))}
              </Tr>
            </Thead>
            {filteredData.map((aggregatedAlert, index) => (
              <AggregateAlertTableRow
                key={aggregatedAlert.name}
                aggregatedAlert={aggregatedAlert}
                rowData={{ rowIndex: index, selectedFilters }}
              />
            ))}
          </Table>
        )}

        {loadError && <Error error={loadError} />}
        {loaded && filteredData?.length === 0 && !loadError && <EmptyBox label={t('Alerts')} />}
        {!loaded && <LoadingBox />}
      </PageSection>
    </>
  );
};
const AlertsPage = withFallback(AlertsPage_);

export default AlertsPage;
