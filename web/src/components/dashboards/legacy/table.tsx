import { PrometheusEndpoint, PrometheusResponse } from '@openshift-console/dynamic-plugin-sdk';
import { PerPageOptions } from '@patternfly/react-core';
import {
  ISortBy,
  Table as PFTable,
  sortable,
  TableGridBreakpoint,
  TableVariant,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@patternfly/react-table';
import * as _ from 'lodash-es';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import ErrorAlert from './error';
import { getPrometheusURL } from '../../console/graphs/helpers';
import { usePoll } from '../../console/utils/poll-hook';
import { useSafeFetch } from '../../console/utils/safe-fetch-hook';

import { formatNumber } from '../../format';
import { usePerspective } from '../../hooks/usePerspective';
import TablePagination from '../../table-pagination';
import { ColumnStyle, Panel } from './types';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import { GraphEmpty } from '../../../components/console/graphs/graph-empty';

type AugmentedColumnStyle = ColumnStyle & {
  className?: string;
};

// Get the columns from the panel styles. Filters out hidden columns and orders
// them so the label columns are displayed first.
const getColumns = (styles: ColumnStyle[]): AugmentedColumnStyle[] => {
  const labelColumns = [];
  const valueColumns = [];
  styles.forEach((col: ColumnStyle) => {
    // Remove hidden or regex columns.
    if (col.type === 'hidden' || col.pattern.startsWith('/') || !col.alias) {
      return;
    }

    if (col.pattern.startsWith('Value #')) {
      valueColumns.push(col);
    } else if (col.pattern === 'Value') {
      // Set the column to use the first group pattern because the panel has a single target
      valueColumns.push({ ...col, pattern: 'Value #A' });
    } else {
      labelColumns.push({
        ...col,
      });
    }
  });

  // Show non-value columns first.
  return [...labelColumns, ...valueColumns];
};

const perPageOptions: PerPageOptions[] = [5, 10, 20, 50, 100].map((n) => ({
  title: n.toString(),
  value: n,
}));

const Table: React.FC<Props> = ({ customDataSource, panel, pollInterval, queries, namespace }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const [error, setError] = React.useState();
  const [isLoading, setLoading] = React.useState(true);
  const [data, setData] = React.useState();
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(5);
  const [sortBy, setSortBy] = React.useState<ISortBy>({ index: 0, direction: 'asc' });
  const onSort = (e, index: ISortBy['index'], direction: ISortBy['direction']) =>
    setSortBy({ index, direction });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = React.useCallback(useSafeFetch(), []);

  const tick = () => {
    const allPromises = _.map(queries, (query) =>
      _.isEmpty(query)
        ? Promise.resolve()
        : safeFetch<PrometheusResponse>(
            getPrometheusURL(
              {
                endpoint: PrometheusEndpoint.QUERY,
                query,
                namespace: perspective === 'dev' ? namespace : '',
              },
              perspective,
              customDataSource?.basePath,
            ),
          ),
    );

    Promise.all(allPromises)
      .then((responses) => {
        setError(undefined);
        setLoading(false);
        // Note: This makes the following assumptions about the data:
        // 1. The transform is `table`
        // 2. The value will be an instance vector (single value).
        // 3. The time column is hidden.
        // The Grafana implementation is much more involved. See
        //   https://grafana.com/docs/grafana/latest/features/panels/table_panel/#merge-multiple-queries-per-table
        setData(
          responses.reduce((acc, response, i: number) => {
            if (response) {
              const id = panel.targets[i].refId;
              response.data.result.forEach(({ metric, value }) => {
                const tag = Object.values(metric).join('-');
                if (!acc[tag]) {
                  acc[tag] = { ...metric };
                }
                acc[tag][`Value #${id}`] = value[1] || '';
              });
            }
            return acc;
          }, {} as any),
        );
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(_.get(err, 'json.error', err.message));
          setLoading(false);
          setData(undefined);
        }
      });
  };

  usePoll(tick, pollInterval, queries);
  if (isLoading) {
    return <GraphEmpty loading />;
  }
  if (error) {
    return <ErrorAlert error={{ message: error, name: t('An error occurred') }} />;
  }
  if (_.isEmpty(panel.styles)) {
    return (
      <ErrorAlert
        error={{ message: t('panel.styles attribute not found'), name: t('An error occurred') }}
      />
    );
  }
  if (_.isEmpty(data)) {
    return <GraphEmpty />;
  }

  const columns: AugmentedColumnStyle[] = getColumns(panel.styles);

  // Sort the data.
  const sort = (row) => {
    const { pattern, type } = columns[sortBy.index];
    const val = row[pattern];
    if (type !== 'number') {
      return val;
    }
    if (_.isNil(val)) {
      return Number.MIN_VALUE;
    }
    const num = Number(val);
    // Some columns styles claim to be numbers, but have string data. Still sort those as strings.
    return _.isFinite(num) ? num : val;
  };
  const sortedData = _.orderBy(data, [sort], [sortBy.direction]);
  const visibleData = sortedData.slice((page - 1) * perPage, page * perPage);

  // Format the table rows.
  const rows: string[][] = visibleData.map((values: { [key: string]: string }) => {
    return columns.reduce((acc: string[], { type, decimals = 2, pattern, unit = '' }) => {
      const value = values[pattern];
      switch (type) {
        case 'number':
          acc.push(formatNumber(value, decimals, unit));
          break;
        default:
          acc.push(value || '-');
      }
      return acc;
    }, []);
  });

  const headers = columns.map(({ alias: title, className }) => ({
    title,
    transforms: [sortable],
    ...(className ? { props: { className } } : {}),
  }));

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <PFTable
          aria-label={t('query results table')}
          gridBreakPoint={TableGridBreakpoint.none}
          variant={TableVariant.compact}
          rows={rows.length}
        >
          <Thead>
            <Tr>
              {headers.map(({ title }, columnIndex) => {
                const sortParams = {
                  sort: {
                    sortBy,
                    onSort,
                    columnIndex,
                  },
                };
                return (
                  <Th key={`title-${columnIndex}`} {...sortParams}>
                    {title}
                  </Th>
                );
              })}
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((_, rowIndex) => (
              <Tr key={`row-${rowIndex}`}>
                {headers.map((_, columnIndex) => (
                  <Td
                    key={`cell-${rowIndex}-${columnIndex}`}
                    dataLabel={rows?.[rowIndex]?.[columnIndex] ?? ''}
                    className="pf-v6-u-font-family-monospace"
                  >
                    {rows?.[rowIndex]?.[columnIndex]}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </PFTable>
      </div>
      <TablePagination
        itemCount={sortedData.length}
        page={page}
        perPage={perPage}
        perPageOptions={perPageOptions}
        setPage={setPage}
        setPerPage={setPerPage}
      />
    </>
  );
};

type Props = {
  panel: Panel;
  pollInterval: number;
  queries: string[];
  namespace?: string;
  customDataSource?: CustomDataSource;
};

export default Table;
