import { ChartLegendTooltipProps } from '@patternfly/react-charts/victory';
import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartLegendTooltip,
  ChartStack,
  createContainer,
} from '@patternfly/react-charts/victory';
import { getResizeObserver } from '@patternfly/react-core';
import { Alert, Card, CardBody } from '@patternfly/react-core';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CenteredContainer } from '@/features/logging/components/CenteredContainer';
import '@/features/logging/components/logs-histogram.css';
import {
  dateToFormat,
  getTimeFormatFromInterval,
  getTimeFormatFromTimeRange,
} from '@/features/logging/utils/date-utils';
import {
  isMatrixResult,
  MetricValue,
  QueryRangeResponse,
  Schema,
  TimeRange,
  TimeRangeNumber,
} from '@/features/logging/utils/logs-types';
import {
  getSeverityColor,
  Severity,
  severityAbbreviations,
  severityFromString,
} from '@/features/logging/utils/severity';
import { TestIds } from '@/features/logging/utils/test-ids';
import { intervalFromTimeRange, numericTimeRange } from '@/features/logging/utils/time-range';
import { valueWithScalePrefix } from '@/features/logging/utils/value-utils';

const GRAPH_HEIGHT = 130;
const LEFT_PADDING = 50;
const BOTTOM_PADDING = 50;
const TOP_PADDING = 10;

const SORTED_CHART_GROUPS: Array<Severity> = [
  'critical',
  'error',
  'warning',
  'debug',
  'info',
  'trace',
  'unknown',
];

type ChartData = {
  x: number;
  y: number;
  name: string;
  time: string;
  label: string;
};

type HistogramChartData = Record<Severity, Array<ChartData>>;
type HistogramData = Record<Severity, Array<MetricValue>>;

interface LogHistogramProps {
  histogramData?: QueryRangeResponse;
  timeRange?: TimeRange;
  onChangeTimeRange?: (timeRange: TimeRange) => void;
  interval?: number;
  isLoading?: boolean;
  error?: unknown;
  schema?: Schema;
  timezone?: string;
}

const resultHasAbreviation = (
  result: Record<string, string>,
  abbreviation: Array<string>,
  schema: Schema | undefined,
): boolean => {
  if (schema == Schema.otel) {
    return !!result.severity_text && abbreviation.includes(result.severity_text);
  }
  return !!result.level && abbreviation.includes(result.level);
};

const aggregateMetricsLogData = (response?: QueryRangeResponse, schema?: Schema): HistogramData => {
  const histogramData: HistogramData = {
    critical: [],
    error: [],
    warning: [],
    info: [],
    debug: [],
    trace: [],
    unknown: [],
    other: [],
  };

  const data = response?.data;

  if (isMatrixResult(data)) {
    for (const logData of data.result) {
      let logDataIngroup = false;
      for (const [group, abbreviations] of Object.entries(severityAbbreviations)) {
        if (resultHasAbreviation(logData.metric, abbreviations, schema)) {
          histogramData[group as Severity].push(...logData.values);
          logDataIngroup = true;
          break;
        }
      }

      if (!logDataIngroup) {
        histogramData.unknown.push(...logData.values);
      }
    }
  }

  return histogramData;
};

const metricValueToChartData = (
  group: Severity,
  value: Array<MetricValue>,
  interval: number,
  timezone?: string,
): Array<ChartData> => {
  const timeEntries = new Set<number>();
  const chartData: Array<ChartData> = [];

  for (const metric of value) {
    const time = parseFloat(String(metric[0])) * 1000;
    const formattedTime = dateToFormat(time, getTimeFormatFromInterval(interval), timezone);

    // Prevent duplicate entries to avoid chart rendering issues
    if (!timeEntries.has(time)) {
      timeEntries.add(time);
      chartData.push({
        x: time,
        y: parseInt(String(metric[1]), 10),
        name: group,
        time: formattedTime,
        label: `${formattedTime} ${group}: ${metric[1]}`,
      });
    }
  }

  return chartData;
};

const getChartsData = (
  data: HistogramData,
  interval: number,
  timezone?: string,
): HistogramChartData => {
  const chartsData: HistogramChartData = {} as HistogramChartData;

  Object.keys(data).forEach((group) => {
    const severityGroup = severityFromString(group) ?? 'other';
    const chartData = metricValueToChartData(
      severityGroup,
      data[severityGroup],
      interval,
      timezone,
    );

    chartsData[severityGroup] = chartData;
  });

  return chartsData;
};

const tickCountFromTimeRange = (timeRange: TimeRangeNumber, interval: number): number =>
  Math.ceil((timeRange.end - timeRange.start) / interval);

const HistogramTooltip: FC<ChartLegendTooltipProps & { interval: number; timezone?: string }> = ({
  interval,
  timezone,
  ...props
}) => {
  const { x: xProps, y: yProps, center, height } = props;

  if (!center) {
    return null;
  }

  const { x, y } = center;

  const xCoord = x ?? xProps;
  const yCoord = y ?? yProps;

  if (xCoord === undefined || yCoord === undefined || height === undefined) {
    return null;
  }

  const fixedProps = {
    ...props,
    center: { x: xCoord, y: yCoord, ...props.center },
  };

  return (
    <>
      <ChartLegendTooltip
        {...fixedProps}
        title={(datum) => dateToFormat(datum.x ?? 0, getTimeFormatFromInterval(interval), timezone)}
        constrainToVisibleArea
      />
      <line
        className="lv-plugin__histogram__tooltip-line"
        x1={xCoord}
        x2={xCoord}
        y1={TOP_PADDING}
        y2={height - BOTTOM_PADDING}
      />
    </>
  );
};

interface SelectionComponentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const BrushHandleComponent: FC<SelectionComponentProps> = ({ x, y, width, height }) => {
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return null;
  }

  const triangleSize = 6;

  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={y}
        y2={height + y}
        style={{ stroke: 'var(--pf-v5-chart-color-blue-300)', strokeDasharray: '5 3' }}
      />
      <polygon
        points={`${x},${y} ${x - triangleSize},${y - triangleSize} ${x + triangleSize},${
          y - triangleSize
        }`}
        style={{ fill: 'var(--pf-v5-chart-color-blue-300)' }}
      />
    </g>
  );
};

const clampTimeToChartRange = (time: number, timeRange: TimeRangeNumber): number => {
  if (time > timeRange.end) {
    return timeRange.end;
  }

  if (time < timeRange.start) {
    return timeRange.start;
  }

  return time;
};

const SelectVoronoiContainer = createContainer('brush', 'voronoi');

export const LogsHistogram: FC<LogHistogramProps> = ({
  histogramData,
  timeRange,
  isLoading,
  error,
  onChangeTimeRange,
  interval,
  schema,
  timezone,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(0);
  const [timeRangeValue, setTimeRangeValue] = useState(numericTimeRange(timeRange));

  const handleResize = () => {
    if (containerRef.current?.clientWidth) {
      setWidth(containerRef.current.clientWidth);
    }
  };

  useEffect(() => {
    const observer = containerRef.current
      ? getResizeObserver(containerRef.current, handleResize)
      : undefined;
    return () => observer?.();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Imported control sync.
    setTimeRangeValue(numericTimeRange(timeRange));
  }, [timeRange, interval, histogramData]);

  const intervalValue = interval ?? intervalFromTimeRange(timeRangeValue);

  const groupsCharts = useMemo(() => {
    if (!histogramData || histogramData.data.result.length === 0) {
      return { ticks: [], charts: null, availableGroups: [] };
    }

    const data = aggregateMetricsLogData(histogramData, schema);
    const chartsData = getChartsData(data, intervalValue, timezone);

    const tickCount = tickCountFromTimeRange(timeRangeValue, intervalValue);

    const availableGroups = SORTED_CHART_GROUPS.filter(
      (group: Severity) => chartsData && chartsData[group] && chartsData[group].length > 0,
    );

    const maxBarWidth = width / 10;

    const charts = availableGroups.map((group: Severity, index: number) => {
      let barData = chartsData[group];

      /**
       * If we are in subsecond resolution, clamp time to current range so the bar is visible
       *  */
      if (timeRangeValue.end - timeRangeValue.start <= 1000) {
        barData = barData.map((d) => ({ ...d, x: clampTimeToChartRange(d.x, timeRangeValue) }));
      }

      return (
        <ChartBar
          key={`${group}-${index}`}
          data={barData}
          name={group}
          barWidth={Math.min(maxBarWidth, (width / tickCount) * 0.8)}
          style={{ data: { fill: getSeverityColor(group) } }}
          labelComponent={<g />}
        />
      );
    });

    return {
      charts,
      availableGroups,
    };
  }, [histogramData, timeRangeValue, width, intervalValue, schema, timezone]);

  const legendData = useMemo(
    () =>
      groupsCharts.availableGroups.map((group) => ({
        name: group,
        childName: group,
        symbol: { fill: getSeverityColor(group) },
      })),
    [groupsCharts.availableGroups],
  );

  const dataIsEmpty = histogramData?.data.result.length === 0;

  const handleTimeRangeSelection = (domain?: { x?: Array<Date | number> }) => {
    if (
      domain?.x &&
      domain.x.length > 1 &&
      typeof domain.x[0] === 'object' &&
      typeof domain.x[1] === 'object'
    ) {
      const start = domain.x[0];
      const end = domain.x[1];

      if (start.getTime() < end.getTime()) {
        onChangeTimeRange?.({ start: start.getTime(), end: end.getTime() });
      }
    }
  };

  return (
    <Card data-test={TestIds.LogsHistogram}>
      <CardBody>
        <div ref={containerRef} style={{ height: GRAPH_HEIGHT }}>
          {error ? (
            <CenteredContainer>
              <Alert
                variant="danger"
                isInline
                isPlain
                title={(error as Error).message || String(error)}
              />
            </CenteredContainer>
          ) : isLoading ? (
            <CenteredContainer>{t('Loading...')}</CenteredContainer>
          ) : dataIsEmpty ? (
            <CenteredContainer>
              <Alert variant="warning" isInline isPlain title={t('No datapoints found')} />
            </CenteredContainer>
          ) : histogramData ? (
            <Chart
              height={GRAPH_HEIGHT}
              padding={{
                top: TOP_PADDING,
                bottom: BOTTOM_PADDING,
                left: LEFT_PADDING,
                right: 20,
              }}
              domain={{
                x: [timeRangeValue.start, timeRangeValue.end],
              }}
              scale={{ x: 'time', y: 'linear' }}
              containerComponent={
                <SelectVoronoiContainer
                  activateData={false}
                  labels={({ datum }: { datum: ChartData }) =>
                    `${datum.y !== null ? datum.y : t('No data')}`
                  }
                  labelComponent={
                    <HistogramTooltip
                      interval={intervalValue}
                      timezone={timezone}
                      legendData={legendData}
                    />
                  }
                  voronoiDimension="x"
                  voronoiPadding={0}
                  brushDimension="x"
                  onBrushDomainChangeEnd={handleTimeRangeSelection}
                  handleComponent={<BrushHandleComponent />}
                  defaultBrushArea="none"
                  handleWidth={1}
                  allowDrag={false}
                  brushDomain={{ x: [0, 0], y: [0, 0] }}
                />
              }
              width={width}
              domainPadding={{ x: 30, y: 10 }}
            >
              <ChartAxis
                tickCount={60}
                fixLabelOverlap
                tickFormat={(tick: number) =>
                  dateToFormat(tick, getTimeFormatFromTimeRange(timeRangeValue), timezone)
                }
              />
              <ChartAxis tickCount={2} dependentAxis tickFormat={valueWithScalePrefix} />
              <ChartStack>{groupsCharts.charts}</ChartStack>
            </Chart>
          ) : (
            <div>{t('No data')}</div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
