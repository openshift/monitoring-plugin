import {
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
  ISortBy,
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
import * as React from 'react';
import { Helmet } from 'react-helmet';
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
  toggleGraphs,
} from '../actions/observe';

import { getPrometheusURL } from './console/graphs/helpers';
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
import { MonitoringState } from '../reducers/observe';
import { DropDownPollInterval } from './dropdown-poll-interval';
import { useBoolean } from './hooks/useBoolean';
import { getLegacyObserveState, usePerspective } from './hooks/usePerspective';
import KebabDropdown from './kebab-dropdown';
import { colors, Error, QueryBrowser } from './query-browser';
import { QueryParams } from './query-params';
import TablePagination from './table-pagination';
import { PrometheusAPIError } from './types';
import { TypeaheadSelect } from './TypeaheadSelect';
import { LoadingInline } from './console/console-shared/src/components/loading/LoadingInline';
import withFallback from './console/console-shared/error/fallbacks/withFallback';
import { t_global_spacer_md, t_global_spacer_sm } from '@patternfly/react-tokens';

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

export const PreDefinedQueriesDropdown = () => {
  const [activeNamespace] = useActiveNamespace();
  const { perspective } = usePerspective();

  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const queries: SelectOptionProps[] = React.useMemo(() => {
    switch (perspective) {
      case 'dev':
        return devQueries(activeNamespace);
      case 'admin':
      case 'virtualization-perspective':
        return predefinedQueriesAdmin;
      // TODO: Add ACM queries
      default:
        return [];
    }
  }, [activeNamespace, perspective]);

  const dispatch = useDispatch();

  const queriesList = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'queries']),
  );

  const insertPredefinedQuery = (query: string) => {
    const queriesListDetails = queriesList.toJS();
    const isInitialQueryEmpty =
      queriesList.size === 1 &&
      (queriesListDetails[0]?.text === '' ||
        queriesListDetails[0]?.text === null ||
        queriesListDetails[0]?.text === undefined);
    const index = isInitialQueryEmpty ? 0 : queriesList.size;

    // Prevent the same selection from being added consecutively
    const lastQuery = queriesListDetails[queriesListDetails.length - 1];
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

const MetricsActionsMenu: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);

  const isAllExpanded = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)
      ?.getIn(['queryBrowser', 'queries'])
      .every((q) => q.get('isExpanded')),
  );

  const dispatch = useDispatch();
  const addQuery = React.useCallback(() => dispatch(queryBrowserAddQuery()), [dispatch]);

  const doDelete = () => {
    dispatch(queryBrowserDeleteAllQueries());
    focusedQuery = undefined;
  };

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={setClosed}
      onOpenChange={(open: boolean) => (open ? setIsOpen() : setClosed())}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle ref={toggleRef} onClick={setIsOpen} isExpanded={isOpen}>
          Actions
        </MenuToggle>
      )}
      popperProps={{ position: 'right' }}
      shouldFocusToggleOnSelect
    >
      <DropdownList>
        <DropdownItem value={0} key="add-query" onClick={addQuery}>
          {t('Add query')}
        </DropdownItem>
        <DropdownItem
          value={1}
          key="expand-collapse-all"
          onClick={() => dispatch(queryBrowserSetAllExpanded(!isAllExpanded))}
        >
          {isAllExpanded ? t('Collapse all query tables') : t('Expand all query tables')}
        </DropdownItem>
        <DropdownItem value={2} key="delete-all-queries" onClick={doDelete}>
          {t('Delete all queries')}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

export const ToggleGraph: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const hideGraphs = useSelector(
    (state: MonitoringState) => !!getLegacyObserveState(perspective, state)?.get('hideGraphs'),
  );

  const dispatch = useDispatch();
  const toggle = React.useCallback(() => dispatch(toggleGraphs()), [dispatch]);

  const icon = hideGraphs ? <ChartLineIcon /> : <CompressIcon />;

  return (
    <Flex justifyContent={{ default: 'justifyContentFlexEnd' }}>
      <FlexItem>
        <Button type="button" onClick={toggle} variant="link">
          {icon} {hideGraphs ? t('Show graph') : t('Hide graph')}
        </Button>
      </FlexItem>
    </Flex>
  );
};

const SeriesButton: React.FC<SeriesButtonProps> = ({ index, labels }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const [colorIndex, isDisabled, isSeriesEmpty] = useSelector((state: MonitoringState) => {
    const observe = getLegacyObserveState(perspective, state);
    const disabledSeries = observe.getIn(['queryBrowser', 'queries', index, 'disabledSeries']);
    if (_.some(disabledSeries, (s) => _.isEqual(s, labels))) {
      return [null, true, false];
    }

    const series = observe.getIn(['queryBrowser', 'queries', index, 'series']);
    if (_.isEmpty(series)) {
      return [null, false, true];
    }

    const colorOffset = observe
      .getIn(['queryBrowser', 'queries'])
      .take(index)
      .filter((q) => q.get('isEnabled'))
      .reduce((sum, q) => sum + _.size(q.get('series')), 0);
    const seriesIndex = _.findIndex(series, (s) => _.isEqual(s, labels));
    return [(colorOffset + seriesIndex) % colors.length, false, false];
  });

  const dispatch = useDispatch();
  const toggleSeries = React.useCallback(
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
    />
  );
};

const QueryKebab: React.FC<{ index: number }> = ({ index }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const isDisabledSeriesEmpty = useSelector((state: MonitoringState) =>
    _.isEmpty(
      getLegacyObserveState(perspective, state)?.getIn([
        'queryBrowser',
        'queries',
        index,
        'disabledSeries',
      ]),
    ),
  );
  const isEnabled = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn([
      'queryBrowser',
      'queries',
      index,
      'isEnabled',
    ]),
  );

  const query = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'queries', index, 'query']),
  );

  const queryTableData = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn([
      'queryBrowser',
      'queries',
      index,
      'queryTableData',
    ]),
  );

  const dispatch = useDispatch();

  const toggleIsEnabled = React.useCallback(
    () => dispatch(queryBrowserToggleIsEnabled(index)),
    [dispatch, index],
  );

  const toggleAllSeries = React.useCallback(
    () => dispatch(queryBrowserToggleAllSeries(index)),
    [dispatch, index],
  );

  const doDelete = React.useCallback(() => {
    dispatch(queryBrowserDeleteQuery(index));
    focusedQuery = undefined;
  }, [dispatch, index]);

  const doClone = React.useCallback(() => {
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
    <DropdownItem key="export" component="button" onClick={doExportCsv}>
      {t('Export as CSV')}
    </DropdownItem>
  );

  const defaultDropdownItems = [
    <DropdownItem key="toggle-query" component="button" onClick={toggleIsEnabled}>
      {isEnabled ? t('Disable query') : t('Enable query')}
    </DropdownItem>,
    isEnabled ? (
      <DropdownItem component="button" onClick={toggleAllSeries} key="toggle-all-series">
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
    <DropdownItem key="delete" component="button" onClick={doDelete}>
      {t('Delete query')}
    </DropdownItem>,
    <DropdownItem key="duplicate" component="button" onClick={doClone}>
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

export const QueryTable: React.FC<QueryTableProps> = ({ index, namespace, customDatasource }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const [data, setData] = React.useState<PrometheusData>();
  const [error, setError] = React.useState<PrometheusAPIError>();
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(50);
  const [sortBy, setSortBy] = React.useState<ISortBy>({});

  const isEnabled = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn([
      'queryBrowser',
      'queries',
      index,
      'isEnabled',
    ]),
  );
  const isExpanded = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn([
      'queryBrowser',
      'queries',
      index,
      'isExpanded',
    ]),
  );
  const pollInterval = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'pollInterval'], 15 * 1000),
  );
  const query = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'queries', index, 'query']),
  );
  const series = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'queries', index, 'series']),
  );
  const span = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'timespan']),
  );

  const lastRequestTime = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'lastRequestTime']),
  );

  const dispatch = useDispatch();

  const toggleAllSeries = React.useCallback(
    () => dispatch(queryBrowserToggleAllSeries(index)),
    [dispatch, index],
  );

  const isDisabledSeriesEmpty = useSelector((state: MonitoringState) =>
    _.isEmpty(
      getLegacyObserveState(perspective, state)?.getIn([
        'queryBrowser',
        'queries',
        index,
        'disabledSeries',
      ]),
    ),
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = React.useCallback(useSafeFetch(), []);

  // If the namespace is defined getPrometheusURL will use
  // the PROMETHEUS_TENANCY_BASE_PATH for requests in the developer view
  const tick = () => {
    if (isEnabled && isExpanded && query) {
      safeFetch<PrometheusResponse>(
        getPrometheusURL(
          {
            endpoint: PrometheusEndpoint.QUERY,
            namespace: perspective === 'dev' ? namespace : '',
            query,
          },
          perspective,
          customDatasource?.basePath,
        ),
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

  React.useEffect(() => {
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
      <div>
        <YellowExclamationTriangleIcon /> {t('No datapoints found.')}
      </div>
    );
  }

  const transforms = [sortable, wrappable];

  const buttonCell = (labels) => ({ title: <SeriesButton index={index} labels={labels} /> });

  let columns, rows;
  if (data.resultType === 'scalar') {
    columns = ['', { title: t('Value'), transforms }];
    rows = [[buttonCell({}), _.get(result, '[1]')]];
  } else if (data.resultType === 'string') {
    columns = [{ title: t('Value'), transforms }];
    rows = [[result?.[1]]];
  } else {
    const allLabelKeys = _.uniq(_.flatMap(result, ({ metric }) => Object.keys(metric))).sort();

    columns = [
      '',
      ...allLabelKeys.map((k) => ({
        title: <span>{k === '__name__' ? t('Name') : k}</span>,
        transforms,
      })),
      { title: t('Value'), transforms },
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
      <Button variant="link" isInline onClick={toggleAllSeries}>
        {isDisabledSeriesEmpty ? t('Unselect all') : t('Select all')}
      </Button>
      <Table
        aria-label={t('query results table')}
        gridBreakPoint={TableGridBreakpoint.none}
        rows={tableRows.length}
        variant={TableVariant.compact}
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
                <Th key={`${col.title}-${columnIndex}`} {...sortParams}>
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
                <Td key={`cell-${rowIndex}-${cellIndex}`}>
                  {typeof cell === 'string' ? cell : cell?.title}
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
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

const Query: React.FC<{ index: number; customDatasource?: CustomDataSource }> = ({
  index,
  customDatasource,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const id = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'queries', index, 'id']),
  );
  const isEnabled = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn([
      'queryBrowser',
      'queries',
      index,
      'isEnabled',
    ]),
  );
  const isExpanded = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn([
      'queryBrowser',
      'queries',
      index,
      'isExpanded',
    ]),
  );
  const text = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(
      ['queryBrowser', 'queries', index, 'text'],
      '',
    ),
  );

  const dispatch = useDispatch();

  const toggleIsEnabled = React.useCallback(
    () => dispatch(queryBrowserToggleIsEnabled(index)),
    [dispatch, index],
  );

  const handleTextChange = React.useCallback(
    (value: string) => {
      dispatch(queryBrowserPatchQuery(index, { text: value }));
    },
    [dispatch, index],
  );

  const handleExecuteQueries = React.useCallback(() => {
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
  const queryTable = (
    <QueryTable
      index={index}
      customDatasource={customDatasource}
      namespace={perspective === 'dev' ? activeNamespace : undefined}
    />
  );

  return (
    <DataListItem aria-labelledby={`query-item-${queryId}`} isExpanded={isExpanded}>
      <DataListItemRow>
        <DataListToggle
          onClick={toggleIsEnabled}
          isExpanded={isExpanded}
          buttonProps={{ isInline: true }}
          id={`toggle-${queryId}`}
          aria-controls={`query-expand-${queryId}`}
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
        {queryTable}
      </DataListContent>
    </DataListItem>
  );
};

const QueryBrowserWrapper: React.FC<{
  customDataSourceName: string;
  customDataSource: CustomDataSource;
  customDatasourceError: boolean;
}> = ({ customDataSourceName, customDataSource, customDatasourceError }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const dispatch = useDispatch();

  const hideGraphs = useSelector(
    (state: MonitoringState) => !!getLegacyObserveState(perspective, state)?.get('hideGraphs'),
  );
  const queriesList = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'queries']),
  );

  const queries = queriesList.toJS();

  // Initialize queries from URL parameters
  React.useEffect(() => {
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
  const queryStrings = React.useMemo(() => _.map(queries, 'query'), [queriesMemoKey]);
  const disabledSeriesMemoKey = JSON.stringify(
    _.reject(_.map(queries, 'disabledSeries'), _.isEmpty),
  );
  const disabledSeries = React.useMemo(
    () => _.map(queries, 'disabledSeries'),
    [disabledSeriesMemoKey],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  // Update the URL parameters when the queries shown in the graph change
  React.useEffect(() => {
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
          <Title headingLevel="h2" size="md">
            {t('No query entered')}
          </Title>
        }
        icon={ChartLineIcon}
        variant={EmptyStateVariant.full}
      >
        <EmptyStateBody>
          {t('Enter a query in the box below to explore metrics for this cluster.')}
        </EmptyStateBody>
        <Button onClick={insertExampleQuery} variant="primary">
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
      showStackedControl
    />
  );
};

const AddQueryButton: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const dispatch = useDispatch();
  const addQuery = React.useCallback(() => dispatch(queryBrowserAddQuery()), [dispatch]);

  return (
    <Button onClick={addQuery} type="button" variant="secondary">
      {t('Add query')}
    </Button>
  );
};

const RunQueriesButton: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const dispatch = useDispatch();
  const runQueries = React.useCallback(() => dispatch(queryBrowserRunQueries()), [dispatch]);

  return (
    <Button onClick={runQueries} type="submit" variant="primary">
      {t('Run queries')}
    </Button>
  );
};

const QueriesList: React.FC<{ customDatasource?: CustomDataSource }> = ({ customDatasource }) => {
  const { perspective } = usePerspective();
  const count = useSelector(
    (state: MonitoringState) =>
      getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'queries']).size,
  );

  return (
    <DataList aria-label={`queries`}>
      {_.range(count).map((index) => {
        const reversedIndex = count - index - 1;
        return (
          <Query index={reversedIndex} key={reversedIndex} customDatasource={customDatasource} />
        );
      })}
    </DataList>
  );
};

const IntervalDropdown = () => {
  const { perspective } = usePerspective();
  const dispatch = useDispatch();
  const setInterval = React.useCallback(
    (v: number) => dispatch(queryBrowserSetPollInterval(v)),
    [dispatch],
  );
  const pollInterval = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'pollInterval'], 15 * 1000),
  );
  return <DropDownPollInterval setInterval={setInterval} selectedInterval={pollInterval} />;
};

const QueryBrowserPage_: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const dispatch = useDispatch();

  // Clear queries on unmount
  React.useEffect(() => () => dispatch(queryBrowserDeleteAllQueries()), [dispatch]);

  const [customDataSource, setCustomDataSource] = React.useState<CustomDataSource>(undefined);
  const [customDataSourceIsResolved, setCustomDataSourceIsResolved] =
    React.useState<boolean>(false);
  const customDataSourceName = getQueryArgument(QueryParams.Datasource);
  const [extensions, extensionsResolved] = useResolvedExtensions<DataSource>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);
  const [customDatasourceError, setCustomDataSourceError] = React.useState(false);

  // get custom datasources
  React.useEffect(() => {
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
      <Helmet>
        <title>{t('Metrics')}</title>
      </Helmet>
      <PageSection hasBodyWrapper={false}>
        <Split hasGutter>
          <SplitItem>
            <Title headingLevel="h1">{t('Metrics')}</Title>
          </SplitItem>
          <SplitItem isFilled />
          <SplitItem>
            <IntervalDropdown />
          </SplitItem>
          <SplitItem>
            <MetricsActionsMenu />
          </SplitItem>
        </Split>
      </PageSection>
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
            <QueriesList customDatasource={customDataSource} />
          </StackItem>
        </Stack>
      </PageSection>
    </>
  );
};
export const QueryBrowserPage = withFallback(QueryBrowserPage_);

type QueryTableProps = {
  index: number;
  namespace?: string;
  customDatasource?: CustomDataSource;
};

type SeriesButtonProps = {
  index: number;
  labels: PrometheusLabels;
};
