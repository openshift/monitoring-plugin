import {
  Alert,
  AlertStates,
  ListPageFilter,
  RowFilter,
  useListPageFilter,
} from '@openshift-console/dynamic-plugin-sdk';
import { Table, TableGridBreakpoint, Th, Thead, Tr } from '@patternfly/react-table';
import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { MonitoringState } from '../../reducers/observe';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';
import { getLegacyObserveState, usePerspective } from '../hooks/usePerspective';
import { Alerts, AlertSource } from '../types';
import { alertState, fuzzyCaseInsensitive } from '../utils';
import AggregateAlertTableRow from './AlertList/AggregateAlertTableRow';
import useAggregateAlertColumns from './AlertList/hooks/useAggregateAlertColumns';
import { getAggregateAlertsLists } from './AlertsAggregates';
import {
  alertCluster,
  alertSource,
  getAdditionalSources,
  severityRowFilter,
  SilencesNotLoadedWarning,
} from './AlertUtils';
import Error from './Error';
import useSelectedFilters from './useSelectedFilters';
import { PageSection, PageSectionVariants } from '@patternfly/react-core/dist/esm';
import DownloadCSVButton from './AlertList/DownloadCSVButton';

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
      filter: (filter, alert: Alert) =>
        fuzzyCaseInsensitive(filter.selected?.[0], alert.labels?.alertname),
      filterGroupName: '',
      items: [],
      type: 'name',
    } as RowFilter,
    {
      defaultSelected: [AlertStates.Firing],
      filter: (filter, alert: Alert) =>
        filter.selected.length === 0 ||
        filter.selected?.includes(alertState(alert)) ||
        _.isEmpty(filter.selected),
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
      defaultSelected: defaultAlertTenant,
      filter: (filter, alert: Alert) =>
        filter.selected.length === 0 ||
        filter.selected?.includes(alertSource(alert)) ||
        _.isEmpty(filter.selected),
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

  if (perspective === 'dev') {
    rowFilters = rowFilters.filter((filter) => filter.type !== 'alert-source');
  } else if (perspective === 'acm') {
    rowFilters.splice(-1, 0, {
      filter: (filter, alert: Alert) => {
        return (
          filter.selected.length === 0 ||
          filter.selected.some((selectedFilter) =>
            fuzzyCaseInsensitive(selectedFilter, alert.labels?.cluster),
          )
        );
      },
      filterGroupName: t('Cluster'),
      items: clusters.map((clusterName) => ({
        id: clusterName,
        title: clusterName?.length > 50 ? clusterName.slice(0, 50) + '...' : clusterName,
      })),
      reducer: alertCluster,
      isMatch: (alert: Alert, clusterName: string) =>
        fuzzyCaseInsensitive(clusterName, alert.labels?.cluster),
      type: 'alert-cluster',
    } as RowFilter);
  }

  const [staticData, filteredData, onFilterChange] = useListPageFilter(data, rowFilters);

  const columns = useAggregateAlertColumns();
  const selectedFilters = useSelectedFilters();

  const filteredAggregatedAlerts = getAggregateAlertsLists(filteredData);

  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
      <PageSection variant={PageSectionVariants.light}>
        <ListPageFilter
          data={staticData}
          labelFilter="alerts"
          labelPath="labels"
          loaded={loaded}
          onFilterChange={onFilterChange}
          rowFilters={rowFilters}
        />
        {loaded && filteredAggregatedAlerts?.length > 0 && (
          <DownloadCSVButton loaded={loaded} filteredData={filteredAggregatedAlerts} />
        )}
        {silencesLoadError && <SilencesNotLoadedWarning silencesLoadError={silencesLoadError} />}

        {filteredAggregatedAlerts?.length > 0 && loaded && (
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
            {filteredAggregatedAlerts.map((aggregatedAlert, index) => (
              <AggregateAlertTableRow
                key={aggregatedAlert.name}
                aggregatedAlert={aggregatedAlert}
                rowData={{ rowIndex: index, selectedFilters }}
              />
            ))}
          </Table>
        )}

        {loadError && <Error error={loadError} />}
        {loaded && filteredAggregatedAlerts?.length === 0 && !loadError && (
          <EmptyBox label={t('Alerts')} />
        )}
        {!loaded && <LoadingBox />}
      </PageSection>
    </>
  );
};
const AlertsPage = withFallback(AlertsPage_);

export default AlertsPage;
