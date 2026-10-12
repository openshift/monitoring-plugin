import { RowProps, TableColumn } from '@openshift-console/dynamic-plugin-sdk';
import { Alert } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, ThProps, Tr } from '@patternfly/react-table';
import { VirtualTableBody } from '@patternfly/react-virtualized-extension';
import { AutoSizer, WindowScroller } from '@patternfly/react-virtualized-extension';
import { Scroll } from '@patternfly/react-virtualized-extension/dist/esm/components/Virtualized/types';
import classNames from 'classnames';
import {
  ComponentType,
  CSSProperties,
  FC,
  forwardRef,
  memo,
  PropsWithChildren,
  ReactElement,
  ReactText,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import CellMeasurer, {
  CellMeasurerCache,
  MeasuredCellParent,
} from 'react-virtualized/dist/es/CellMeasurer';

import { CenteredContainer } from '@/features/logging/components/CenteredContainer';
import { ErrorMessage } from '@/features/logging/components/ErrorMessage';
import { LogTableData, Schema } from '@/features/logging/logs-types';
import { getSeverityColor, Severity } from '@/features/logging/severity';
import { TestIds } from '@/features/logging/test-ids';

interface VirtualizedLogsTableProps<D> {
  Row: ComponentType<RowProps<D>>;
  data: Array<D>;
  columns: TableColumn<D>[];
  getSortParams: (index: number) => ThProps['sort'];
  error?: unknown | Error;
  isStreaming?: boolean;
  isLoading?: boolean;
  dataIsEmpty?: boolean;
  getRowClassName?: (obj: D) => string;
  hasMoreLogsData?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  shouldResize?: boolean;
  csvData?: string;
  hasNamespaceFilter?: boolean;
  tenant?: string;
  schema: Schema;
  expandedItems?: Set<number>;
  showResources?: boolean;
}

export type TableRowProps = {
  id: ReactText;
  index: number;
  title?: string;
  trKey: string;
  style: object;
  className?: string;
};

type RowMemoProps<T> = RowProps<T> & {
  Row: ComponentType<RowProps<T>>;
  isScrolling: boolean;
  style: CSSProperties;
};

const RowMemo = memo(
  // eslint-disable-next-line
  ({ Row, isScrolling, style, ...props }: RowMemoProps<LogTableData>) => <Row {...props} />,
  (_, nextProps) => {
    if (nextProps.isScrolling) {
      return true;
    }

    return false;
  },
);
RowMemo.displayName = 'RowMemo';

export type TableDataProps = {
  id: string;
  activeColumnIDs: Set<string>;
  className?: string;
  colSpan?: number;
};

export const TableData: FC<PropsWithChildren<TableDataProps>> = ({
  className,
  id,
  activeColumnIDs,
  children,
  colSpan,
}) =>
  activeColumnIDs.has(id) || id === '' ? (
    <Td data-label={id} className={className} colSpan={colSpan} role="gridcell">
      {children}
    </Td>
  ) : null;
TableData.displayName = 'TableData';

const getRowSeverityStyle = (severity: string): CSSProperties => {
  if (!severity) {
    return {};
  }
  return { '--lv-severity-color': getSeverityColor(severity as Severity) } as CSSProperties;
};

type VirtualizedTableBodyProps<D, R = unknown> = {
  Row: ComponentType<RowProps<D, R>>;
  data: D[];
  height: number;
  isScrolling: boolean;
  onChildScroll: (params: Scroll) => void;
  columns: TableColumn<D>[];
  scrollTop: number;
  width: number;
  rowData?: R;
  getRowId?: (obj: D) => string;
  getRowTitle?: (obj: D) => string;
  getRowClassName?: (obj: D) => string;
  scrollToIndex?: number;
  expandedItems?: Set<number>;
  showResources?: boolean;
};

const TableRow = forwardRef<HTMLTableRowElement, PropsWithChildren<TableRowProps>>(
  ({ id, index, trKey, style, className, ...props }, ref) => {
    return (
      <Tr
        {...props}
        ref={ref}
        data-id={id}
        data-index={index}
        data-test-rows="resource-row"
        data-key={trKey}
        style={style}
        className={classNames('pf-v6-c-table__tr', className)}
        role="row"
      />
    );
  },
);
TableRow.displayName = 'TableRow';

const VirtualizedTableBody = ({
  Row,
  height,
  isScrolling,
  onChildScroll,
  data,
  columns,
  scrollTop,
  width,
  rowData,
  getRowId,
  getRowTitle,
  getRowClassName,
  scrollToIndex,
  expandedItems,
  showResources,
}: VirtualizedTableBodyProps<LogTableData>) => {
  const cellMeasurementCache = useMemo(
    () =>
      new CellMeasurerCache({
        fixedWidth: true,
        minHeight: 1,
        keyMapper: (rowIndex) => rowIndex,
      }),
    [],
  );

  const tableBodyRef = useRef<VirtualTableBody>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    cellMeasurementCache.clearAll();
    tableBodyRef.current?.forceUpdateVirtualGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedItems, showResources]);

  const isFirstWidth = useRef(true);
  useEffect(() => {
    if (isFirstWidth.current) {
      isFirstWidth.current = false;
      return;
    }
    cellMeasurementCache.clearAll();
    tableBodyRef.current?.recomputeRowHeights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const activeColumnIDs = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);

  const rowRenderer = ({
    index,
    isVisible,
    key,
    style,
    parent,
  }: {
    index: number;
    isVisible: boolean;
    key: string;
    style: CSSProperties;
    parent: MeasuredCellParent;
  }) => {
    const rowArgs = {
      obj: data[index],
      activeColumnIDs,
      rowData,
      index,
    };

    // do not render non visible elements (this excludes overscan)
    if (!isVisible) {
      return null;
    }

    return (
      <CellMeasurer
        cache={cellMeasurementCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({ registerChild }) => (
          <TableRow
            ref={registerChild}
            id={getRowId?.(rowArgs.obj) ?? key}
            index={index}
            trKey={key}
            style={{ ...style, ...getRowSeverityStyle(rowArgs.obj.severity) }}
            title={getRowTitle?.(rowArgs.obj)}
            className={getRowClassName?.(rowArgs.obj)}
          >
            <RowMemo Row={Row} {...rowArgs} style={style} isScrolling={isScrolling} />
          </TableRow>
        )}
      </CellMeasurer>
    );
  };

  return (
    <VirtualTableBody
      ref={tableBodyRef}
      autoHeight
      className="pf-v6-c-table pf-m-compact pf-m-border-rows pf-v6-c-virtualized pf-v6-c-window-scroller"
      deferredMeasurementCache={cellMeasurementCache}
      rowHeight={cellMeasurementCache.rowHeight}
      height={height || 0}
      isScrolling={isScrolling}
      onScroll={onChildScroll}
      overscanRowCount={10}
      columns={columns}
      rows={data}
      rowCount={data.length}
      rowRenderer={rowRenderer}
      scrollTop={scrollTop}
      width={width}
      scrollToIndex={scrollToIndex}
    />
  );
};

const isHTMLElement = (n: Node): n is HTMLElement => {
  return n.nodeType === Node.ELEMENT_NODE;
};

export const getParentScrollableElement = (node: HTMLElement) => {
  let parentNode: Node | undefined = node;
  while (parentNode) {
    if (isHTMLElement(parentNode)) {
      let overflow = parentNode.style?.overflow;
      if (!overflow.includes('scroll') && !overflow.includes('auto')) {
        overflow = window.getComputedStyle(parentNode).overflow;
      }
      if (overflow.includes('scroll') || overflow.includes('auto')) {
        return parentNode;
      }
    }
    parentNode = parentNode.parentNode ?? undefined;
  }
  return undefined;
};

type WithScrollContainerProps = {
  children: (scrollContainer: HTMLElement) => ReactElement | null;
};

export const WithScrollContainer: FC<WithScrollContainerProps> = ({ children }) => {
  const [scrollContainer, setScrollContainer] = useState<HTMLElement>();
  const ref = useCallback((node) => {
    if (node) {
      setScrollContainer(getParentScrollableElement(node));
    }
  }, []);
  return scrollContainer ? children(scrollContainer) : <span ref={ref} />;
};

export const VirtualizedLogsTable = ({
  Row,
  data,
  columns,
  getSortParams,
  getRowClassName,
  error,
  isStreaming,
  isLoading,
  isLoadingMore,
  dataIsEmpty,
  hasMoreLogsData,
  onLoadMore,
  shouldResize,
  hasNamespaceFilter,
  tenant,
  schema,
  expandedItems,
  showResources,
}: VirtualizedLogsTableProps<LogTableData>) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const colSpan = columns.length + 3;
  const scrollerRef = useRef<WindowScroller>(null);
  const [scrollToIndex, setScrollToIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    scrollerRef.current?.updatePosition();
  }, [shouldResize]);

  return (
    <div className="lv-plugin__virtualized-table">
      <Table aria-label="Logs Table" variant="compact" className="lv-plugin__table" isStriped>
        <Thead>
          <Tr>
            {columns.map(({ title, props }, columnIndex) => {
              const sortParams = getSortParams(columnIndex);
              return (
                <Th
                  sort={sortParams}
                  key={title}
                  className="lv-plugin__table__row-header"
                  {...(props ?? {})}
                >
                  {title}
                </Th>
              );
            })}
          </Tr>
        </Thead>
        {error ? (
          <Tbody>
            <Tr className="lv-plugin__table__row-info">
              <Td colSpan={colSpan} key="error-row">
                <div className="lv-plugin__table__row-error">
                  <ErrorMessage
                    error={error}
                    hasNamespaceFilter={hasNamespaceFilter}
                    tenant={tenant}
                    schema={schema}
                  />
                </div>
              </Td>
            </Tr>
          </Tbody>
        ) : isStreaming ? (
          <Tbody>
            <Tr className="lv-plugin__table__row-info">
              <Td colSpan={colSpan} key="streaming-row">
                <div className="lv-plugin__table__row-streaming">
                  <Alert variant="info" isInline isPlain title={t('Streaming Logs...')} />
                </div>
              </Td>
            </Tr>
          </Tbody>
        ) : isLoading ? (
          <Tbody>
            <Tr className="lv-plugin__table__row-info">
              <Td colSpan={colSpan} key="loading-row">
                {t('Loading...')}
              </Td>
            </Tr>
          </Tbody>
        ) : (
          dataIsEmpty && (
            <Tbody>
              <Tr className="lv-plugin__table__row-info">
                <Td colSpan={colSpan} key="data-empty-row">
                  <CenteredContainer>
                    <Alert variant="warning" isInline isPlain title={t('No datapoints found')} />
                  </CenteredContainer>
                </Td>
              </Tr>
            </Tbody>
          )
        )}

        <WithScrollContainer>
          {(scrollContainer) => (
            <WindowScroller scrollElement={scrollContainer} ref={scrollerRef}>
              {({ height, isScrolling, registerChild, onChildScroll, scrollTop }) => (
                <AutoSizer disableHeight>
                  {({ width }) => (
                    <div ref={registerChild}>
                      <VirtualizedTableBody
                        columns={columns}
                        data={data}
                        height={height}
                        isScrolling={isScrolling}
                        onChildScroll={onChildScroll}
                        Row={Row}
                        scrollTop={scrollTop}
                        width={width}
                        getRowClassName={getRowClassName}
                        scrollToIndex={scrollToIndex}
                        expandedItems={expandedItems}
                        showResources={showResources}
                      />
                    </div>
                  )}
                </AutoSizer>
              )}
            </WindowScroller>
          )}
        </WithScrollContainer>

        {!dataIsEmpty && (
          <Tbody>
            <Tr
              className={`lv-plugin__table__row-info lv-plugin__table__row-more-data ${hasMoreLogsData ? 'lv-plugin__table__row-more-data--clickable' : ''}`}
              data-test={TestIds.LoadMoreLogs}
              onClick={() => {
                if (!isLoading && !isLoadingMore && hasMoreLogsData) {
                  setScrollToIndex(data.length - 1);
                  onLoadMore?.();
                }
              }}
            >
              {hasMoreLogsData ? (
                <Td colSpan={colSpan} key="more-data-row">
                  {t('More data available')}, {isLoadingMore ? t('Loading...') : t('Click to load')}
                </Td>
              ) : (
                <Td colSpan={colSpan} key="no-more-data-row">
                  {t('No more data available')}
                </Td>
              )}
            </Tr>
          </Tbody>
        )}
      </Table>
    </div>
  );
};
