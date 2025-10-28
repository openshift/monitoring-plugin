import {
  Alert,
  AlertStates,
  DocumentTitle,
  ListPageFilter,
  RowFilter,
  useActiveNamespace,
  useListPageFilter,
} from '@openshift-console/dynamic-plugin-sdk';
import { Flex, PageSection } from '@patternfly/react-core';
import { Table, TableGridBreakpoint, Th, Thead, Tr } from '@patternfly/react-table';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';
import { usePerspective } from '../hooks/usePerspective';
import { AlertSource } from '../types';
import { alertState, ALL_NAMESPACES_KEY, fuzzyCaseInsensitive } from '../utils';
import AggregateAlertTableRow from './AlertList/AggregateAlertTableRow';
import DownloadCSVButton from './AlertList/DownloadCSVButton';
import useAggregateAlertColumns from './AlertList/hooks/useAggregateAlertColumns';
import { getAggregateAlertsLists } from './AlertsAggregates';
import {
  alertCluster,
  alertSource,
  severityRowFilter,
  SilencesNotLoadedWarning,
} from './AlertUtils';
import useSelectedFilters from './useSelectedFilters';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { useAlerts } from '../../hooks/useAlerts';
import { AccessDenied } from '../console/console-shared/src/components/empty-state/AccessDenied';

const AlertsPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [namespace] = useActiveNamespace();
  const { defaultAlertTenant, perspective } = usePerspective();

  const { alerts, additionalAlertSourceLabels, alertClusterLabels, rulesAlertLoading, silences } =
    useAlerts();

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
        ...additionalAlertSourceLabels,
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
      items: alertClusterLabels.map((clusterName) => ({
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

  const [staticData, filteredData, onFilterChange] = useListPageFilter(alerts, rowFilters);

  const columns = useAggregateAlertColumns();
  const selectedFilters = useSelectedFilters();

  const filteredAggregatedAlerts = getAggregateAlertsLists(filteredData);
  const loaded = !!rulesAlertLoading?.loaded;
  const loadError = rulesAlertLoading?.loadError ? rulesAlertLoading.loadError : undefined;

  return (
    <>
      <DocumentTitle>{t('Alerting')}</DocumentTitle>
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
        {/* Only show the silences error when the alerts have loaded, since failing to load the
          silences doesn't matter if the alerts haven't loaded*/}
        {silences?.loadError && !loadError && (
          <SilencesNotLoadedWarning silencesLoadError={silences?.loadError} />
        )}
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
        {loadError && <AccessDenied message={loadError.message} />}
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
