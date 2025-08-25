import {
  Alert,
  AlertStates,
  ListPageFilter,
  RowFilter,
  useActiveNamespace,
  useListPageFilter,
} from '@openshift-console/dynamic-plugin-sdk';
import { Flex, PageSection } from '@patternfly/react-core';
import { Table, TableGridBreakpoint, Th, Thead, Tr } from '@patternfly/react-table';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { MonitoringState } from '../../store/store';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';
import { getObserveState, usePerspective } from '../hooks/usePerspective';
import { AlertSource } from '../types';
import { alertState, ALL_NAMESPACES_KEY, fuzzyCaseInsensitive } from '../utils';
import AggregateAlertTableRow from './AlertList/AggregateAlertTableRow';
import DownloadCSVButton from './AlertList/DownloadCSVButton';
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
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { useAlerts } from '../../hooks/useAlerts';
import { useMonitoring } from '../../hooks/useMonitoring';

const AlertsPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [namespace] = useActiveNamespace();
  const { defaultAlertTenant, perspective } = usePerspective();
  const { plugin } = useMonitoring();

  useAlerts();

  const loadingInfo = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state)?.alerting[namespace],
  );
  const alerts = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state)?.alerting[namespace]?.alerts,
  );
  const silencesLoadError = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state)?.alerting[namespace]?.silences?.loadError,
  );

  const alertAdditionalSources = useMemo(() => getAdditionalSources(alerts, alertSource), [alerts]);

  const clusters = useMemo(() => {
    const clusterSet = new Set<string>();
    alerts?.forEach((alert) => {
      const clusterName = alert.labels?.cluster;
      if (clusterName) {
        clusterSet.add(clusterName);
      }
    });

    const clusterArray = Array.from(clusterSet);
    return clusterArray.sort();
  }, [alerts]);

  const namespacedAlerts = useMemo(() => {
    if (perspective === 'acm' || namespace === ALL_NAMESPACES_KEY) {
      return alerts;
    }
    return alerts?.filter((alert) => alert.labels?.namespace === namespace);
  }, [alerts, perspective, namespace]);

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

  if (perspective === 'acm') {
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
  } else if (namespace && namespace !== ALL_NAMESPACES_KEY) {
    rowFilters = rowFilters.filter((filter) => filter.type !== 'alert-source');
  }

  const [staticData, filteredData, onFilterChange] = useListPageFilter(
    namespacedAlerts,
    rowFilters,
  );

  const columns = useAggregateAlertColumns();
  const selectedFilters = useSelectedFilters();

  const filteredAggregatedAlerts = getAggregateAlertsLists(filteredData);
  const loaded = !!loadingInfo?.loaded;
  const loadError = loadingInfo?.loadError ? loadingInfo.loadError : null;

  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
      <PageSection hasBodyWrapper={false} type="subnav">
        <Flex>
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
        </Flex>
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
const AlertsPageWithFallback = withFallback(AlertsPage_);

export const MpCmoAlertsPage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <AlertsPageWithFallback />
    </MonitoringProvider>
  );
};

export const McpAcmAlertsPage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <AlertsPageWithFallback />
    </MonitoringProvider>
  );
};
