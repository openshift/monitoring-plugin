import { AlertSeverity, AlertStates, DocumentTitle } from '@openshift-console/dynamic-plugin-sdk';
import { PageSection, PaginationVariant } from '@patternfly/react-core';
import DataView from '@patternfly/react-data-view/dist/dynamic/DataView';
import { DataViewTh } from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import DataViewTableHead from '@patternfly/react-data-view/dist/dynamic/DataViewTableHead';
import DataViewToolbar from '@patternfly/react-data-view/dist/dynamic/DataViewToolbar';
import { useDataViewSort } from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { Table, TableGridBreakpoint, ThProps } from '@patternfly/react-table';
import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { useAlerts } from '../../hooks/useAlerts';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { AccessDenied } from '../console/console-shared/src/components/empty-state/AccessDenied';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';
import { useDeepMemo } from '../hooks/useDeepMemo';
import { useMonitoringNamespace } from '../hooks/useMonitoringNamespace';
import { usePerspective } from '../hooks/usePerspective';
import { ITEMS_PER_PAGE, TablePagination } from '../table-pagination';
import {
  TableFilter,
  TableFilterOption,
  TableFilterProps,
  TableFilters,
} from '../table/TableFilters';
import { TableToolbar } from '../table/TableToolbar';
import { useTableFilters } from '../table/useTableFilters';
import { useTablePagination } from '../table/useTablePagination';
import { AlertSource } from '../types';
import { ALL_NAMESPACES_KEY, severitySort } from '../utils';
import AggregateAlertTableRow from './AlertList/AggregateAlertTableRow';
import DownloadCSVButton from './AlertList/DownloadCSVButton';
import { filterAlerts } from './AlertList/filter-alerts';
import { AggregatedAlert, getAggregateAlertsLists } from './AlertsAggregates';
import { rowFilter, SilencesNotLoadedWarning } from './AlertUtils';

export const enum AlertFilterOptions {
  NAME = 'name',
  STATE = 'alert-state',
  SEVERITY = 'alert-severity',
  LABEL = 'label',
  SOURCE = 'alert-source',
  CLUSTER = 'alert-cluster',
}

export interface AggregatedAlertFilters {
  [AlertFilterOptions.NAME]: string;
  [AlertFilterOptions.STATE]: string[];
  [AlertFilterOptions.SEVERITY]: string[];
  [AlertFilterOptions.LABEL]: string;
  [AlertFilterOptions.SOURCE]?: AlertSource[];
  [AlertFilterOptions.CLUSTER]?: string[];
}

const AlertsPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { namespace } = useMonitoringNamespace();
  const { defaultAlertTenant, perspective } = usePerspective();
  const [activeAttributeMenu, setActiveAttributeMenu] = useState<string>(t('Alert Name'));
  const initialFilters = useDeepMemo(() => {
    const filters = {
      [AlertFilterOptions.NAME]: '',
      [AlertFilterOptions.STATE]: [AlertStates.Firing],
      [AlertFilterOptions.SEVERITY]: [],
      [AlertFilterOptions.SOURCE]: defaultAlertTenant,
      [AlertFilterOptions.LABEL]: '',
    };
    if (perspective === 'acm') {
      filters[AlertFilterOptions.CLUSTER] = [];
    } else if (namespace && namespace !== ALL_NAMESPACES_KEY) {
      delete filters[AlertFilterOptions.SOURCE];
    }
    return filters;
  }, [perspective, defaultAlertTenant, namespace]);

  // KNOWN ISSUE: the useDataViewPagination, useDataViewFilters, and useDataViewSort functions
  // do not work together for URL initialization, so only the search parameters for the last
  // function will be set when initially loading the page
  // with no search parameters. Future changes are reflected
  const pagination = useTablePagination({
    perPage: ITEMS_PER_PAGE[0],
  });
  const { filters, onSetFilters, clearAllFilters, deleteFilter } =
    useTableFilters<AggregatedAlertFilters>({
      initialFilters,
    });
  const { sortBy, direction, onSort } = useDataViewSort({
    initialSort: { sortBy: rowFilter(AlertFilterOptions.NAME), direction: 'asc' },
  });

  const columnKeys = useMemo(() => {
    const keys = [
      { label: '', key: 'expandable' },
      { label: t('Name'), key: rowFilter(AlertFilterOptions.NAME) },
      { label: t('Severity'), key: rowFilter(AlertFilterOptions.SEVERITY) },
      { label: t('Total'), key: rowFilter('alert-total') },
      { label: t('State'), key: rowFilter(AlertFilterOptions.STATE) },
    ];
    if (perspective === 'acm') {
      keys.push({ label: t('Cluster'), key: rowFilter(AlertFilterOptions.CLUSTER) });
    }
    return keys;
  }, [t, perspective]);

  const sortByIndex = useMemo(
    () => columnKeys.findIndex((item) => item.key === sortBy),
    [sortBy, columnKeys],
  );

  const getSortParams = useCallback(
    (columnIndex: number): ThProps['sort'] => {
      if (columnIndex === 0) {
        return undefined;
      }
      return {
        sortBy: {
          index: sortByIndex,
          direction,
          defaultDirection: 'asc',
        },
        onSort: (_event, index, direction) => onSort(_event, columnKeys[index].key, direction),
        columnIndex,
      };
    },
    [columnKeys, direction, onSort, sortByIndex],
  );

  const columns: DataViewTh[] = useMemo(
    () =>
      columnKeys.map((column, index) => ({
        cell: column.label,
        props: { sort: getSortParams(index) },
      })),
    [getSortParams, columnKeys],
  );

  const prevNamespaceRef = useRef(namespace);
  useEffect(() => {
    // Only update filters when namespace changes
    if (prevNamespaceRef.current === namespace) {
      return;
    }
    prevNamespaceRef.current = namespace;

    if (namespace && namespace !== ALL_NAMESPACES_KEY) {
      // alert source filter should not be present when viewing in a specific namespace
      deleteFilter(AlertFilterOptions.SOURCE);
    } else if (namespace === ALL_NAMESPACES_KEY) {
      onSetFilters({ [AlertFilterOptions.SOURCE]: defaultAlertTenant });
    }
  }, [namespace, deleteFilter, onSetFilters, defaultAlertTenant]);

  useEffect(() => {
    // When changing filters change back to being on page 1
    pagination.onSetPage(undefined, 1);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const { page, perPage } = pagination;

  const { alerts, additionalAlertSourceLabels, alertClusterLabels, rulesAlertLoading, silences } =
    useAlerts();

  const aggregatedAlerts = useMemo(() => {
    const filteredAlerts = filterAlerts(alerts, filters, namespace, perspective);
    const aggregatedAlerts = getAggregateAlertsLists(filteredAlerts);
    return sortAggregatedAlerts(aggregatedAlerts, sortBy, direction);
  }, [alerts, namespace, filters, perspective, sortBy, direction]);
  const selectedPageOfAggregatedAlerts = useMemo(
    () => aggregatedAlerts.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    [aggregatedAlerts, page, perPage],
  );

  const loaded = !!rulesAlertLoading?.loaded;
  const loadError = rulesAlertLoading?.loadError ? rulesAlertLoading.loadError : undefined;

  const onFiltersChange = useMemo(
    () => (filterName: keyof AggregatedAlertFilters) => {
      return (_e, val) => {
        onSetFilters({ [filterName]: val });
      };
    },
    [onSetFilters],
  );

  const filterItems = useMemo<TableFilterProps<any>[]>(() => {
    const filtersVals: TableFilterProps<any>[] = [
      {
        filterId: AlertFilterOptions.NAME,
        type: TableFilterOption.TEXT,
        title: t('Alert Name'),
        placeholder: t('Filter by Name'),
        onChange: onFiltersChange(AlertFilterOptions.NAME),
        value: filters.name,
        ouiaId: 'AlertNameFilter',
      },
      {
        filterId: AlertFilterOptions.LABEL,
        type: TableFilterOption.LABEL,
        title: t('Label'),
        placeholder: t('Filter by Label'),
        onChange: onFiltersChange(AlertFilterOptions.LABEL),
        value: filters[AlertFilterOptions.LABEL],
        labelPath: 'labels',
        data: alerts,
      },
      {
        filterId: AlertFilterOptions.STATE,
        type: TableFilterOption.CHECKBOX,
        title: t('Alert State'),
        placeholder: t('Filter by State'),
        onChange: onFiltersChange(AlertFilterOptions.STATE),
        value: filters[AlertFilterOptions.STATE],
        options: [
          { value: AlertStates.Firing, label: t('Firing') },
          { value: AlertStates.Pending, label: t('Pending') },
          { value: AlertStates.Silenced, label: t('Silenced') },
        ],
        ouiaId: 'AlertStateFilter',
      },
      {
        filterId: AlertFilterOptions.SEVERITY,
        type: TableFilterOption.CHECKBOX,
        title: t('Severity'),
        placeholder: t('Filter by Severity'),
        onChange: onFiltersChange(AlertFilterOptions.SEVERITY),
        value: filters[AlertFilterOptions.SEVERITY],
        options: [
          { value: AlertSeverity.Critical, label: t('Critical') },
          { value: AlertSeverity.Warning, label: t('Warning') },
          { value: AlertSeverity.Info, label: t('Info') },
          { value: AlertSeverity.None, label: t('None') },
        ],
        ouiaId: 'AlertSeverityFilter',
      },
    ];
    if (namespace === ALL_NAMESPACES_KEY) {
      filtersVals.push({
        filterId: AlertFilterOptions.SOURCE,
        type: TableFilterOption.CHECKBOX,
        title: t('Source'),
        placeholder: t('Filter by Source'),
        onChange: onFiltersChange(AlertFilterOptions.SOURCE),
        value: filters[AlertFilterOptions.SOURCE],
        options: [
          { value: AlertSource.Platform, label: t('Platform') },
          { value: AlertSource.User, label: t('User') },
          ...additionalAlertSourceLabels,
        ],
        ouiaId: 'AlertSourceFilter',
      });
    }
    if (perspective === 'acm') {
      filtersVals.push({
        filterId: AlertFilterOptions.CLUSTER,
        type: TableFilterOption.CHECKBOX,
        title: t('Cluster'),
        placeholder: t('Filter by Cluster'),
        onChange: onFiltersChange(AlertFilterOptions.CLUSTER),
        value: filters[AlertFilterOptions.CLUSTER],
        options: alertClusterLabels.map((clusterName) => ({
          value: clusterName,
          label: clusterName?.length > 50 ? clusterName.slice(0, 50) + '...' : clusterName,
        })),
        ouiaId: 'AlertClusterFilter',
      });
    }
    return filtersVals;
  }, [
    filters,
    t,
    onFiltersChange,
    alerts,
    namespace,
    additionalAlertSourceLabels,
    perspective,
    alertClusterLabels,
  ]);

  return (
    <>
      <DocumentTitle>{t('Alerting')}</DocumentTitle>
      <PageSection hasBodyWrapper={false} type="subnav">
        {/* Only show the silences error when the alerts have loaded, since failing to load the
          silences doesn't matter if the alerts haven't loaded*/}
        {silences?.loadError && !loadError && (
          <SilencesNotLoadedWarning silencesLoadError={silences?.loadError} />
        )}
        {loaded && (
          <DataView>
            <TableToolbar
              clearAllFilters={clearAllFilters}
              filters={
                <TableFilters
                  activeAttributeMenu={activeAttributeMenu}
                  setActiveAttributeMenu={setActiveAttributeMenu}
                  filterItems={filterItems}
                >
                  {filterItems.map((filterItem) => (
                    <TableFilter
                      key={`table-filter-${filterItem.filterId}`}
                      {...filterItem}
                      showToolbarItem={filterItem.title === activeAttributeMenu}
                    />
                  ))}
                </TableFilters>
              }
              actions={
                <DownloadCSVButton loaded={loaded} filteredData={selectedPageOfAggregatedAlerts} />
              }
              pagination={
                <TablePagination
                  variant={PaginationVariant.top}
                  itemCount={aggregatedAlerts?.length}
                  {...pagination}
                />
              }
            />
            {selectedPageOfAggregatedAlerts?.length > 0 && (
              <>
                <Table gridBreakPoint={TableGridBreakpoint.none} role="presentation" isExpandable>
                  <DataViewTableHead columns={columns} />
                  {selectedPageOfAggregatedAlerts.map((aggregatedAlert, index) => (
                    <AggregateAlertTableRow
                      // eslint-disable-next-line max-len
                      key={`${aggregatedAlert.name}-${aggregatedAlert.state}-${aggregatedAlert.severity}`}
                      aggregatedAlert={aggregatedAlert}
                      rowData={{ rowIndex: index, selectedFilters: filters }}
                    />
                  ))}
                </Table>
                <DataViewToolbar
                  style={{ paddingTop: '16px' }}
                  pagination={
                    <TablePagination
                      itemCount={aggregatedAlerts?.length}
                      variant={PaginationVariant.bottom}
                      {...pagination}
                    />
                  }
                />
              </>
            )}
          </DataView>
        )}
        {loadError && <AccessDenied message={loadError.message} />}
        {loaded && selectedPageOfAggregatedAlerts?.length === 0 && !loadError && (
          <EmptyBox customMessage={t('No alerts found')} />
        )}
        {!loaded && <LoadingBox />}
      </PageSection>
    </>
  );
};
const AlertsPageWithFallback = withFallback(AlertsPage_);

const sortAggregatedAlerts = (
  data: AggregatedAlert[],
  sortBy: string | undefined,
  direction: 'asc' | 'desc' | undefined,
) => {
  if (!sortBy || !direction) {
    return data;
  }
  const directionMultiplier = direction === 'asc' ? 1 : -1;
  if (sortBy === rowFilter(AlertFilterOptions.NAME)) {
    return [...data].sort(
      (a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }) *
        directionMultiplier,
    );
  } else if (sortBy === rowFilter(AlertFilterOptions.SEVERITY)) {
    return [...data].sort((a, b) => severitySort(a, b) * directionMultiplier);
  } else if (sortBy === rowFilter('alert-total')) {
    return [...data].sort((a, b) => (a.alerts.length - b.alerts.length) * directionMultiplier);
  } else if (sortBy === rowFilter(AlertFilterOptions.STATE)) {
    return [...data].sort((a, b) => a.state.localeCompare(b.state) * directionMultiplier);
  }
  return data;
};

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
