import { ResourceLink, RowProps, TableColumn } from '@openshift-console/dynamic-plugin-sdk';
import { Split, SplitItem } from '@patternfly/react-core';
import { ISortBy, SortByDirection, Td, ThProps } from '@patternfly/react-table';
import {
  Children,
  FC,
  MouseEvent,
  MutableRefObject,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';

import { LogDetail } from '@/features/logging/components/LogDetail';
import {
  getLoadMoreTimestamp,
  getTimestampBounds,
} from '@/features/logging/components/logs-table-utils';
import '@/features/logging/components/logs-table.css';
import {
  parseName,
  parseResources,
  ResourceLabel,
} from '@/features/logging/components/ParseResources';
import { StatsTable } from '@/features/logging/components/StatsTable';
import {
  TableData,
  VirtualizedLogsTable,
} from '@/features/logging/components/VirtualizedLogsTable';
import { DateFormat, dateToFormat } from '@/features/logging/utils/date-utils';
import {
  Direction,
  isStreamsResult,
  LogTableData,
  QueryRangeResponse,
  Resource,
  Schema,
  StreamLogData,
} from '@/features/logging/utils/logs-types';
import { severityFromString } from '@/features/logging/utils/severity';
import { bigIntDifference, numericComparator } from '@/features/logging/utils/sort-utils';
import { TestIds } from '@/features/logging/utils/test-ids';

/* eslint-disable react-hooks/refs */

interface LogsTableProps {
  logsData?: QueryRangeResponse;
  isLoading?: boolean;
  hasMoreLogsData?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: (lastTimestampNs: string) => void;
  onSortByDate?: (direction?: Direction) => void;
  direction?: Direction;
  showResources?: boolean;
  showStats?: boolean;
  isStreaming?: boolean;
  error?: unknown;
  timezone?: string;
  hasNamespaceFilter?: boolean;
  tenant?: string;
  schema: Schema;
}

const isJSONObject = (value: string): boolean => {
  const trimmedValue = value.trim();

  return trimmedValue.startsWith('{') && trimmedValue.endsWith('}');
};

const streamToTableData = (stream: StreamLogData, timezone?: string): Array<LogTableData> => {
  const values = stream.values;

  return values.map((value) => {
    const logValue = String(value[1]);
    const message = isJSONObject(logValue) ? stream.stream['message'] || logValue : logValue;
    const rawTimestamp = String(value[0]);
    const timestamp = parseFloat(rawTimestamp);
    const observedTimestamp = stream.stream.observedTimestamp
      ? BigInt(stream.stream.observedTimestamp)
      : undefined;
    const openshiftSequence = stream.stream.openshift_sequence
      ? BigInt(stream.stream.openshift_sequence)
      : undefined;
    const time = timestamp / 1e6;
    const formattedTime = dateToFormat(time, DateFormat.Full, timezone);
    const severity = parseName(stream.stream, ResourceLabel.Severity);
    const namespace = parseName(stream.stream, ResourceLabel.Namespace);
    const podName = parseName(stream.stream, ResourceLabel.Pod);

    return {
      time: formattedTime,
      timestamp,
      rawTimestamp,
      message,
      severity: severityFromString(severity) ?? 'other',
      data: stream.stream,
      resources: parseResources(stream.stream),
      namespace,
      podName,
      type: 'log',
      observedTimestamp,
      openshiftSequence,
      // index is 0 here to match the type, but it will be recalculated when flattening the array
      logIndex: 0,
    };
  });
};

const aggregateStreamLogData = (
  response?: QueryRangeResponse,
  timezone?: string,
): Array<LogTableData> => {
  // TODO check timestamp aggregation for streams
  // TODO check if display matrix data is required

  const data = response?.data;
  if (isStreamsResult(data)) {
    return data.result
      .flatMap((stream) => streamToTableData(stream, timezone))
      .map((log, index) => ({ ...log, logIndex: index }));
  }

  return [];
};

const columns: Array<TableColumn<LogTableData>> = [
  {
    id: 'expand',
    title: ' ',
    props: {
      className: 'lv-plugin__table__expand',
    },
  },
  {
    id: 'date',
    title: 'Date',
    props: {
      className: 'lv-plugin__table__time lv-plugin__table__time-header',
    },
    sort: (data, sortDirection) =>
      data.sort((a, b) =>
        numericComparator(
          a.timestamp,
          b.timestamp,
          sortDirection === 'asc' ? 1 : -1,
          a.openshiftSequence !== undefined && b.openshiftSequence !== undefined
            ? bigIntDifference(a.openshiftSequence, b.openshiftSequence)
            : bigIntDifference(a.observedTimestamp, b.observedTimestamp),
        ),
      ),
  },
  {
    id: 'message',
    title: 'Message',
    sort: (data, sortDirection) =>
      data.sort((a, b) => {
        const messageA = a.message;
        const messageB = b.message;

        return (
          (messageA < messageB ? -1 : messageA > messageB ? 1 : 0) *
          (sortDirection === 'asc' ? 1 : -1)
        );
      }),
  },
];

const ResourceLinkList: FC<{
  resource: Resource;
  data: LogTableData;
}> = ({ resource, data }) => {
  if (resource.kind === 'Container') {
    if (!data.podName) {
      return null;
    }

    return (
      <SplitItem>
        <Link to={`/k8s/ns/${data.namespace}/pods/${data.podName}/containers/${resource.name}`}>
          <ResourceLink
            kind={resource.kind}
            name={resource.name}
            namespace={data.namespace}
            linkTo={false}
          />
        </Link>
      </SplitItem>
    );
  }

  return (
    <SplitItem>
      <ResourceLink kind={resource.kind} name={resource.name} namespace={data.namespace} />
    </SplitItem>
  );
};

type TableRowProps = {
  expandedItemsRef: MutableRefObject<Set<number>>;
  handleRowToggle: (e: MouseEvent, rowIndex: number) => void;
  showResources: boolean;
  colSpan?: number;
};

const TableRow = ({ expandedItemsRef, handleRowToggle, showResources, colSpan }: TableRowProps) => {
  return function TableRowComponent({ obj, activeColumnIDs }: RowProps<LogTableData>) {
    const isExpanded = expandedItemsRef.current.has(obj.logIndex);

    return obj.type === 'log' ? (
      <>
        <Td
          expand={{ isExpanded, onToggle: handleRowToggle, rowIndex: obj.logIndex }}
          className="lv-plugin__table__expand"
          id="expand"
        />
        <TableData id="date" activeColumnIDs={activeColumnIDs} className="lv-plugin__table__time">
          {obj.time}
        </TableData>
        <TableData
          id="message"
          activeColumnIDs={activeColumnIDs}
          className="lv-plugin__table__message"
        >
          <div>{obj.message}</div>
          {showResources && (
            <Split className="lv-plugin__table__resources" hasGutter>
              {obj.resources?.map((resource) => (
                <ResourceLinkList key={resource.kind} resource={resource} data={obj} />
              ))}
            </Split>
          )}
        </TableData>
      </>
    ) : isExpanded ? (
      <TableData
        className="lv-plugin__table__details"
        id="expand"
        activeColumnIDs={activeColumnIDs}
        colSpan={colSpan}
      >
        <LogDetail data={obj.data} />
      </TableData>
    ) : null;
  };
};

export const LogsTable: FC<PropsWithChildren<LogsTableProps>> = ({
  logsData,
  isLoading,
  isLoadingMore,
  onLoadMore,
  onSortByDate,
  hasMoreLogsData,
  showResources = false,
  showStats = false,
  direction,
  isStreaming,
  children,
  error,
  timezone,
  hasNamespaceFilter,
  tenant,
  schema,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const expandedItemsRef = useRef(expandedItems);
  expandedItemsRef.current = expandedItems;
  const [prevChildrenCount, setPrevChildrenCount] = useState(0);
  const [sortBy, setSortBy] = useState<ISortBy>({
    index: 1,
    direction: direction === 'backward' ? 'desc' : 'asc',
  });
  const tableData: Array<LogTableData> = useMemo(() => {
    const logsTableData = aggregateStreamLogData(logsData, timezone);

    const logsTableDataWithExpanded = logsTableData.flatMap((row) => [
      row,
      { ...row, type: 'expand' as const },
    ]);

    return logsTableDataWithExpanded;
  }, [logsData, timezone]);

  useEffect(() => {
    setPrevChildrenCount(Children.count(children));
  }, [children]);

  const handleRowToggle = useCallback((_event: MouseEvent, rowIndex: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  }, []);

  const getSortParams = useCallback(
    (columnIndex: number): ThProps['sort'] => {
      if (columnIndex === 0) {
        return undefined;
      }

      return {
        sortBy,
        onSort: (_event, index, tableSortDirection) => {
          setExpandedItems(new Set());
          setSortBy({ index, direction: tableSortDirection, defaultDirection: 'desc' });

          if (index == 1) {
            // Sort results calling the backend if the column is the date column
            onSortByDate?.(
              tableSortDirection === undefined
                ? undefined
                : tableSortDirection === 'desc'
                  ? 'backward'
                  : 'forward',
            );
          }
        },
        columnIndex,
      };
    },
    [sortBy, onSortByDate],
  );

  const prevLogsDataRef = useRef(logsData);
  if (logsData !== prevLogsDataRef.current) {
    const prevData = prevLogsDataRef.current;
    prevLogsDataRef.current = logsData;

    const dataChanged =
      !prevData ||
      !logsData ||
      isStreaming ||
      prevData.data?.result?.length !== logsData.data?.result?.length;

    if (expandedItems.size > 0 && dataChanged) {
      setExpandedItems(new Set());
    }
  }

  const sortedData = useMemo(() => {
    const dataCopy = [...tableData];
    if (sortBy.index !== undefined && columns[sortBy.index]) {
      const { sort } = columns[sortBy.index];
      if (sort && typeof sort === 'function') {
        return sort(
          dataCopy,
          sortBy.direction === 'asc' ? SortByDirection.asc : SortByDirection.desc,
        );
      }
    }

    return dataCopy.sort((a, b) =>
      numericComparator(
        a.timestamp,
        b.timestamp,
        direction === 'backward' ? -1 : 1,
        a.openshiftSequence !== undefined && b.openshiftSequence !== undefined
          ? bigIntDifference(a.openshiftSequence, b.openshiftSequence)
          : bigIntDifference(a.observedTimestamp, b.observedTimestamp),
      ),
    );
  }, [tableData, sortBy, direction]);

  const dataIsEmpty = sortedData.length === 0;

  const timestampBounds = useMemo(() => getTimestampBounds(tableData), [tableData]);

  const handleLoadMore = () => {
    const lastTimestampNs = getLoadMoreTimestamp(timestampBounds, direction);
    if (lastTimestampNs !== undefined) {
      onLoadMore?.(lastTimestampNs);
    }
  };

  const RowComponent = useMemo(
    () =>
      TableRow({
        expandedItemsRef,
        handleRowToggle,
        showResources,
        colSpan: columns.length,
      }),
    [handleRowToggle, showResources],
  );

  const getRowClassName = useCallback((row: LogTableData) => {
    const expanded = expandedItemsRef.current.has(row.logIndex);
    let expandedClass = '';
    if (expanded) {
      expandedClass =
        row.type === 'log'
          ? 'lv-plugin__table__row--expanded'
          : 'lv-plugin__table__row--expanded-details';
    }
    return `lv-plugin__table__row ${expandedClass}`;
  }, []);

  return (
    <div data-test={TestIds.LogsTable} className="lv-plugin__table">
      {showStats && <StatsTable logsData={logsData} />}
      {children}

      <VirtualizedLogsTable
        data={sortedData}
        Row={RowComponent}
        columns={columns}
        getSortParams={getSortParams}
        getRowClassName={getRowClassName}
        error={error}
        isLoading={isLoading}
        isStreaming={isStreaming}
        dataIsEmpty={dataIsEmpty}
        hasMoreLogsData={hasMoreLogsData}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
        shouldResize={showStats || Children.count(children) != prevChildrenCount}
        hasNamespaceFilter={hasNamespaceFilter}
        tenant={tenant}
        schema={schema}
        expandedItems={expandedItems}
        showResources={showResources}
      />
    </div>
  );
};
