import classNames from 'classnames';
import * as _ from 'lodash-es';
import {
  PrometheusData,
  PrometheusEndpoint,
  PrometheusLabels,
  useResolvedExtensions,
  YellowExclamationTriangleIcon,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionGroup,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  EmptyStateVariant,
  Switch,
  Title,
  Grid,
  GridItem,
} from '@patternfly/react-core';
import {
  Select as SelectDeprecated,
  SelectOption as SelectOptionDeprecated,
  SelectVariant as SelectVariantDeprecated,
  Dropdown as DropdownDeprecated,
  DropdownItem as DropdownItemDeprecated,
  DropdownPosition as DropdownPositionDeprecated,
  DropdownToggle as DropdownToggleDeprecated,
} from '@patternfly/react-core/deprecated';
import {
  AngleDownIcon,
  AngleRightIcon,
  ChartLineIcon,
  CompressIcon,
} from '@patternfly/react-icons';
import {
  ISortBy,
  sortable,
  Table,
  TableBody,
  TableGridBreakpoint,
  TableHeader,
  TableVariant,
  wrappable,
} from '@patternfly/react-table';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import {
  queryBrowserAddQuery,
  queryBrowserDuplicateQuery,
  queryBrowserDeleteAllQueries,
  queryBrowserDeleteQuery,
  queryBrowserPatchQuery,
  queryBrowserRunQueries,
  queryBrowserSetAllExpanded,
  queryBrowserToggleAllSeries,
  queryBrowserToggleIsEnabled,
  queryBrowserToggleSeries,
  toggleGraphs,
  queryBrowserSetPollInterval,
} from '../actions/observe';

import { withFallback } from './console/console-shared/error/error-boundary';
import { getPrometheusURL } from './console/graphs/helpers';
import { AsyncComponent } from './console/utils/async';
import { usePoll } from './console/utils/poll-hook';
import {
  getAllQueryArguments,
  getQueryArgument,
  setAllQueryArguments,
} from './console/utils/router';
import { useSafeFetch } from './console/utils/safe-fetch-hook';
import { LoadingInline } from './console/utils/status-box';

import { useBoolean } from './hooks/useBoolean';
import KebabDropdown from './kebab-dropdown';
import { colors, Error, QueryBrowser } from './query-browser';
import TablePagination from './table-pagination';
import { PrometheusAPIError } from './types';
import {
  CustomDataSource,
  DataSource,
  isDataSource,
} from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import { getLegacyObserveState, usePerspective } from './hooks/usePerspective';
import { useActiveNamespace } from './console/console-shared/hooks/useActiveNamespace';
import { MonitoringState } from '../reducers/observe';
import { DropDownPollInterval } from './dropdown-poll-interval';

// Stores information about the currently focused query input
let focusedQuery;

type PredefinedQueryType = {
  name: string;
  query: string;
};

export const PreDefinedQueriesDropdown = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState('');
  let predefinedQueries: PredefinedQueryType[];

  const activeNamespace = useActiveNamespace();
  const { perspective } = usePerspective();

  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const predefinedQueriesAdmin: PredefinedQueryType[] = [
    {
      name: 'CPU Usage',
      // eslint-disable-next-line max-len
      query: `sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate) by (pod)`,
    },
    {
      name: 'Memory Usage',
      // eslint-disable-next-line max-len
      query: `sum(container_memory_working_set_bytes{container!=""}) by (pod)`,
    },
    {
      name: 'Filesystem Usage',
      // eslint-disable-next-line max-len
      query: `topk(25, sort_desc(sum(pod:container_fs_usage_bytes:sum{container="",pod!=""}) BY (pod, namespace)))`,
    },
    {
      name: 'Recieve bandwidth',
      query: `sum(irate(container_network_receive_bytes_total[2h])) by (pod)`,
    },
    {
      name: 'Transmit bandwidth',
      query: `sum(irate(container_network_transmit_bytes_total[2h])) by (pod)`,
    },
    {
      name: 'Rate of received packets',
      query: `sum(irate(container_network_receive_packets_total[2h])) by (pod)`,
    },
    {
      name: 'Rate of transmitted packets',
      query: `sum(irate(container_network_transmit_packets_total[2h])) by (pod)`,
    },
    {
      name: 'Rate of received packets dropped',
      query: `sum(irate(container_network_receive_packets_dropped_total[2h])) by (pod)`,
    },
    {
      name: 'Rate of transmitted packets dropped',
      query: `sum(irate(container_network_transmit_packets_dropped_total[2h])) by (pod)`,
    },
  ];

  // The developer view queries by namespace.
  const predefinedQueriesDev: PredefinedQueryType[] = [
    {
      name: 'CPU Usage',
      // eslint-disable-next-line max-len
      query: `sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{namespace='${activeNamespace}'}) by (pod)`,
    },
    {
      name: 'Memory Usage',
      // eslint-disable-next-line max-len
      query: `sum(container_memory_working_set_bytes{container!="", namespace='${activeNamespace}'}) by (pod)`,
    },
    {
      name: 'Filesystem Usage',
      // eslint-disable-next-line max-len
      query: `topk(25, sort_desc(sum(pod:container_fs_usage_bytes:sum{container="",pod!="",namespace='${activeNamespace}'}) BY (pod, namespace)))`,
    },
    {
      name: 'Recieve bandwidth',
      // eslint-disable-next-line max-len
      query: `sum(irate(container_network_receive_bytes_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Transmit bandwidth',
      // eslint-disable-next-line max-len
      query: `sum(irate(container_network_transmit_bytes_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Rate of received packets',
      // eslint-disable-next-line max-len
      query: `sum(irate(container_network_receive_packets_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Rate of transmitted packets',
      // eslint-disable-next-line max-len
      query: `sum(irate(container_network_transmit_packets_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Rate of received packets dropped',
      // eslint-disable-next-line max-len
      query: `sum(irate(container_network_receive_packets_dropped_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
    {
      name: 'Rate of transmitted packets dropped',
      // eslint-disable-next-line max-len
      query: `sum(irate(container_network_transmit_packets_dropped_total{namespace='${activeNamespace}'}[2h])) by (pod)`,
    },
  ];

  if (perspective === 'dev') {
    predefinedQueries = predefinedQueriesDev;
  } else if (perspective === 'admin') {
    predefinedQueries = predefinedQueriesAdmin;
  } // Wrong queries for ACM, leaving for when metrics gets moved to ACM

  // Note this fires twice when <Select> is clicked.
  const onToggle = (isExpanded: boolean) => {
    setIsOpen(isExpanded);
  };

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

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | undefined,
  ) => {
    if (!value) {
      setSelected(undefined);
      setIsOpen(false);
      return;
    }
    setSelected(value);
    setIsOpen(false);
    insertPredefinedQuery(value);
  };

  return (
    <Grid component="ul" className="predefined-query-select--padding">
      <GridItem component="li">
        <label htmlFor="predefined-query-select-label">{t('Queries')}</label>
      </GridItem>
      <GridItem component="li">
        <SelectDeprecated
          id={selected}
          variant={SelectVariantDeprecated.typeahead}
          typeAheadAriaLabel={t('Select query')}
          onToggle={(_e, isOpen) => onToggle(isOpen)}
          onSelect={onSelect}
          selections={selected}
          isOpen={isOpen}
          aria-labelledby="predefined-query-select"
          placeholderText={t('Select query')}
          width={400}
        >
          {predefinedQueries.map((option) => (
            <SelectOptionDeprecated key={option.name} value={option.query}>
              {option.name}
            </SelectOptionDeprecated>
          ))}
        </SelectDeprecated>
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

  const dropdownItems = [
    <DropdownItemDeprecated key="add-query" component="button" onClick={addQuery}>
      {t('Add query')}
    </DropdownItemDeprecated>,
    <DropdownItemDeprecated
      key="collapse-all"
      component="button"
      onClick={() => dispatch(queryBrowserSetAllExpanded(!isAllExpanded))}
    >
      {isAllExpanded ? t('Collapse all query tables') : t('Expand all query tables')}
    </DropdownItemDeprecated>,
    <DropdownItemDeprecated key="delete-all" component="button" onClick={doDelete}>
      {t('Delete all queries')}
    </DropdownItemDeprecated>,
  ];

  return (
    <DropdownDeprecated
      className="co-actions-menu"
      dropdownItems={dropdownItems}
      isOpen={isOpen}
      onSelect={setClosed}
      position={DropdownPositionDeprecated.right}
      toggle={<DropdownToggleDeprecated onToggle={setIsOpen}>Actions</DropdownToggleDeprecated>}
    />
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
    <Button
      type="button"
      className="pf-m-link--align-right query-browser__toggle-graph"
      onClick={toggle}
      variant="link"
    >
      {icon} {hideGraphs ? t('Show graph') : t('Hide graph')}
    </Button>
  );
};

const ExpandButton = ({ isExpanded, onClick }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const title = isExpanded ? t('Hide table') : t('Show table');
  return (
    <Button
      aria-label={title}
      className="query-browser__expand-button"
      onClick={onClick}
      title={title}
      variant="plain"
    >
      {isExpanded ? (
        <AngleDownIcon className="query-browser__expand-icon" />
      ) : (
        <AngleRightIcon className="query-browser__expand-icon" />
      )}
    </Button>
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
    return <div className="query-browser__series-btn-wrap"></div>;
  }
  const title = isDisabled ? t('Show series') : t('Hide series');

  return (
    <div className="query-browser__series-btn-wrap">
      <Button
        aria-label={title}
        className={classNames('query-browser__series-btn', {
          'query-browser__series-btn--disabled': isDisabled,
        })}
        onClick={toggleSeries}
        style={colorIndex === null ? undefined : { backgroundColor: colors[colorIndex] }}
        title={title}
        type="button"
        variant="plain"
      />
    </div>
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

  const isSpan = (item) => item.title?.props?.children;
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
    <DropdownItemDeprecated key="export" component="button" onClick={doExportCsv}>
      {t('Export as CSV')}
    </DropdownItemDeprecated>
  );

  const defaultDropdownItems = [
    <DropdownItemDeprecated key="toggle-query" component="button" onClick={toggleIsEnabled}>
      {isEnabled ? t('Disable query') : t('Enable query')}
    </DropdownItemDeprecated>,
    <DropdownItemDeprecated
      tooltip={!isEnabled ? t('Query must be enabled') : undefined}
      isDisabled={!isEnabled}
      key="toggle-all-series"
      component="button"
      onClick={toggleAllSeries}
    >
      {isDisabledSeriesEmpty ? t('Hide all series') : t('Show all series')}
    </DropdownItemDeprecated>,
    <DropdownItemDeprecated key="delete" component="button" onClick={doDelete}>
      {t('Delete query')}
    </DropdownItemDeprecated>,
    <DropdownItemDeprecated key="duplicate" component="button" onClick={doClone}>
      {t('Duplicate query')}
    </DropdownItemDeprecated>,
  ];

  const hasQueryTableData = () => {
    if (!query || !queryTableData?.rows || !queryTableData?.columns) {
      return false;
    }
    return true;
  };

  const drodownItems = hasQueryTableData()
    ? [...defaultDropdownItems, exportDropdownItem]
    : defaultDropdownItems;

  return <KebabDropdown dropdownItems={drodownItems} />;
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
      safeFetch(
        getPrometheusURL(
          { endpoint: PrometheusEndpoint.QUERY, namespace, query },
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
    return (
      <div className="query-browser__table-message">
        <Error error={error} title={t('Error loading values')} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="query-browser__table-message">
        <LoadingInline />
      </div>
    );
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
      <div className="query-browser__table-message">
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
        _.get(value, '[1]', { title: <span className="text-muted">{t('None')}</span> }),
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
      <div className="query-browser__table-wrapper">
        <div className="horizontal-scroll">
          <Button
            variant="link"
            isInline
            onClick={toggleAllSeries}
            className="query-browser__series-select-all-btn"
          >
            {isDisabledSeriesEmpty ? t('Unselect all') : t('Select all')}
          </Button>
          <Table
            aria-label={t('query results table')}
            cells={columns}
            gridBreakPoint={TableGridBreakpoint.none}
            onSort={onSort}
            rows={tableRows}
            sortBy={sortBy}
            variant={TableVariant.compact}
            className="query-browser__table"
          >
            <TableHeader />
            <TableBody />
          </Table>
        </div>
      </div>
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
    loader={() => import('./promql-expression-input').then((c) => c.PromQLExpressionInput)}
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

  const toggleIsExpanded = React.useCallback(
    () => dispatch(queryBrowserPatchQuery(index, { isExpanded: !isExpanded })),
    [dispatch, index, isExpanded],
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

  const activeNamespace = useActiveNamespace();
  return (
    <div
      className={classNames('query-browser__table', {
        'query-browser__table--expanded': isExpanded,
      })}
    >
      <div className="query-browser__query-controls">
        <ExpandButton isExpanded={isExpanded} onClick={toggleIsExpanded} />
        <PromQLExpressionInput
          value={text}
          onValueChange={handleTextChange}
          onExecuteQuery={handleExecuteQueries}
          onSelectionChange={handleSelectionChange}
        />
        <div title={switchLabel}>
          <Switch
            aria-label={switchLabel}
            id={switchKey}
            isChecked={isEnabled}
            key={switchKey}
            onChange={toggleIsEnabled}
          />
        </div>
        <div className="dropdown-kebab-pf">
          <QueryKebab index={index} />
        </div>
      </div>
      {/* If namespace is defined getPrometheusURL() will use the
      PROMETHEUS_TENANCY_BASE_PATH for the developer view */}
      <QueryTable
        index={index}
        customDatasource={customDatasource}
        namespace={perspective === 'dev' ? activeNamespace : undefined}
      />
    </div>
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
    const searchParams = getAllQueryArguments();
    for (let i = 0; _.has(searchParams, `query${i}`); ++i) {
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
      <div className="query-browser__wrapper graph-empty-state">
        <EmptyState variant={EmptyStateVariant.full}>
          <EmptyStateIcon icon={ChartLineIcon} />
          <Title headingLevel="h2" size="md">
            {t('Error loading custom data source')}
          </Title>
          <EmptyStateBody>
            {t('An error occurred while loading the custom data source.')}
          </EmptyStateBody>
        </EmptyState>
      </div>
    );
  }

  if (queryStrings.join('') === '') {
    return (
      <div className="query-browser__wrapper graph-empty-state">
        <EmptyState variant={EmptyStateVariant.full}>
          <EmptyStateIcon icon={ChartLineIcon} />
          <Title headingLevel="h2" size="md">
            {t('No query entered')}
          </Title>
          <EmptyStateBody>
            {t('Enter a query in the box below to explore metrics for this cluster.')}
          </EmptyStateBody>
          <Button onClick={insertExampleQuery} variant="primary">
            {t('Insert example query')}
          </Button>
        </EmptyState>
      </div>
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
    <Button
      className="query-browser__inline-control"
      onClick={addQuery}
      type="button"
      variant="secondary"
    >
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
    <>
      {_.range(count).map((index) => {
        const reversedIndex = count - index - 1;
        return (
          <Query index={reversedIndex} key={reversedIndex} customDatasource={customDatasource} />
        );
      })}
    </>
  );
};

const IntervalDropdown = () => {
  const dispatch = useDispatch();
  const setInterval = React.useCallback(
    (v: number) => dispatch(queryBrowserSetPollInterval(v)),
    [dispatch],
  );
  return <DropDownPollInterval setInterval={setInterval} />;
};

const QueryBrowserPage_: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const dispatch = useDispatch();

  // Clear queries on unmount
  React.useEffect(() => () => dispatch(queryBrowserDeleteAllQueries()), [dispatch]);

  const [customDataSource, setCustomDataSource] = React.useState<CustomDataSource>(undefined);
  const [customDataSourceIsResolved, setCustomDataSourceIsResolved] =
    React.useState<boolean>(false);
  const customDataSourceName = getQueryArgument('datasource');
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
        <div className="co-m-pane__body">
          <div className="row">
            <div className="col-xs-12 pf-u-text-align-center">
              <LoadingInline />
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <>
      <Helmet>
        <title>{t('Metrics')}</title>
      </Helmet>
      <div className="co-m-nav-title">
        <h1 className="co-m-pane__heading">
          <span>{t('Metrics')}</span>
          <div className="co-actions">
            <IntervalDropdown />
            <MetricsActionsMenu />
          </div>
        </h1>
      </div>
      <div className="co-m-pane__body">
        <div className="row">
          <div className="col-xs-12">
            <div className="query-browser__toggle-graph-container">
              <ToggleGraph />
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12">
            <QueryBrowserWrapper
              customDataSource={customDataSource}
              customDataSourceName={customDataSourceName}
              customDatasourceError={customDatasourceError}
            />
            <div className="query-browser__controls">
              <PreDefinedQueriesDropdown />
              <div className="query-browser__controls--right">
                <ActionGroup className="pf-c-form pf-c-form__group--no-top-margin">
                  <AddQueryButton />
                  <RunQueriesButton />
                </ActionGroup>
              </div>
            </div>
            <QueriesList customDatasource={customDataSource} />
          </div>
        </div>
      </div>
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
