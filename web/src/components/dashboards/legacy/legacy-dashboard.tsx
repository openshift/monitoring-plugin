import * as _ from 'lodash-es';
import {
  RedExclamationCircleIcon,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Card as PFCard,
  CardBody,
  CardHeader,
  CardTitle,
  DropdownItem,
  Grid,
  GridItem,
  gridSpans,
  Flex,
  FlexItem,
  ExpandableSectionToggle,
} from '@patternfly/react-core';
import type { FC } from 'react';
import { memo, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom-v5-compat';

import { setQueryArguments } from '../../console/utils/router';

import { Perspective } from '../../../actions/observe';
import BarChart from '../legacy/bar-chart';
import Graph from '../legacy/graph';
import SingleStat from '../legacy/single-stat';
import Table from '../legacy/table';
import { useBoolean } from '../../hooks/useBoolean';
import { useIsVisible } from '../../hooks/useIsVisible';
import {
  getMutlipleQueryBrowserUrl,
  getLegacyObserveState,
  usePerspective,
} from '../../hooks/usePerspective';
import KebabDropdown from '../../kebab-dropdown';
import { MonitoringState } from '../../../reducers/observe';
import { evaluateVariableTemplate } from './legacy-variable-dropdowns';
import { Panel, Row } from './types';
import { QueryParams } from '../../query-params';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk-internal/lib/extensions/dashboard-data-source';
import {
  DataSource,
  isDataSource,
} from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import { t_global_font_size_heading_h2 } from '@patternfly/react-tokens';
import { GraphEmpty } from '../../../components/console/graphs/graph-empty';
import { GraphUnits } from '../../../components/metrics/units';
import { LegacyDashboardPageTestIDs } from '../../../components/data-test';

const QueryBrowserLink = ({
  queries,
  customDataSourceName,
  units,
}: {
  queries: Array<string>;
  customDataSourceName: string;
  units?: GraphUnits;
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const params = new URLSearchParams();
  queries.forEach((q, i) => params.set(`query${i}`, q));
  if (units) {
    params.set(QueryParams.Units, units);
  }
  const [namespace] = useActiveNamespace();

  if (customDataSourceName) {
    params.set('datasource', customDataSourceName);
  }

  return (
    <Link
      aria-label={t('Inspect')}
      to={getMutlipleQueryBrowserUrl(perspective, params, namespace)}
      data-test={LegacyDashboardPageTestIDs.Inspect}
    >
      {t('Inspect')}
    </Link>
  );
};

// Determine how many columns a panel should span. If panel specifies a `span`, use that. Otherwise
// look for a `breakpoint` percentage. If neither are specified, default to 12 (full width).
const getPanelSpan = (panel: Panel): gridSpans => {
  if (panel.span) {
    return panel.span as gridSpans;
  }
  const breakpoint = _.toInteger(_.trimEnd(panel.breakpoint, '%'));
  if (breakpoint > 0) {
    return Math.round(12 * (breakpoint / 100)) as gridSpans;
  }
  return 12;
};

const Card: FC<CardProps> = memo(({ panel, perspective }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [namespace] = useActiveNamespace();
  const pollInterval = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'pollInterval']),
  );
  const timespan = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'timespan']),
  );
  const variables = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'variables']),
  );

  const ref = useRef();
  const [, wasEverVisible] = useIsVisible(ref);

  const [isError, setIsError] = useState<boolean>(false);
  const [dataSourceInfoLoading, setDataSourceInfoLoading] = useState<boolean>(true);
  const [customDataSource, setCustomDataSource] = useState<CustomDataSource>(undefined);
  const customDataSourceName = panel.datasource?.name;
  const [extensions, extensionsResolved] = useResolvedExtensions<DataSource>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);

  const formatSeriesTitle = useCallback(
    (labels, i) => {
      const title = panel.targets?.[i]?.legendFormat;
      if (_.isNil(title)) {
        return _.isEmpty(labels) ? '{}' : '';
      }
      // Replace Prometheus labels surrounded by {{ }} in the graph legend label templates
      // Regex is based on https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels
      // with additional matchers to allow leading and trailing whitespace
      return title.replace(
        /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g,
        (match, key) => labels[key] ?? '',
      );
    },
    [panel],
  );
  const [csvData, setCsvData] = useState([]);

  const csvExportHandler = () => {
    let csvString = '';
    const result = {};
    const seriesNames = [];
    for (let i = 0; i < csvData.length; i++) {
      const query = csvData[i];
      for (const series of query) {
        if (!series[0]) {
          continue;
        }
        const name = formatSeriesTitle(series[0], i);
        seriesNames.push(name);
        if (!name) {
          continue;
        }
        if (!Array.isArray(series[1])) {
          continue;
        }
        for (const entry of series[1]) {
          const dateTime = entry.x.toISOString();
          const value = entry.y;
          if (!result[dateTime]) {
            result[dateTime] = {};
          }
          result[dateTime][name] = value;
        }
      }
    }
    const uniqueSeriesNames = new Set(seriesNames);
    const uniqueSeriesArray = Array.from(uniqueSeriesNames);

    csvString = `DateTime,${uniqueSeriesArray.join(',')}\n`;

    for (const dateTime in result) {
      const temp = [];
      for (const name of uniqueSeriesArray) {
        temp.push(result[dateTime][name]);
      }
      csvString += `${dateTime},${temp.join(',')}\n`;
    }

    const blobCsvData = new Blob([csvString], { type: 'text/csv' });
    const csvURL = URL.createObjectURL(blobCsvData);
    const link = document.createElement('a');
    link.href = csvURL;
    link.download = `graphData.csv`;
    link.click();
  };

  const isThereCsvData = () => {
    if (csvData.length > 0) {
      if (csvData[0].length > 0) {
        return true;
      }
    }
    return false;
  };

  const dropdownItems = [
    <DropdownItem
      key="action"
      component="button"
      onClick={csvExportHandler}
      isDisabled={!isThereCsvData()}
      data-test={LegacyDashboardPageTestIDs.ExportAsCsv}
    >
      {t('Export as CSV')}
    </DropdownItem>,
  ];

  useEffect(() => {
    const getCustomDataSource = async () => {
      if (!customDataSourceName) {
        setDataSourceInfoLoading(false);
        setCustomDataSource(null);
      } else if (!extensionsResolved) {
        setDataSourceInfoLoading(true);
      } else if (hasExtensions) {
        const extension = extensions.find(
          (ext) => ext?.properties?.contextId === 'monitoring-dashboards',
        );
        const getDataSource = extension?.properties?.getDataSource;
        const dataSource = await getDataSource?.(customDataSourceName);

        if (!dataSource || !dataSource.basePath) {
          setIsError(true);
          setDataSourceInfoLoading(false);
        } else {
          setCustomDataSource(dataSource);
          setDataSourceInfoLoading(false);
        }
      } else {
        setDataSourceInfoLoading(false);
        setIsError(true);
      }
    };
    getCustomDataSource().catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      setIsError(true);
    });
  }, [extensions, extensionsResolved, customDataSourceName, hasExtensions]);

  const handleZoom = useCallback((timeRange: number, endTime: number) => {
    setQueryArguments({
      [QueryParams.EndTime]: endTime.toString(),
      [QueryParams.TimeRange]: timeRange.toString(),
    });
  }, []);

  const panelBreakpoints = useMemo(() => {
    const panelSpan = getPanelSpan(panel);
    return {
      sm: 12 as gridSpans,
      md: Math.max(panelSpan, 6) as gridSpans,
      lg: Math.max(panelSpan, 4) as gridSpans,
      xl: Math.max(panelSpan, 3) as gridSpans,
    };
  }, [panel]);

  if (panel.type === 'row') {
    return (
      <>
        {_.map(panel.panels, (p) => (
          <Card key={p.id} panel={p} perspective={perspective} />
        ))}
      </>
    );
  }

  if (!['gauge', 'grafana-piechart-panel', 'graph', 'singlestat', 'table'].includes(panel.type)) {
    return null;
  }

  const rawQueries = _.map(panel.targets, 'expr');
  if (!rawQueries.length) {
    return null;
  }
  const queries = rawQueries.map((expr) => evaluateVariableTemplate(expr, variables, timespan));
  const isLoading =
    (_.some(queries, _.isUndefined) && dataSourceInfoLoading) || customDataSource === undefined;

  return (
    <GridItem
      span={panelBreakpoints.sm}
      md={panelBreakpoints.md}
      lg={panelBreakpoints.lg}
      xl={panelBreakpoints.xl}
    >
      <PFCard
        data-test={`${panel.title.toLowerCase().replace(/\s+/g, '-')}-chart`}
        data-test-id={panel.id ? `chart-${panel.id}` : undefined}
        style={{ overflow: 'visible' }}
        isFullHeight
      >
        <CardHeader
          actions={{
            actions: (
              <>
                {!isLoading && (
                  <QueryBrowserLink
                    queries={queries}
                    customDataSourceName={customDataSourceName}
                    units={panel?.yaxes?.[0]?.format as GraphUnits}
                  />
                )}
                {panel.type === 'graph' && <KebabDropdown dropdownItems={dropdownItems} />}
              </>
            ),
            hasNoOffset: true,
          }}
        >
          <CardTitle>{panel.title}</CardTitle>
        </CardHeader>
        <CardBody>
          {isError ? (
            <>
              <RedExclamationCircleIcon /> {t('Error loading card')}
            </>
          ) : (
            <div ref={ref} style={{ height: '100%' }}>
              {isLoading || !wasEverVisible ? (
                <GraphEmpty loading />
              ) : (
                <>
                  {panel.type === 'grafana-piechart-panel' && (
                    <BarChart
                      pollInterval={pollInterval}
                      query={queries[0]}
                      customDataSource={customDataSource}
                    />
                  )}
                  {panel.type === 'graph' && (
                    <Graph
                      formatSeriesTitle={formatSeriesTitle}
                      isStack={panel.stack}
                      pollInterval={pollInterval}
                      queries={queries}
                      showLegend={panel.legend?.show}
                      units={panel.yaxes?.[0]?.format}
                      onZoomHandle={handleZoom}
                      customDataSource={customDataSource}
                      perspective={perspective}
                      onDataChange={(data) => setCsvData(data)}
                    />
                  )}
                  {(panel.type === 'singlestat' || panel.type === 'gauge') && (
                    <SingleStat
                      panel={panel}
                      pollInterval={pollInterval}
                      query={queries[0]}
                      namespace={namespace}
                      customDataSource={customDataSource}
                    />
                  )}
                  {panel.type === 'table' && (
                    <Table
                      panel={panel}
                      pollInterval={pollInterval}
                      queries={queries}
                      namespace={namespace}
                      customDataSource={customDataSource}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </CardBody>
      </PFCard>
    </GridItem>
  );
});

const PanelsRow: FC<PanelsRowProps> = ({ row, perspective }) => {
  const showButton = row.showTitle && !_.isEmpty(row.title);

  const [isExpanded, toggleIsExpanded] = useBoolean(showButton ? !row.collapse : true);

  return (
    <Flex direction={{ default: 'column' }} data-test-id={`panel-${_.kebabCase(row?.title)}`}>
      {showButton && (
        <FlexItem>
          <ExpandableSectionToggle isExpanded={isExpanded} onToggle={toggleIsExpanded}>
            <span style={{ fontSize: t_global_font_size_heading_h2.var }}>{row.title}</span>
          </ExpandableSectionToggle>
        </FlexItem>
      )}
      {isExpanded && (
        <FlexItem>
          <Grid hasGutter>
            {_.map(row.panels, (panel) => (
              <Card key={panel.id} panel={panel} perspective={perspective} />
            ))}
          </Grid>
        </FlexItem>
      )}
    </Flex>
  );
};

export const LegacyDashboard: FC<BoardProps> = ({ rows, perspective }) => (
  <Flex direction={{ default: 'column' }}>
    {_.map(rows, (row) => (
      <FlexItem>
        <PanelsRow key={_.map(row.panels, 'id').join()} row={row} perspective={perspective} />
      </FlexItem>
    ))}
  </Flex>
);

type BoardProps = {
  rows: Row[];
  perspective: Perspective;
};

type CardProps = {
  panel: Panel;
  perspective: Perspective;
};

type PanelsRowProps = {
  row: Row;
  perspective: Perspective;
};
