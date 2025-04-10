import * as _ from 'lodash-es';
import classNames from 'classnames';
import * as React from 'react';
import {
  PrometheusEndpoint,
  PrometheusLabels,
  PrometheusResponse,
  PrometheusResult,
  PrometheusValue,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Chart,
  ChartArea,
  ChartAxis,
  ChartGroup,
  ChartLegend,
  ChartLine,
  ChartStack,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import {
  Alert,
  Button,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  MenuToggle,
  MenuToggleElement,
  InputGroup,
  TextInput,
  Title,
  InputGroupItem,
  Card,
  CardHeader,
  Split,
  SplitItem,
  Level,
  LevelItem,
  CardBody,
} from '@patternfly/react-core';
import { ChartLineIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import {
  queryBrowserDeleteAllSeries,
  queryBrowserPatchQuery,
  queryBrowserSetTimespan,
} from '../actions/observe';

import { GraphEmpty } from './console/graphs/graph-empty';
import { getPrometheusURL } from './console/graphs/helpers';
import {
  dateFormatterNoYear,
  timeFormatter,
  timeFormatterWithSeconds,
} from './console/utils/datetime';
import { usePoll } from './console/utils/poll-hook';
import { useRefWidth } from './console/utils/ref-width-hook';
import { useSafeFetch } from './console/utils/safe-fetch-hook';

import { useBoolean } from './hooks/useBoolean';
import { queryBrowserTheme } from './query-browser-theme';
import { PrometheusAPIError, TimeRange } from './types';
import { getTimeRanges } from './utils';

import { getLegacyObserveState, usePerspective } from './hooks/usePerspective';
import { MonitoringState } from '../reducers/observe';
import { LoadingInline } from './console/console-shared/src/components/loading/LoadingInline';
import {
  formatPrometheusDuration,
  parsePrometheusDuration,
} from './console/console-shared/src/datetime/prometheus';
import withFallback from './console/console-shared/error/fallbacks/withFallback';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import {
  QueryBrowserTooltip,
  valueFormatter,
} from './console/console-shared/src/components/query-browser/QueryBrowserTooltip';
import {
  chart_area_Opacity,
  chart_axis_tick_Size,
  t_chart_global_fill_color_200,
} from '@patternfly/react-tokens';
import './query-browser.scss';

const spans = ['5m', '15m', '30m', '1h', '2h', '6h', '12h', '1d', '2d', '1w', '2w'];
export const colors = queryBrowserTheme.line.colorScale;

export const Error: React.FC<ErrorProps> = ({ error, title = 'An error occurred' }) => (
  <Alert isInline title={title} variant="danger">
    {_.get(error, 'json.error', error.message)}
  </Alert>
);

const BOTTOM_SERIES_HEIGHT = 34;
const LEGEND_HEIGHT = 75;
const CHART_HEIGHT = 200;

const GraphEmptyState: React.FC<GraphEmptyStateProps> = ({ children, title }) => (
  <div>
    <EmptyState
      titleText={
        <Title headingLevel="h2" size="md">
          {title}
        </Title>
      }
      icon={ChartLineIcon}
      variant={EmptyStateVariant.full}
    >
      <EmptyStateBody>{children}</EmptyStateBody>
    </EmptyState>
  </div>
);

const SpanControls: React.FC<SpanControlsProps> = React.memo(
  ({ defaultSpanText, onChange, span, hasReducedResolution }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    const [isValid, setIsValid] = React.useState(true);
    const [text, setText] = React.useState(formatPrometheusDuration(span));

    const [isOpen, setIsOpen, , setClosed] = useBoolean(false);

    React.useEffect(() => {
      setText(formatPrometheusDuration(span));
    }, [span]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedOnChange = React.useCallback(_.debounce(onChange, 400), [onChange]);

    const setSpan = (newText: string, isDebounced = false) => {
      const newSpan = parsePrometheusDuration(newText);
      const newIsValid = newSpan > 0;
      setIsValid(newIsValid);
      setText(newText);
      if (newIsValid && newSpan !== span) {
        const fn = isDebounced ? debouncedOnChange : onChange;
        fn(newSpan);
      }
    };

    const dropdownItems = spans.map((s) => (
      <DropdownItem key={s} onClick={() => setSpan(s, true)}>
        {s}
      </DropdownItem>
    ));

    return (
      <Level hasGutter>
        <LevelItem>
          <InputGroup>
            <InputGroupItem isFill>
              <TextInput
                aria-label={t('graph timespan')}
                validated={isValid ? 'default' : 'error'}
                onChange={(_event, v) => setSpan(v, true)}
                type="text"
                value={text}
              />
            </InputGroupItem>
            <InputGroupItem>
              <Dropdown
                isOpen={isOpen}
                onSelect={setClosed}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={setIsOpen}
                    isExpanded={isOpen}
                    aria-label={t('graph timespan')}
                  />
                )}
                popperProps={{ position: 'right' }}
              >
                <DropdownList>{dropdownItems}</DropdownList>
              </Dropdown>
            </InputGroupItem>
          </InputGroup>
        </LevelItem>
        <LevelItem>
          <Button onClick={() => setSpan(defaultSpanText)} type="button" variant="tertiary">
            {t('Reset zoom')}
          </Button>
        </LevelItem>
        <LevelItem>
          {hasReducedResolution && (
            <Alert
              isInline
              isPlain
              title={t('Displaying with reduced resolution due to large dataset.')}
              variant="info"
              truncateTitle={1}
            />
          )}
        </LevelItem>
      </Level>
    );
  },
);

const LegendContainer = ({ children }: { children?: React.ReactNode }) => {
  // The first child should be a <rect> with a `width` prop giving the legend's content width
  const width = children?.[0]?.props?.width ?? '100%';

  return (
    <foreignObject height={LEGEND_HEIGHT} width="100%" y={CHART_HEIGHT}>
      <div className="monitoring-plugin-dashboards__legend-wrap monitoring-plugin-horizontal-scroll">
        <svg width={width}>{children}</svg>
      </div>
    </foreignObject>
  );
};

const Null = () => null;
const nullComponent = <Null />;

type GraphSeries = GraphDataPoint[] | null;

const getXDomain = (endTime: number, span: number): AxisDomain => [endTime - span, endTime];

const ONE_MINUTE = 60 * 1000;

const Graph: React.FC<GraphProps> = React.memo(
  ({
    allSeries,
    disabledSeries,
    fixedXDomain,
    formatSeriesTitle,
    isStack,
    showLegend,
    span,
    units,
    width,
  }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    const data: GraphSeries[] = [];
    const tooltipSeriesNames: string[] = [];
    const tooltipSeriesLabels: PrometheusLabels[] = [];
    const legendData: { name: string }[] = [];

    const [xDomain, setXDomain] = React.useState(fixedXDomain || getXDomain(Date.now(), span));

    // Only update X-axis if the time range (fixedXDomain or span) or graph data (allSeries) change
    React.useEffect(() => {
      setXDomain(fixedXDomain || getXDomain(Date.now(), span));
    }, [allSeries, span, fixedXDomain]);

    const domain = { x: xDomain, y: undefined };

    _.each(allSeries, (series, i) => {
      _.each(series, ([metric, values]) => {
        // Ignore any disabled series
        data.push(_.some(disabledSeries?.[i], (s) => _.isEqual(s, metric)) ? null : values);
        if (formatSeriesTitle) {
          const name = formatSeriesTitle(metric, i);
          legendData.push({ name });
          tooltipSeriesNames.push(name);
        } else {
          tooltipSeriesLabels.push(metric);
        }
      });
    });

    if (!data.some(Array.isArray)) {
      return <GraphEmpty />;
    }

    let yTickFormat = valueFormatter(units);

    if (isStack) {
      // Specify Y axis range if all values are zero, but otherwise let Chart set it automatically
      const isAllZero = _.every(allSeries, (series) =>
        _.every(series, ([, values]) => _.every(values, { y: 0 })),
      );
      if (isAllZero) {
        domain.y = [0, 1];
      }
    } else {
      // Set a reasonable Y-axis range based on the min and max values in the data
      const findMin = (series: GraphSeries): GraphDataPoint => _.minBy(series, 'y');
      const findMax = (series: GraphSeries): GraphDataPoint => _.maxBy(series, 'y');
      let minY: number = findMin(data.map(findMin))?.y ?? 0;
      let maxY: number = findMax(data.map(findMax))?.y ?? 0;
      if (minY === 0 && maxY === 0) {
        minY = 0;
        maxY = 1;
      } else if (minY > 0 && maxY > 0) {
        minY = 0;
      } else if (minY < 0 && maxY < 0) {
        maxY = 0;
      }

      domain.y = [minY, maxY];

      if (Math.abs(maxY - minY) < 0.005) {
        yTickFormat = (v: number) => (v === 0 ? '0' : v.toExponential(1));
      }
    }

    const xAxisTickCount = Math.round(width / 100);
    const xAxisTickShowSeconds = span < xAxisTickCount * ONE_MINUTE;
    const xAxisTickFormat = (d) => {
      if (span > parsePrometheusDuration('1d')) {
        // Add a newline between the date and time so tick labels don't overlap.
        return `${dateFormatterNoYear.format(d)}\n${timeFormatter.format(d)}`;
      }
      if (xAxisTickShowSeconds) {
        return timeFormatterWithSeconds.format(d);
      }
      return timeFormatter.format(d);
    };

    const GroupComponent = isStack ? ChartStack : ChartGroup;
    const ChartComponent = isStack ? ChartArea : ChartLine;

    const hasLegend = showLegend && !_.isEmpty(legendData);

    return (
      <Chart
        containerComponent={
          <ChartVoronoiContainer
            activateData={false}
            labelComponent={<QueryBrowserTooltip height={CHART_HEIGHT - BOTTOM_SERIES_HEIGHT} />}
            labels={() => ' '}
            mouseFollowTooltips={true}
            voronoiDimension="x"
            voronoiPadding={0}
          />
        }
        ariaTitle={t('query browser chart')}
        domain={domain}
        domainPadding={{ y: 1 }}
        height={hasLegend ? CHART_HEIGHT + LEGEND_HEIGHT : CHART_HEIGHT}
        scale={{ x: 'time', y: 'linear' }}
        theme={queryBrowserTheme}
        width={width}
        padding={{
          bottom: hasLegend ? BOTTOM_SERIES_HEIGHT + LEGEND_HEIGHT : BOTTOM_SERIES_HEIGHT,
          left: 65,
          right: 15,
          top: 5,
        }}
      >
        <ChartAxis
          tickCount={xAxisTickCount}
          tickFormat={xAxisTickFormat}
          style={{ tickLabels: { fontSize: 12 }, axisLabel: { fontSize: 12 } }}
        />
        <ChartAxis
          crossAxis={false}
          dependentAxis
          tickComponent={nullComponent}
          tickCount={6}
          tickFormat={yTickFormat}
          style={{ tickLabels: { fontSize: 12 }, axisLabel: { fontSize: 12 } }}
        />
        <GroupComponent>
          {data.map((values, i) => {
            if (values === null) {
              return null;
            }
            const color = colors[i % colors.length];
            const style = {
              data: { [isStack ? 'fill' : 'stroke']: color },
              labels: {
                fill: color,
                labels: tooltipSeriesLabels[i],
                name: tooltipSeriesNames[i],
                units,
              },
            };
            return (
              // We need to use the `name` prop to prevent an error in VictorySharedEvents when
              // dynamically removing and then adding back data series
              <ChartComponent
                data={values}
                groupComponent={<g />}
                key={i}
                name={`series-${i}`}
                style={style}
              />
            );
          })}
        </GroupComponent>
        {hasLegend && (
          <ChartLegend
            data={legendData}
            groupComponent={<LegendContainer />}
            gutter={30}
            itemsPerRow={4}
            orientation="vertical"
            symbolSpacer={4}
            style={{
              labels: { fontSize: 12 },
            }}
            padding={{
              top: BOTTOM_SERIES_HEIGHT,
            }}
          />
        )}
      </Chart>
    );
  },
);

const formatSeriesValues = (
  values: PrometheusValue[],
  samples: number,
  span: number,
  defaultEmptyValue: 0 | null,
): GraphDataPoint[] => {
  const newValues = _.map(values, (v) => {
    const y = Number(v[1]);
    return {
      x: new Date(v[0] * 1000),
      y: Number.isNaN(y) ? defaultEmptyValue : y,
    };
  });

  // The data may have missing values, so we fill those gaps with nulls so that the graph correctly
  // shows the missing values as gaps in the line
  const start = Number(_.get(newValues, '[0].x'));
  const end = Number(_.get(_.last(newValues), 'x'));
  const step = span / samples;
  _.range(start, end, step).forEach((t, i) => {
    const x = new Date(t);
    if (_.get(newValues, [i, 'x']) > x) {
      newValues.splice(i, 0, { x, y: null });
    }
  });

  return newValues;
};

// Try to limit the graph to this number of data points
const maxDataPointsSoft = 6000;

// If we have more than this number of data points, do not render the graph
const maxDataPointsHard = 10000;

// Min and max number of data samples per data series
const minSamples = 10;
const maxSamples = 300;

// Fall back to a line chart for performance if there are too many series
const maxStacks = 50;

// We don't want to refresh all the graph data for just a small adjustment in the number of samples,
// so don't update unless the number of samples would change by at least this proportion
const samplesLeeway = 0.2;

// Minimum step (milliseconds between data samples) because tiny steps reduce performance for almost
// no benefit
const minStep = 5 * 1000;

// Don't allow zooming to less than this number of milliseconds
const minSpan = 30 * 1000;

// Don't poll more often than this number of milliseconds
const minPollInterval = 10 * 1000;

const ZoomableGraph: React.FC<ZoomableGraphProps> = ({
  allSeries,
  disabledSeries,
  fixedXDomain,
  formatSeriesTitle,
  isStack,
  onZoom,
  showLegend,
  span,
  units,
  width,
}) => {
  const [isZooming, setIsZooming] = React.useState(false);
  const [x1, setX1] = React.useState(0);
  const [x2, setX2] = React.useState(0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsZooming(false);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsZooming(true);
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    setX1(x);
    setX2(x);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    setX2(e.clientX - e.currentTarget.getBoundingClientRect().left);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    setIsZooming(false);

    const xMin = Math.min(x1, x2);
    const xMax = Math.max(x1, x2);

    // Don't do anything if a range was not selected (don't zoom if you just click the graph)
    if (xMax === xMin) {
      return;
    }

    const zoomWidth = e.currentTarget.getBoundingClientRect().width;
    const oldFrom = _.get(fixedXDomain, '[0]', Date.now() - span);
    let from = oldFrom + (span * xMin) / zoomWidth;
    let to = oldFrom + (span * xMax) / zoomWidth;
    let newSpan = to - from;

    if (newSpan < minSpan) {
      newSpan = minSpan;
      const middle = (from + to) / 2;
      from = middle - newSpan / 2;
      to = middle + newSpan / 2;
    }
    onZoom(from, to);
  };

  // tabIndex is required to enable the onKeyDown handler
  const handlers = isZooming
    ? { onKeyDown, onMouseMove, onMouseUp, tabIndex: -1 }
    : { onMouseDown };

  return (
    <div style={{ cursor: 'ew-resize' }} {...handlers}>
      {isZooming && (
        <div
          style={{
            left: Math.min(x1, x2),
            width: Math.abs(x1 - x2),
            bottom: 24 /* --pf-t--global--spacer--lg */ + chart_axis_tick_Size.value,
            top: 4, // --pf-t--global--spacer-xs
            position: 'absolute',
            opacity: chart_area_Opacity.value,
            backgroundColor: t_chart_global_fill_color_200.value,
          }}
        />
      )}
      <Graph
        allSeries={allSeries}
        disabledSeries={disabledSeries}
        fixedXDomain={fixedXDomain}
        formatSeriesTitle={formatSeriesTitle}
        isStack={isStack}
        showLegend={showLegend}
        span={span}
        units={units}
        width={width}
      />
    </div>
  );
};

const getMaxSamplesForSpan = (span: number) =>
  _.clamp(Math.round(span / minStep), minSamples, maxSamples);

const QueryBrowser_: React.FC<QueryBrowserProps> = ({
  customDataSource,
  defaultSamples,
  defaultTimespan = parsePrometheusDuration('30m'),
  disabledSeries,
  disableZoom,
  filterLabels,
  fixedEndTime,
  formatSeriesTitle,
  GraphLink,
  hideControls,
  isStack = false,
  onZoom,
  pollInterval,
  queries,
  showLegend,
  showStackedControl = false,
  timespan,
  units,
  onDataChange,
  isPlain = false,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const hideGraphs = useSelector(
    (state: MonitoringState) => !!getLegacyObserveState(perspective, state)?.get('hideGraphs'),
  );
  const tickInterval = useSelector(
    (state: MonitoringState) =>
      pollInterval ??
      getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'pollInterval']),
  );
  const lastRequestTime = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['queryBrowser', 'lastRequestTime']),
  );

  const dispatch = useDispatch();

  // For the default time span, use the first of the suggested span options that is at least as long
  // as defaultTimespan
  const defaultSpanText = spans.find((s) => parsePrometheusDuration(s) >= defaultTimespan);
  // If we have both `timespan` and `defaultTimespan`, `timespan` takes precedence
  const [span, setSpan] = React.useState(timespan || parsePrometheusDuration(defaultSpanText));

  // Limit the number of samples so that the step size doesn't fall below minStep
  const maxSamplesForSpan = defaultSamples || getMaxSamplesForSpan(span);

  const [xDomain, setXDomain] = React.useState<AxisDomain>();
  const [error, setError] = React.useState<PrometheusAPIError>();
  const [isDatasetTooBig, setIsDatasetTooBig] = React.useState(false);
  const [graphData, setGraphData] = React.useState<Series[][]>(null);
  const [samples, setSamples] = React.useState(maxSamplesForSpan);
  const [updating, setUpdating] = React.useState(true);

  const [containerRef, width] = useRefWidth();

  const endTime = xDomain?.[1];

  const safeFetch = useSafeFetch();

  const [isStacked, setIsStacked] = React.useState(isStack);

  const canStack = _.sumBy(graphData, 'length') <= maxStacks;

  const [activeNamespace] = useActiveNamespace();

  // If provided, `timespan` overrides any existing span setting
  React.useEffect(() => {
    if (timespan) {
      setSpan(timespan);
      setSamples(defaultSamples || getMaxSamplesForSpan(timespan));
    }
  }, [defaultSamples, timespan]);

  React.useEffect(() => {
    setGraphData(null);
    if (fixedEndTime) {
      setXDomain(getXDomain(fixedEndTime, span));
    }
  }, [fixedEndTime, span]);

  React.useEffect(() => {
    if (!fixedEndTime) {
      setXDomain(undefined);
    }
  }, [fixedEndTime]);

  // Clear any existing series data when the namespace is changed
  React.useEffect(() => {
    dispatch(queryBrowserDeleteAllSeries());
  }, [dispatch, activeNamespace]);

  const tick = () => {
    if (hideGraphs) {
      return undefined;
    }

    // Define this once for all queries so that they have exactly the same time range and X values
    const now = Date.now();
    const timeRanges = getTimeRanges(span, endTime || now);

    const queryPromises = _.map(queries, (query) => {
      if (_.isEmpty(query)) {
        return Promise.resolve([]);
      } else {
        const promiseMap: Promise<PrometheusResponse>[] = _.map(
          timeRanges,
          (timeRange: TimeRange) =>
            safeFetch<PrometheusResponse>(
              getPrometheusURL(
                {
                  endpoint: PrometheusEndpoint.QUERY_RANGE,
                  endTime: timeRange.endTime,
                  namespace: perspective === 'dev' ? activeNamespace : '',
                  query,
                  samples: Math.ceil(samples / timeRanges.length),
                  timeout: '60s',
                  timespan: timeRange.duration - 1,
                },
                perspective,
                customDataSource?.basePath,
              ),
            ),
        );
        return Promise.all(promiseMap).then((responses) => {
          const results: PrometheusResult[][] = _.map(responses, 'data.result');
          const combinedQueries = results.reduce(
            (accumulator: PrometheusResult[], response: PrometheusResult[]): PrometheusResult[] => {
              response.forEach((metricResult) => {
                const index = accumulator.findIndex(
                  (item) => JSON.stringify(item.metric) === JSON.stringify(metricResult.metric),
                );
                if (index === -1) {
                  accumulator.push(metricResult);
                } else {
                  accumulator[index].values = accumulator[index].values.concat(metricResult.values);
                }
              });
              return accumulator;
            },
            [],
          );
          // Recombine into the original query to allow for the redux store and the things using
          // it (query duplication, ect) to be able to work. Grab the heading of the first response
          // for the status and structure of the response
          const queryResponse = responses.at(0);
          if (!queryResponse) {
            return [];
          }
          queryResponse.data.result = combinedQueries;
          return queryResponse;
        });
      }
    });

    return Promise.all(queryPromises)
      .then((responses: PrometheusResponse[]) => {
        const newResults = _.map(responses, 'data.result');
        const numDataPoints = _.sumBy(newResults, (r) => _.sumBy(r, 'values.length'));

        if (numDataPoints > maxDataPointsHard && samples === minSamples) {
          setIsDatasetTooBig(true);
          return;
        }
        setIsDatasetTooBig(false);

        const newSamples = _.clamp(
          Math.floor((samples * maxDataPointsSoft) / numDataPoints),
          minSamples,
          maxSamplesForSpan,
        );

        // Change `samples` if either
        //   - It will change by a proportion greater than `samplesLeeway`
        //   - It will change to the upper or lower limit of its allowed range
        if (
          Math.abs(newSamples - samples) / samples > samplesLeeway ||
          (newSamples !== samples &&
            (newSamples === maxSamplesForSpan || newSamples === minSamples))
        ) {
          setSamples(newSamples);
        } else {
          const newGraphData = _.map(
            newResults,
            (result: PrometheusResult[], queryIndex: number) => {
              return _.map(result, ({ metric, values }): Series => {
                // If filterLabels is specified, ignore all series that don't match
                if (_.some(filterLabels, (v, k) => _.has(metric, k) && metric[k] !== v)) {
                  return [];
                } else {
                  let defaultEmptyValue = null;
                  if (isStack && _.some(values, (value) => Number.isNaN(Number(value[1])))) {
                    // eslint-disable-next-line no-console
                    console.warn(
                      'Invalid response values for stacked graph converted to 0 for query: ',
                      queries[queryIndex],
                    );
                    defaultEmptyValue = 0;
                  }
                  return [metric, formatSeriesValues(values, samples, span, defaultEmptyValue)];
                }
              });
            },
          );
          setGraphData(newGraphData);
          onDataChange?.(newGraphData);

          _.each(newResults, (r, i) =>
            dispatch(queryBrowserPatchQuery(i, { series: r ? _.map(r, 'metric') : undefined })),
          );
          setUpdating(false);
        }
        setError(undefined);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // eslint-disable-next-line no-console
          console.log(err);
          setError(err);
          setUpdating(false);
        }
      });
  };

  // Don't poll if an end time was set (because the latest data is not displayed) or if the graph is
  // hidden. Otherwise use a polling interval relative to the graph's timespan.
  let delay: number;
  if (endTime || hideGraphs || tickInterval === null) {
    delay = null;
  } else if (tickInterval > 0) {
    delay = tickInterval;
  } else {
    delay = Math.max(span / 120, minPollInterval);
  }

  const queriesKey = _.reject(queries, _.isEmpty).join();
  usePoll(
    tick,
    delay,
    endTime,
    filterLabels,
    activeNamespace,
    queriesKey,
    samples,
    span,
    lastRequestTime,
  );

  React.useLayoutEffect(
    () => setUpdating(true),
    [endTime, activeNamespace, queriesKey, samples, span],
  );

  const onSpanChange = React.useCallback(
    (newSpan: number) => {
      setGraphData(null);
      setXDomain(undefined);
      setSpan(newSpan);
      dispatch(queryBrowserSetTimespan(newSpan));
      setSamples(defaultSamples || getMaxSamplesForSpan(newSpan));
    },
    [defaultSamples, dispatch],
  );

  const isRangeVector = _.get(error, 'json.error', '').match(
    /invalid expression type "range vector"/,
  );

  if (hideGraphs) {
    // Still render the graph containers so that `width` continues to be tracked while the graph is
    // hidden. This ensures we can render at the correct width when the graph is shown again.
    return (
      <>
        {error && !isRangeVector && <Error error={error} />}
        <div>
          <div>
            <div ref={containerRef}></div>
          </div>
        </div>
      </>
    );
  }

  if (isRangeVector) {
    return (
      <GraphEmptyState title={t('Ungraphable results')}>
        {t(
          'Query results include range vectors, which cannot be graphed. Try adding a function to transform the data.',
        )}
      </GraphEmptyState>
    );
  }

  if (error?.json?.error?.match(/invalid expression type "string"/)) {
    return (
      <GraphEmptyState title={t('Ungraphable results')}>
        {t('Query result is a string, which cannot be graphed.')}
      </GraphEmptyState>
    );
  }

  if (isDatasetTooBig) {
    return (
      <GraphEmptyState title={t('Ungraphable results')}>
        {t('The resulting dataset is too large to graph.')}
      </GraphEmptyState>
    );
  }

  const zoomableGraphOnZoom = (from: number, to: number) => {
    setGraphData(null);
    setXDomain([from, to]);
    setSpan(to - from);
    setSamples(defaultSamples || getMaxSamplesForSpan(to - from));
    onZoom?.(from, to);
  };

  const isGraphDataEmpty = !graphData || graphData.every((d) => d.length === 0);
  const hasReducedResolution = !isGraphDataEmpty && samples < maxSamplesForSpan && !updating;

  return (
    <>
      <Card isCompact isPlain={isPlain} style={{ overflow: 'visible' }}>
        {hideControls ? (
          <>{updating && <LoadingInline />}</>
        ) : (
          <CardHeader>
            <Split>
              <SplitItem>
                <SpanControls
                  defaultSpanText={defaultSpanText}
                  onChange={onSpanChange}
                  span={span}
                  hasReducedResolution={hasReducedResolution}
                />
                {updating && <LoadingInline />}
              </SplitItem>
              <SplitItem isFilled />
              <SplitItem>
                {GraphLink && <GraphLink />}
                {canStack && showStackedControl && (
                  <Checkbox
                    id="stacked"
                    isChecked={isStacked}
                    data-checked-state={isStacked}
                    label={t('Stacked')}
                    onChange={(_e, v) =>
                      typeof _e === 'boolean' ? setIsStacked(_e) : setIsStacked(v)
                    }
                  />
                )}
              </SplitItem>
            </Split>
          </CardHeader>
        )}
        <CardBody
          className={classNames(
            'monitoring-plugin-graph-wrapper monitoring-plugin-graph-wrapper--query-browser',
            {
              'monitoring-plugin-graph-wrapper--query-browser--with-legend':
                showLegend && !!formatSeriesTitle,
            },
          )}
        >
          <div ref={containerRef} style={{ position: 'relative' }}>
            {error && <Error error={error} />}
            {isGraphDataEmpty && <GraphEmpty loading={updating} />}
            {!isGraphDataEmpty && width > 0 && (
              <>
                {disableZoom ? (
                  <Graph
                    allSeries={graphData}
                    disabledSeries={disabledSeries}
                    fixedXDomain={xDomain}
                    formatSeriesTitle={formatSeriesTitle}
                    isStack={canStack && isStacked}
                    showLegend={showLegend}
                    span={span}
                    units={units}
                    width={width}
                  />
                ) : (
                  <ZoomableGraph
                    allSeries={graphData}
                    disabledSeries={disabledSeries}
                    fixedXDomain={xDomain}
                    formatSeriesTitle={formatSeriesTitle}
                    isStack={canStack && isStacked}
                    onZoom={zoomableGraphOnZoom}
                    showLegend={showLegend}
                    span={span}
                    units={units}
                    width={width}
                  />
                )}
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </>
  );
};
export const QueryBrowser = withFallback(QueryBrowser_);

type AxisDomain = [number, number];

type GraphDataPoint = {
  x: Date;
  y: number;
};

type Series = [PrometheusLabels, GraphDataPoint[]] | [];

export type FormatSeriesTitle = (labels: PrometheusLabels, i?: number) => string;

type ErrorProps = {
  error: PrometheusAPIError;
  title?: string;
};

type GraphEmptyStateProps = {
  children: React.ReactNode;
  title: string;
};

type GraphProps = {
  allSeries: Series[][];
  disabledSeries?: PrometheusLabels[][];
  fixedXDomain?: AxisDomain;
  formatSeriesTitle?: FormatSeriesTitle;
  isStack?: boolean;
  showLegend?: boolean;
  span: number;
  units: string;
  width: number;
};

type GraphOnZoom = (from: number, to: number) => void;

type ZoomableGraphProps = GraphProps & { onZoom: GraphOnZoom };

export type QueryBrowserProps = {
  customDataSource?: CustomDataSource;
  defaultSamples?: number;
  defaultTimespan?: number;
  disabledSeries?: PrometheusLabels[][];
  disableZoom?: boolean;
  filterLabels?: PrometheusLabels;
  fixedEndTime?: number;
  formatSeriesTitle?: FormatSeriesTitle;
  GraphLink?: React.ComponentType;
  hideControls?: boolean;
  isStack?: boolean;
  onZoom?: GraphOnZoom;
  pollInterval?: number;
  queries: string[];
  showLegend?: boolean;
  showStackedControl?: boolean;
  timespan?: number;
  units?: string;
  onDataChange?: (data: any) => void;
  isPlain?: boolean;
};

type SpanControlsProps = {
  defaultSpanText: string;
  onChange: (span: number) => void;
  span: number;
  hasReducedResolution: boolean;
};
