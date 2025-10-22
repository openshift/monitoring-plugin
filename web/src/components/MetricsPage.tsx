import {
  DocumentTitle,
  ListPageHeader,
  NamespaceBar,
  PrometheusData,
  PrometheusEndpoint,
  PrometheusLabels,
  PrometheusResponse,
  useActiveNamespace,
  useResolvedExtensions,
  YellowExclamationTriangleIcon,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Bullseye,
  Button,
  DataList,
  DataListAction,
  DataListCell,
  DataListContent,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  DataListToggle,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  SelectOptionProps,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Switch,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { ChartLineIcon, CompressIcon } from '@patternfly/react-icons';
import {
  IFormatterValueType,
  InnerScrollContainer,
  ISortBy,
  ITransform,
  sortable,
  Table,
  TableGridBreakpoint,
  TableVariant,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  wrappable,
} from '@patternfly/react-table';
import * as _ from 'lodash-es';
import type { FC, Ref } from 'react';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import {
  queryBrowserAddQuery,
  queryBrowserDeleteAllQueries,
  queryBrowserDeleteQuery,
  queryBrowserDuplicateQuery,
  queryBrowserPatchQuery,
  queryBrowserRunQueries,
  queryBrowserSetAllExpanded,
  queryBrowserSetPollInterval,
  queryBrowserToggleAllSeries,
  queryBrowserToggleIsEnabled,
  queryBrowserToggleSeries,
  showGraphs,
  toggleGraphs,
} from '../store/actions';

import { getPrometheusBasePath, buildPrometheusUrl } from './utils';
import { AsyncComponent } from './console/utils/async';
import { usePoll } from './console/utils/poll-hook';
import {
  getAllQueryArguments,
  getQueryArgument,
  setAllQueryArguments,
} from './console/utils/router';
import { useSafeFetch } from './console/utils/safe-fetch-hook';

import {
  CustomDataSource,
  DataSource,
  isDataSource,
} from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import { MonitoringState } from '../store/store';
import { DropDownPollInterval } from './dropdown-poll-interval';
import { useBoolean } from './hooks/useBoolean';
import { getObserveState } from './hooks/usePerspective';
import KebabDropdown from './kebab-dropdown';
import { colors, Error, QueryBrowser } from './query-browser';
import { QueryParams } from './query-params';
import TablePagination from './table-pagination';
import { PrometheusAPIError } from './types';
import { TypeaheadSelect } from './TypeaheadSelect';
import { LoadingInline } from './console/console-shared/src/components/loading/LoadingInline';
import withFallback from './console/console-shared/error/fallbacks/withFallback';
import {
  t_global_spacer_md,
  t_global_spacer_sm,
  t_global_font_family_mono,
} from '@patternfly/react-tokens';
import { QueryParamProvider, StringParam, useQueryParam } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { GraphUnits, isGraphUnit } from './metrics/units';
import { SimpleSelect, SimpleSelectOption } from '@patternfly/react-templates';
import { valueFormatter } from './console/console-shared/src/components/query-browser/QueryBrowserTooltip';
import { ALL_NAMESPACES_KEY } from './utils';
import { MonitoringProvider } from '../contexts/MonitoringContext';
import { DataTestIDs } from './data-test';
import { useMonitoring } from '../hooks/useMonitoring';

// Stores information about the currently focused query input
let focusedQuery;

const predefinedQueriesAdmin: SelectOptionProps[] = [
  {
    name: 'CPU Usage',
    // eslint-disable-next-line max-len
    value: `sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate) by (pod)`,
  },
  {
    name: 'Memory Usage',
    // eslint-disable-next-line max-len
    value: `sum(container_memory_working_set_bytes{container!=""}) by (pod)`,
  },
  {
    name: 'Filesystem Usage',
    // eslint-disable-next-line max-len
    value: `topk(25, sort_desc(sum(pod:container_fs_usage_bytes:sum{container="",pod!=""}) BY (pod, namespace)))`,
  },
  {
    name: 'Receive bandwidth',
    value: `sum(irate(container_network_receive_bytes_total[2h])) by (pod)`,
  },
  {
    name: 'Transmit bandwidth',
    value: `sum(irate(container_network_transmit_bytes_total[2h])) by (pod)`,
  },
  {
    name: 'Rate of received packets',
    value: `sum(irate(container_network_receive_packets_total[2h])) by (pod)`,
  },
  {
    name: 'Rate of transmitted packets',
    value: `sum(irate(container_network_transmit_packets_total[2h])) by (pod)`,
  },
  {
    name: 'Rate of received packets dropped',
    value: `sum(irate(container_network_receive_packets_dropped_total[2h])) by (pod)`,
  },
  {
    name: 'Rate of transmitted packets dropped',
    value: `sum(irate(container_network_transmit_packets_dropped_total[2h])) by (pod)`,
  },
];

const devQueries = (activeNamespace: string) => {
  return [
    {
      name: 'CPU Usage',
      // eslint-disable-next-line max-len
      value: `sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{namespace='${activeNamespace}'}) by (pod)`,
    },
    {
      name: 'Memory Usage',
      // eslint-disable-next-line max-len
      value: `sum(container_memory_working_set_bytes{container!="", namespace='${activeNamespace}'}) by (pod)`,
    },
    {
      name: 'Filesystem Usage',
      // eslint-disable-next-line max-len
      value: `topk(25, sort_desc(sum(pod:container_fs_usage_bytes:sum{container="",pod!="",namespace='${activeNamespace}'}) BY (pod, namespace)))`,
    },
    {
      name: 'Receive bandwidth',
      // eslint-disable-next-line max-len
      value: `sum(irate(container_network_receive_bytes_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Transmit bandwidth',
      // eslint-disable-next-line max-len
      value: `sum(irate(container_network_transmit_bytes_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Rate of received packets',
      // eslint-disable-next-line max-len
      value: `sum(irate(container_network_receive_packets_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Rate of transmitted packets',
      // eslint-disable-next-line max-len
      value: `sum(irate(container_network_transmit_packets_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Rate of received packets dropped',
      // eslint-disable-next-line max-len
      value: `sum(irate(container_network_receive_packets_dropped_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Rate of transmitted packets dropped',
      // eslint-disable-next-line max-len
      value: `sum(irate(container_network_transmit_packets_dropped_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
  ];
};

const PreDefinedQueriesDropdown = () => {
  const [activeNamespace] = useActiveNamespace();
  const { plugin } = useMonitoring();

  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const queries: SelectOptionProps[] = useMemo(() => {
    if (activeNamespace === ALL_NAMESPACES_KEY) {
      return predefinedQueriesAdmin;
    }
    return devQueries(activeNamespace);
  }, [activeNamespace]);

  const dispatch = useDispatch();

  const queriesList = useSelector(
    (state: MonitoringState) =>
      // mcp does not support the metrics page in any perspective
      getObserveState(plugin, state).queryBrowser?.queries,
  );

  const insertPredefinedQuery = (query: string) => {
    const isInitialQueryEmpty =
      queriesList.length === 1 &&
      (queriesList[0]?.text === '' ||
        queriesList[0]?.text === null ||
        queriesList[0]?.text === undefined);
    const index = isInitialQueryEmpty ? 0 : queriesList.length;

    // Prevent the same selection from being added consecutively
    const lastQuery = queriesList[queriesList.length - 1];
    if (lastQuery.text === query) {
      return;
    }

    // Add current query selection to the Redux store which holds the list of queries.
    dispatch(queryBrowserPatchQuery(index, { isEnabled: true, query, text: query }));
  };

  return (
    <Grid>
      <GridItem>
        <label htmlFor="predefined-query-select-label">{t('Queries')}</label>
      </GridItem>
      <GridItem>
        <TypeaheadSelect
          placeholder={t('Select query')}
          onSelect={insertPredefinedQuery}
          options={queries}
        />
      </GridItem>
    </Grid>
  );
};

const MetricsActionsMenu: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useMonitoring();

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);

  const isAllExpanded = useSelector((state: MonitoringState) =>
    getObserveState(plugin, state).queryBrowser.queries.every((q) => q?.isExpanded),
  );

  const dispatch = useDispatch();
  const addQuery = useCallback(() => dispatch(queryBrowserAddQuery()), [dispatch]);

  const doDelete = () => {
    dispatch(queryBrowserDeleteAllQueries());
    focusedQuery = undefined;
  };

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={setClosed}
      onOpenChange={(open: boolean) => (open ? setIsOpen() : setClosed())}
      toggle={(toggleRef: Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={setIsOpen}
          isExpanded={isOpen}
          data-test={DataTestIDs.MetricsPageActionsDropdownButton}
        >
          Actions
        </MenuToggle>
      )}
      popperProps={{ position: 'right' }}
      shouldFocusToggleOnSelect
    >
      <DropdownList>
        <DropdownItem
          value={0}
          key="add-query"
          onClick={addQuery}
          data-test={DataTestIDs.MetricsPageAddQueryDropdownItem}
        >
          {t('Add query')}
        </DropdownItem>
        <DropdownItem
          value={1}
          key="expand-collapse-all"
          onClick={() => dispatch(queryBrowserSetAllExpanded(!isAllExpanded))}
          data-test={DataTestIDs.MetricsPageExpandCollapseAllDropdownItem}
        >
          {isAllExpanded ? t('Collapse all query tables') : t('Expand all query tables')}
        </DropdownItem>
        <DropdownItem
          value={2}
          key="delete-all-queries"
          onClick={doDelete}
          data-test={DataTestIDs.MetricsPageDeleteAllQueriesDropdownItem}
        >
          {t('Delete all queries')}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

export const ToggleGraph: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useMonitoring();

  const hideGraphs = useSelector(
    (state: MonitoringState) => !!getObserveState(plugin, state).hideGraphs,
  );

  const dispatch = useDispatch();
  const toggle = useCallback(() => dispatch(toggleGraphs()), [dispatch]);

  // Use an empty useEffect to get access to the cleanup function so that if graphs are
  // currently hidden then we show the graphs as we unmount
  useEffect(() => {
    return () => {
      dispatch(showGraphs());
    };
  }, [dispatch]);

  const icon = hideGraphs ? <ChartLineIcon /> : <CompressIcon />;

  return (
    <Flex justifyContent={{ default: 'justifyContentFlexEnd' }}>
      <FlexItem>
        <Button
          type="button"
          onClick={toggle}
          variant="link"
          data-test={DataTestIDs.MetricHideShowGraphButton}
        >
          {icon} {hideGraphs ? t('Show graph') : t('Hide graph')}
        </Button>
      </FlexItem>
    </Flex>
  );
};

const SeriesButton: FC<SeriesButtonProps> = ({ index, labels }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useMonitoring();

  const [colorIndex, isDisabled, isSeriesEmpty]: [number | null, boolean, boolean] = useSelector(
    (state: MonitoringState) => {
      const observe = getObserveState(plugin, state);
      const disabledSeries = observe.queryBrowser.queries[index]?.disabledSeries;
      if (_.some(disabledSeries, (s) => _.isEqual(s, labels))) {
        return [null, true, false];
      }

      const series = observe.queryBrowser.queries[index]?.series;
      if (_.isEmpty(series)) {
        return [null, false, true];
      }

      const colorOffset = observe.queryBrowser.queries
        .slice(0, index)
        .filter((q) => q?.isEnabled)
        .reduce((sum, q) => sum + _.size(q[series]), 0);
      const seriesIndex = _.findIndex(series, (s) => _.isEqual(s, labels));
      return [(colorOffset + seriesIndex) % colors.length, false, false];
    },
  );

  const dispatch = useDispatch();
  const toggleSeries = useCallback(
    () => dispatch(queryBrowserToggleSeries(index, labels)),
    [dispatch, index, labels],
  );

  if (isSeriesEmpty) {
    return null;
  }
  const title = isDisabled ? t('Show series') : t('Hide series');

  return (
    <Button
      icon=""
      aria-label={title}
      onClick={toggleSeries}
      style={colorIndex === null ? undefined : { backgroundColor: colors[colorIndex] }}
      title={title}
      type="button"
      variant="control"
      data-test={DataTestIDs.MetricsPageSeriesButton}
    />
  );
};

const QueryKebab: FC<{ index: number }> = ({ index }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useMonitoring();

  const isDisabledSeriesEmpty = useSelector((state: MonitoringState) =>
    _.isEmpty(getObserveState(plugin, state).queryBrowser?.queries[index]?.disabledSeries),
  );
  const isEnabled = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).queryBrowser?.queries[index]?.isEnabled,
  );

  const query = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).queryBrowser?.queries[index]?.query,
  );

  const queryTableData = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).queryBrowser?.queries[index]?.queryTableData ?? {
        rows: [],
        columns: [],
      },
  );

  const dispatch = useDispatch();

  const toggleIsEnabled = useCallback(
    () => dispatch(queryBrowserToggleIsEnabled(index)),
    [dispatch, index],
  );

  const toggleAllSeries = useCallback(
    () => dispatch(queryBrowserToggleAllSeries(index)),
    [dispatch, index],
  );

  const doDelete = useCallback(() => {
    dispatch(queryBrowserDeleteQuery(index));
    focusedQuery = undefined;
  }, [dispatch, index]);

  const doClone = useCallback(() => {
    dispatch(queryBrowserDuplicateQuery(index));
  }, [dispatch, index]);

  const isSpan = (item) => item?.title?.props?.children;
  const getSpanText = (item) => item.title.props.children;

  // Takes data from QueryTable and removes/replaces all html objects from columns and rows
  const convertQueryTable = () => {
    const getColumns = () => {
      const columns = queryTableData.columns;
      const csvColumnHeaders = columns.slice(1).map((columnHeader) => {
        if (typeof columnHeader?.title === 'string') {
          return columnHeader.title;
        } else if (isSpan(columnHeader)) {
          return getSpanText(columnHeader);
        } else {
          return '';
        }
      });
      return csvColumnHeaders;
    };
    const getRows = () => {
      const rows = queryTableData.rows;
      const csvRows = rows
        .map((row) => row.slice(1))
        .map((row) =>
          row.map((rowItem) => {
            return isSpan(rowItem) ? getSpanText(rowItem) : rowItem;
          }),
        );
      return csvRows;
    };
    const tableData = [getColumns(), ...getRows()];
    return tableData;
  };

  const getCsv = (array, delimiter = ',') =>
    array
      .map((row) =>
        row.map((rowItem) => (isNaN(rowItem) ? `"${rowItem}"` : rowItem)).join(delimiter),
      )
      .join('\n');

  const downloadCsv = (csvData) => {
    // Modified from https://codesandbox.io/p/sandbox/react-export-to-csv-l6uhq?file=%2Fsrc%2FApp.jsx%3A39%2C10-39%2C16
    const blob = new Blob([csvData], { type: 'data:text/csv;charset=utf-8,' });
    const blobURL = window.URL.createObjectURL(blob);
    // Create new tag for download file
    const anchor = document.createElement('a');
    anchor.download = `OpenShift_Metrics_QueryTable_${query}.csv`;
    anchor.href = blobURL;
    anchor.dataset.downloadurl = ['text/csv', anchor.download, anchor.href].join(':');
    anchor.click();
    // Remove URL.createObjectURL. The browser should not save the reference to the file.
    setTimeout(() => {
      // For Firefox it is necessary to delay revoking the ObjectURL
      URL.revokeObjectURL(blobURL);
    }, 100);
  };

  const doExportCsv = () => {
    const tableData = convertQueryTable();
    const csvData = getCsv(tableData);
    downloadCsv(csvData);
  };

  const exportDropdownItem = (
    <DropdownItem
      key="export"
      component="button"
      onClick={doExportCsv}
      data-test={DataTestIDs.MetricsPageExportCsvDropdownItem}
    >
      {t('Export as CSV')}
    </DropdownItem>
  );

  const defaultDropdownItems = [
    <DropdownItem
      key="toggle-query"
      component="button"
      onClick={toggleIsEnabled}
      data-test={DataTestIDs.MetricsPageDisableEnableQueryDropdownItem}
    >
      {isEnabled ? t('Disable query') : t('Enable query')}
    </DropdownItem>,
    isEnabled ? (
      <DropdownItem
        component="button"
        onClick={toggleAllSeries}
        key="toggle-all-series"
        data-test={DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem}
      >
        {isDisabledSeriesEmpty ? t('Hide all series') : t('Show all series')}
      </DropdownItem>
    ) : (
      <Tooltip
        key="toggle-all-series-disabled"
        position="left"
        content={t('Query must be enabled')}
      >
        <DropdownItem
          isAriaDisabled={true} // need to receive focus for tooltip to work
          component="button"
        >
          {isDisabledSeriesEmpty ? t('Hide all series') : t('Show all series')}
        </DropdownItem>
      </Tooltip>
    ),
    <DropdownItem
      key="delete"
      component="button"
      onClick={doDelete}
      data-test={DataTestIDs.MetricsPageDeleteQueryDropdownItem}
    >
      {t('Delete query')}
    </DropdownItem>,
    <DropdownItem
      key="duplicate"
      component="button"
      onClick={doClone}
      data-test={DataTestIDs.MetricsPageDuplicateQueryDropdownItem}
    >
      {t('Duplicate query')}
    </DropdownItem>,
  ];

  const hasQueryTableData = () => {
    if (!query || !queryTableData?.rows || !queryTableData?.columns) {
      return false;
    }
    return true;
  };

  const dropdownItems = hasQueryTableData()
    ? [...defaultDropdownItems, exportDropdownItem]
    : defaultDropdownItems;

  return <KebabDropdown dropdownItems={dropdownItems} />;
};

export const QueryTable: FC<QueryTableProps> = ({ index, namespace, customDatasource, units }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useMonitoring();

  const [data, setData] = useState<PrometheusData>();
  const [error, setError] = useState<PrometheusAPIError>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [sortBy, setSortBy] = useState<ISortBy>({});
  const valueFormat = valueFormatter(units);

  const isEnabled = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).queryBrowser.queries[index]?.isEnabled,
  );
  const isExpanded = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).queryBrowser.queries[index]?.isExpanded,
  );
  const pollInterval = useSelector(
    (state: MonitoringState) =>
      Number(getObserveState(plugin, state).queryBrowser.pollInterval) * 15 * 1000,
  );
  const query = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).queryBrowser.queries[index]?.query,
  );
  const series = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).queryBrowser.queries[index]?.series,
  );
  const span = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).queryBrowser.timespan,
  );

  const lastRequestTime = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).queryBrowser.lastRequestTime,
  );

  const dispatch = useDispatch();

  const toggleAllSeries = useCallback(
    () => dispatch(queryBrowserToggleAllSeries(index)),
    [dispatch, index],
  );

  const isDisabledSeriesEmpty = useSelector((state: MonitoringState) =>
    _.isEmpty(getObserveState(plugin, state).queryBrowser.queries[index]?.disabledSeries),
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);

  // If the namespace is defined getPrometheusURL will use
  // the PROMETHEUS_TENANCY_BASE_PATH for requests in the developer view
  const tick = () => {
    if (isEnabled && isExpanded && query) {
      safeFetch<PrometheusResponse>(
        buildPrometheusUrl({
          prometheusUrlProps: {
            endpoint: PrometheusEndpoint.QUERY,
            namespace,
            query,
          },
          basePath: getPrometheusBasePath({
            prometheus: 'cmo',
            namespace,
            basePathOverride: customDatasource?.basePath,
          }),
        }),
      )
        .then((response) => {
          setData(_.get(response, 'data'));
          setError(undefined);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setData(undefined);
            setError(err);
          }
        });
    }
  };

  usePoll(tick, pollInterval, namespace, query, span, lastRequestTime);

  useEffect(() => {
    setData(undefined);
    setError(undefined);
    setPage(1);
    setSortBy({});
  }, [namespace, query]);

  if (!isEnabled || !isExpanded || !query) {
    return null;
  }

  if (error) {
    return <Error error={error} title={t('Error loading values')} />;
  }

  if (!data) {
    return <LoadingInline />;
  }

  // Add any data series from `series` (those displayed in the graph) that are not in `data.result`.
  // This happens for queries that exclude a series currently, but included that same series at some
  // point during the graph's range.
  const expiredSeries = _.differenceWith(series, data.result, (s, r) => _.isEqual(s, r.metric));
  const result = expiredSeries.length
    ? [...data.result, ...expiredSeries.map((metric) => ({ metric }))]
    : data.result;

  if (!result || result.length === 0) {
    return (
      <div data-test={DataTestIDs.MetricsPageYellowNoDatapointsFound}>
        <YellowExclamationTriangleIcon /> {t('No datapoints found.')}
      </div>
    );
  }

  const transforms: ITransform[] = [sortable, wrappable];

  const buttonCell = (labels) => ({ title: <SeriesButton index={index} labels={labels} /> });

  let columns, rows;
  if (data.resultType === 'scalar') {
    columns = [
      '',
      {
        title: t('Value'),
        transforms,
        cellTransforms: [
          (data: IFormatterValueType) => {
            const val = data?.title ? data.title : data;
            return !Number.isNaN(Number(val)) ? valueFormat(Number(val)) : val;
          },
        ],
      },
    ];
    rows = [[buttonCell({}), _.get(result, '[1]')]];
  } else if (data.resultType === 'string') {
    columns = [
      {
        title: t('Value'),
        transforms,
        cellTransforms: [
          (data: IFormatterValueType) => {
            const val = data?.title ? data.title : data;
            return !Number.isNaN(Number(val)) ? valueFormat(Number(val)) : val;
          },
        ],
      },
    ];
    rows = [[result?.[1]]];
  } else {
    const allLabelKeys = _.uniq(_.flatMap(result, ({ metric }) => Object.keys(metric))).sort();

    columns = [
      '',
      ...allLabelKeys.map((k) => ({
        title: <span>{k === '__name__' ? t('Name') : k}</span>,
        transforms,
      })),
      {
        title: t('Value'),
        transforms,
        cellTransforms: [
          (data: IFormatterValueType) => {
            const val = data?.title ? data.title : data;
            return !Number.isNaN(Number(val)) ? valueFormat(Number(val)) : val;
          },
        ],
      },
    ];

    let rowMapper;
    if (data.resultType === 'matrix') {
      rowMapper = ({ metric, values }) => [
        '',
        ..._.map(allLabelKeys, (k) => metric[k]),
        {
          title: (
            <>
              {_.map(values, ([time, v]) => (
                <div key={time}>
                  {v}&nbsp;@{time}
                </div>
              ))}
            </>
          ),
        },
      ];
    } else {
      rowMapper = ({ metric, value }) => [
        buttonCell(metric),
        ..._.map(allLabelKeys, (k) => metric[k]),
        _.get(value, '[1]', { title: <span>{t('None')}</span> }),
      ];
    }

    rows = _.map(result, rowMapper);
    if (sortBy) {
      // Sort Values column numerically and sort all the other columns alphabetically
      const valuesColIndex = allLabelKeys.length + 1;
      const sort =
        sortBy.index === valuesColIndex
          ? (cells) => {
              const v = Number(cells[valuesColIndex]);
              return Number.isNaN(v) ? 0 : v;
            }
          : `${sortBy.index}`;
      rows = _.orderBy(rows, [sort], [sortBy.direction]);
    }
  }

  // Dispatch query table result so QueryKebab can access it for data export
  dispatch(queryBrowserPatchQuery(index, { queryTableData: { columns, rows } }));

  const onSort = (e, i, direction) => setSortBy({ index: i, direction });

  const tableRows = rows.slice((page - 1) * perPage, page * perPage).map((cells) => ({ cells }));

  return (
    <>
      <Button
        variant="link"
        isInline
        onClick={toggleAllSeries}
        data-test={DataTestIDs.MetricsPageSelectAllUnselectAllButton}
      >
        {isDisabledSeriesEmpty ? t('Unselect all') : t('Select all')}
      </Button>
      <InnerScrollContainer>
        <Table
          aria-label={t('query results table')}
          gridBreakPoint={TableGridBreakpoint.none}
          rows={tableRows.length}
          variant={TableVariant.compact}
          data-test={DataTestIDs.MetricsPageQueryTable}
        >
          <Thead>
            <Tr>
              {columns.map((col, columnIndex) => {
                const sortParams =
                  columnIndex !== 0
                    ? {
                        sort: {
                          sortBy,
                          onSort,
                          columnIndex,
                        },
                      }
                    : {};
                return (
                  <Th modifier="nowrap" key={`${col.title}-${columnIndex}`} {...sortParams}>
                    {col.title}
                  </Th>
                );
              })}
            </Tr>
          </Thead>
          <Tbody>
            {tableRows.map((row, rowIndex) => (
              <Tr key={`row-${rowIndex}`}>
                {row.cells?.map((cell, cellIndex) => (
                  <Td
                    style={{ fontFamily: t_global_font_family_mono.var }}
                    key={`cell-${rowIndex}-${cellIndex}`}
                  >
                    {columns[cellIndex].cellTransforms
                      ? columns[cellIndex].cellTransforms[0](
                          typeof cell === 'string' ? cell : cell?.title,
                        )
                      : typeof cell === 'string'
                      ? cell
                      : cell?.title}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </InnerScrollContainer>
      <TablePagination
        itemCount={rows.length}
        page={page}
        perPage={perPage}
        setPage={setPage}
        setPerPage={setPerPage}
      />
    </>
  );
};

const PromQLExpressionInput = (props) => (
  <AsyncComponent
    loader={() => import('./metrics/promql-expression-input').then((c) => c.PromQLExpressionInput)}
    {...props}
  />
);

const Query: FC<{
  index: number;
  customDatasource?: CustomDataSource;
  units: GraphUnits;
}> = ({ index, customDatasource, units }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useMonitoring();

  const id = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).queryBrowser.queries[index]?.id,
  );
  const isEnabled = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).queryBrowser.queries[index]?.isEnabled,
  );
  const isExpanded = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).queryBrowser.queries[index]?.isExpanded,
  );
  const text = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).queryBrowser.queries[index]?.text ?? '',
  );

  const dispatch = useDispatch();

  const toggleIsEnabled = useCallback(
    () => dispatch(queryBrowserToggleIsEnabled(index)),
    [dispatch, index],
  );

  const handleTextChange = useCallback(
    (value: string) => {
      dispatch(queryBrowserPatchQuery(index, { text: value }));
    },
    [dispatch, index],
  );

  const handleExecuteQueries = useCallback(() => {
    dispatch(queryBrowserRunQueries());
  }, [dispatch]);

  const handleSelectionChange = (
    target: { focus: () => void; setSelectionRange: (start: number, end: number) => void },
    start: number,
    end: number,
  ) => {
    focusedQuery = { index, selection: { start, end }, target };
  };

  const switchKey = `${id}-${isEnabled}`;
  const switchLabel = isEnabled ? t('Disable query') : t('Enable query');

  const [activeNamespace] = useActiveNamespace();

  const queryKebab = <QueryKebab index={index} />;
  const querySwitch = (
    <div title={switchLabel} style={{ marginTop: t_global_spacer_sm.var }}>
      <Switch
        aria-label={switchLabel}
        id={switchKey}
        isChecked={isEnabled}
        key={switchKey}
        onChange={toggleIsEnabled}
        data-test={DataTestIDs.MetricsPageDisableEnableQuerySwitch}
      />
    </div>
  );
  const promQLExpressionInput = (
    <PromQLExpressionInput
      value={text}
      onValueChange={handleTextChange}
      onExecuteQuery={handleExecuteQueries}
      onSelectionChange={handleSelectionChange}
    />
  );
  const queryId = `metrics-query-${index}`;

  // If namespace is defined getPrometheusURL() will use the
  //     PROMETHEUS_TENANCY_BASE_PATH for the developer view

  return (
    <DataListItem aria-labelledby={`query-item-${queryId}`} isExpanded={isExpanded}>
      <DataListItemRow>
        <DataListToggle
          onClick={toggleIsEnabled}
          isExpanded={isExpanded}
          buttonProps={{ isInline: true }}
          id={`toggle-${queryId}`}
          aria-controls={`query-expand-${queryId}`}
          data-test={DataTestIDs.MetricsPageExpandCollapseRowButton}
        />
        <DataListItemCells
          dataListCells={[
            <DataListCell
              width={5}
              key="width 5"
              style={{ paddingTop: t_global_spacer_md.var, paddingBottom: 0 }}
            >
              {promQLExpressionInput}
            </DataListCell>,
          ]}
          style={{ paddingBottom: 0 }}
        />
        <DataListAction
          aria-labelledby={`query-item-${queryId} query-action-${queryId}`}
          id={`action-${queryId}`}
          aria-label="Actions"
        >
          {querySwitch}
          {queryKebab}
        </DataListAction>
      </DataListItemRow>
      <DataListContent
        aria-label="Expandable content details"
        id={`query-expand-${queryId}`}
        isHidden={!isExpanded}
      >
        <QueryTable
          index={index}
          customDatasource={customDatasource}
          namespace={activeNamespace}
          units={units}
        />
      </DataListContent>
    </DataListItem>
  );
};

const QueryBrowserWrapper: FC<{
  customDataSourceName: string;
  customDataSource: CustomDataSource;
  customDatasourceError: boolean;
  units: GraphUnits;
}> = ({ customDataSourceName, customDataSource, customDatasourceError, units }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [activeNamespace] = useActiveNamespace();
  const { plugin } = useMonitoring();

  const dispatch = useDispatch();

  const hideGraphs = useSelector(
    (state: MonitoringState) => !!getObserveState(plugin, state).hideGraphs,
  );
  const queries = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).queryBrowser?.queries,
  );

  // Initialize queries from URL parameters
  useEffect(() => {
    dispatch(queryBrowserDeleteAllQueries());
    const searchParams = getAllQueryArguments();
    for (let i = 0; _.has(searchParams, `query${i}`); i++) {
      const query = searchParams[`query${i}`];
      dispatch(
        queryBrowserPatchQuery(i, {
          isEnabled: true,
          isExpanded: true,
          query,
          text: query,
        }),
      );
    }
  }, [dispatch]);

  /* eslint-disable react-hooks/exhaustive-deps */
  // Use React.useMemo() to prevent these two arrays being recreated on every render, which would
  // trigger unnecessary re-renders of QueryBrowser, which can be quite slow
  const queriesMemoKey = JSON.stringify(_.map(queries, 'query'));
  const queryStrings = useMemo(() => _.map(queries, 'query'), [queriesMemoKey]);
  const disabledSeriesMemoKey = JSON.stringify(
    _.reject(_.map(queries, 'disabledSeries'), _.isEmpty),
  );
  const disabledSeries = useMemo<PrometheusLabels[][]>(
    () => _.map(queries, 'disabledSeries'),
    [disabledSeriesMemoKey],
  );

  // Update the URL parameters when the queries shown in the graph change
  useEffect(() => {
    const newParams: Record<string, string> = {};
    _.each(queryStrings, (q, i) => (newParams[`query${i}`] = q || ''));
    if (customDataSourceName) {
      newParams.datasource = customDataSourceName;
    }
    setAllQueryArguments(newParams);
  }, [queryStrings, customDataSourceName]);

  if (hideGraphs) {
    return null;
  }

  const insertExampleQuery = () => {
    const focusedIndex = focusedQuery?.index ?? 0;
    const index = queries[focusedIndex] ? focusedIndex : 0;
    const text = 'sort_desc(sum(sum_over_time(ALERTS{alertstate="firing"}[24h])) by (alertname))';
    dispatch(queryBrowserPatchQuery(index, { isEnabled: true, query: text, text }));
  };

  if (customDataSourceName && customDatasourceError) {
    return (
      <EmptyState
        titleText={
          <Title headingLevel="h2" size="md">
            {t('Error loading custom data source')}
          </Title>
        }
        icon={ChartLineIcon}
        variant={EmptyStateVariant.full}
      >
        <EmptyStateBody>
          {t('An error occurred while loading the custom data source.')}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  if (queryStrings.join('') === '') {
    return (
      <EmptyState
        titleText={
          <Title headingLevel="h2" size="md" data-test={DataTestIDs.MetricsPageNoQueryEnteredTitle}>
            {t('No query entered')}
          </Title>
        }
        icon={ChartLineIcon}
        variant={EmptyStateVariant.full}
      >
        <EmptyStateBody data-test={DataTestIDs.MetricsPageNoQueryEntered}>
          {t('Enter a query in the box below to explore metrics for this cluster.')}
        </EmptyStateBody>
        <Button
          onClick={insertExampleQuery}
          variant="primary"
          data-test={DataTestIDs.MetricsPageInsertExampleQueryButton}
        >
          {t('Insert example query')}
        </Button>
      </EmptyState>
    );
  }

  return (
    <QueryBrowser
      customDataSource={customDataSource}
      defaultTimespan={30 * 60 * 1000}
      disabledSeries={disabledSeries}
      queries={queryStrings}
      units={units}
      showStackedControl
      showDisconnectedControl
      useTenancy={activeNamespace !== ALL_NAMESPACES_KEY}
    />
  );
};

const AddQueryButton: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const dispatch = useDispatch();
  const addQuery = useCallback(() => dispatch(queryBrowserAddQuery()), [dispatch]);

  return (
    <Button
      onClick={addQuery}
      type="button"
      variant="secondary"
      data-test={DataTestIDs.MetricsPageAddQueryButton}
    >
      {t('Add query')}
    </Button>
  );
};

const RunQueriesButton: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const dispatch = useDispatch();
  const runQueries = useCallback(() => dispatch(queryBrowserRunQueries()), [dispatch]);

  return (
    <Button
      onClick={runQueries}
      type="submit"
      variant="primary"
      data-test={DataTestIDs.MetricsPageRunQueriesButton}
    >
      {t('Run queries')}
    </Button>
  );
};

const QueriesList: FC<{ customDatasource?: CustomDataSource; units: GraphUnits }> = ({
  customDatasource,
  units,
}) => {
  const { plugin } = useMonitoring();
  const count = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).queryBrowser.queries.length,
  );

  return (
    <DataList aria-label={`queries`}>
      {_.range(count).map((index) => {
        const reversedIndex = count - index - 1;
        return (
          <Query
            index={reversedIndex}
            key={reversedIndex}
            customDatasource={customDatasource}
            units={units}
          />
        );
      })}
    </DataList>
  );
};

const IntervalDropdown = () => {
  const { plugin } = useMonitoring();
  const dispatch = useDispatch();
  const setInterval = useCallback(
    (v: number) => dispatch(queryBrowserSetPollInterval(v)),
    [dispatch],
  );
  const pollInterval = useSelector(
    (state: MonitoringState) =>
      Number(getObserveState(plugin, state).queryBrowser.pollInterval) * 15 * 1000,
  );
  return <DropDownPollInterval setInterval={setInterval} selectedInterval={pollInterval} />;
};

const GraphUnitsDropDown: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [selectedUnits, setUnits] = useQueryParam(QueryParams.Units, StringParam);

  const initialOptions = useMemo<SimpleSelectOption[]>(() => {
    const intervalOptions: SimpleSelectOption[] = [
      { content: t('Bytes Binary (KiB, MiB)'), value: 'bytes' },
      { content: t('Bytes Decimal (kb, MB)'), value: 'Bytes' },
      { content: t('Bytes Binary Per Second (KiB/s, MiB/s)'), value: 'bps' },
      { content: t('Bytes Decimal Per Second (kB/s, MB/s)'), value: 'Bps' },
      { content: t('Packets Per Second'), value: 'pps' },
      { content: t('Miliseconds'), value: 'ms' },
      { content: t('Seconds'), value: 's' },
      { content: t('Percentage'), value: 'percentunit' },
      { content: t('No Units'), value: 'short' },
    ];
    return intervalOptions.map((o) => ({ ...o, selected: o.value === selectedUnits }));
  }, [selectedUnits, t]);

  const onSelect = (_ev: React.MouseEvent<Element, MouseEvent>, selection: string) => {
    setUnits(selection);
  };

  return (
    <SimpleSelect
      initialOptions={initialOptions}
      onSelect={(_ev, selection: string) => onSelect(_ev, selection)}
      toggleWidth="300px"
    />
  );
};

const MetricsPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [units, setUnits] = useQueryParam(QueryParams.Units, StringParam);
  const [queryNamespace, setQueryNamespace] = useQueryParam(QueryParams.Namespace, StringParam);
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();

  useEffect(() => {
    if (queryNamespace && activeNamespace !== queryNamespace) {
      setActiveNamespace(queryNamespace);
    }
  }, [queryNamespace, activeNamespace, setActiveNamespace]);

  const dispatch = useDispatch();

  useEffect(() => {
    if (!isGraphUnit(units)) {
      setUnits('short');
    }
  }, [units, setUnits]);

  // Clear queries on unmount
  useEffect(() => {
    return () => {
      dispatch(queryBrowserDeleteAllQueries());
    };
  }, [dispatch]);
  const [customDataSource, setCustomDataSource] = useState<CustomDataSource>(undefined);
  const [customDataSourceIsResolved, setCustomDataSourceIsResolved] = useState<boolean>(false);
  const customDataSourceName = getQueryArgument(QueryParams.Datasource);
  const [extensions, extensionsResolved] = useResolvedExtensions<DataSource>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);
  const [customDatasourceError, setCustomDataSourceError] = useState(false);

  // get custom datasources
  useEffect(() => {
    const getCustomDataSource = async () => {
      if (!customDataSourceName) {
        setCustomDataSource(null);
        return;
      } else if (extensionsResolved) {
        setCustomDataSource({ basePath: '', dataSourceType: 'prometheus' });

        if (!hasExtensions) {
          setCustomDataSourceError(true);
          return;
        }

        const extension = extensions.find(
          (ext) => ext?.properties?.contextId === 'monitoring-dashboards',
        );

        if (!extension) {
          setCustomDataSourceError(true);
          return;
        }

        const getDataSource = extension?.properties?.getDataSource;
        const dataSource = await getDataSource?.(customDataSourceName);

        if (!dataSource || !dataSource.basePath) {
          setCustomDataSourceError(true);
          return;
        }

        setCustomDataSource(dataSource);
        setCustomDataSourceIsResolved(true);
      }
    };
    getCustomDataSource().catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      setCustomDataSourceError(true);
    });
  }, [extensions, extensionsResolved, customDataSourceName, hasExtensions]);

  if (customDataSourceName) {
    if (!extensionsResolved || (!customDataSourceIsResolved && !customDatasourceError)) {
      return (
        <PageSection hasBodyWrapper={false}>
          <Bullseye>
            <LoadingInline />
          </Bullseye>
        </PageSection>
      );
    }
  }

  return (
    <>
      <DocumentTitle>{t('Metrics')}</DocumentTitle>
      <NamespaceBar
        onNamespaceChange={(namespace) => {
          dispatch(queryBrowserDeleteAllQueries());
          setQueryNamespace(namespace);
        }}
      />
      <ListPageHeader title={t('Metrics')}>
        <Split hasGutter>
          <SplitItem data-test={DataTestIDs.MetricGraphUnitsDropDown}>
            <Tooltip content={<>{t('This dropdown only formats results.')}</>}>
              <GraphUnitsDropDown />
            </Tooltip>
          </SplitItem>
          <SplitItem data-test={DataTestIDs.MetricDropdownPollInterval}>
            <IntervalDropdown />
          </SplitItem>
          <SplitItem>
            <MetricsActionsMenu />
          </SplitItem>
        </Split>
      </ListPageHeader>
      <PageSection hasBodyWrapper={false}>
        <Stack hasGutter>
          <StackItem>
            <ToggleGraph />
          </StackItem>
          <StackItem>
            <QueryBrowserWrapper
              customDataSource={customDataSource}
              customDataSourceName={customDataSourceName}
              customDatasourceError={customDatasourceError}
              units={units as GraphUnits}
            />
          </StackItem>
          <StackItem>
            <Flex alignItems={{ default: 'alignItemsFlexEnd' }}>
              <FlexItem>
                <PreDefinedQueriesDropdown />
              </FlexItem>
              <FlexItem grow={{ default: 'grow' }} />
              <FlexItem>
                <AddQueryButton />
              </FlexItem>
              <FlexItem>
                <RunQueriesButton />
              </FlexItem>
            </Flex>
          </StackItem>
          <StackItem>
            <QueriesList customDatasource={customDataSource} units={units as GraphUnits} />
          </StackItem>
        </Stack>
      </PageSection>
    </>
  );
};

const MetricsPage = withFallback(MetricsPage_);

export const MpCmoMetricsPage: React.FC = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <MetricsPage />
      </QueryParamProvider>
    </MonitoringProvider>
  );
};

type QueryTableProps = {
  index: number;
  namespace?: string;
  customDatasource?: CustomDataSource;
  units: GraphUnits;
};

type SeriesButtonProps = {
  index: number;
  labels: PrometheusLabels;
};
