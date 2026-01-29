import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartGroup,
  ChartLabel,
  ChartLegend,
  ChartThemeColor,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import {
  Bullseye,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Flex,
  FlexItem,
  getResizeObserver,
  Spinner,
} from '@patternfly/react-core';
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import '../incidents-styles.css';
import { IncidentsTooltip } from '../IncidentsTooltip';
import { Incident, IncidentsTimestamps } from '../model';
import {
  calculateIncidentsChartDomain,
  createIncidentsChartBars,
  generateDateArray,
  matchTimestampMetricForIncident,
<<<<<<< HEAD
  roundDateToInterval,
=======
  roundTimestampToFiveMinutes,
>>>>>>> 55a5bc3 (feat: round absolute start dates to 5 minutes boundaries)
} from '../utils';
import { dateTimeFormatter, timeFormatter } from '../../console/utils/datetime';
import { useTranslation } from 'react-i18next';
import { DataTestIDs } from '../../data-test';

/**
 * Processes component list: moves "Others" to end and limits display to 3 components
 * @param componentList - Array of component names
 * @returns Formatted component string with ellipsis if truncated
 */
const formatComponentList = (componentList: string[] | undefined): string => {
  const components = [...(componentList || [])];
  const othersIndex = components.findIndex((c) => c.toLowerCase() === 'others');
  if (othersIndex !== -1) {
    const [others] = components.splice(othersIndex, 1);
    components.push(others);
  }
  const hasMore = components.length > 3;
  return components.slice(0, 3).join(', ') + (hasMore ? ', ...' : '');
};

const IncidentsChart = ({
  incidentsData,
  incidentsTimestamps,
  chartDays,
  theme,
  selectedGroupId,
  onIncidentClick,
  currentTime,
  lastRefreshTime,
}: {
  incidentsData: Array<Incident>;
  incidentsTimestamps: IncidentsTimestamps;
  chartDays: number;
  theme: 'light' | 'dark';
  selectedGroupId: string;
  onIncidentClick: (groupId: string) => void;
  currentTime: number;
  lastRefreshTime: number | null;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [chartContainerHeight, setChartContainerHeight] = useState<number>();
  const [chartHeight, setChartHeight] = useState<number>();
  const dateValues = useMemo(
    () => generateDateArray(chartDays, currentTime),
    [chartDays, currentTime],
  );

  // enrich incidentsData with first_timestamp from timestamp metric
  incidentsData = incidentsData.map((incident) => {
    // find the matched timestamp for the incident
    const matchedMinTimestamp = matchTimestampMetricForIncident(
      incident,
      incidentsTimestamps.minOverTime,
    );

    return {
      ...incident,
      firstTimestamp: parseInt(matchedMinTimestamp?.value?.[1] ?? '0'),
    };
  });

  const { t, i18n } = useTranslation(process.env.I18N_NAMESPACE);

  const chartData = useMemo(() => {
    if (!Array.isArray(incidentsData) || incidentsData.length === 0) return [];

    const filteredIncidents = selectedGroupId
      ? incidentsData.filter((incident) => incident.group_id === selectedGroupId)
      : incidentsData;

    // Create chart bars and sort by original x values to maintain proper order
    const chartBars = filteredIncidents.map((incident) =>
      createIncidentsChartBars(incident, dateValues),
    );
    chartBars.sort((a, b) => a[0].x - b[0].x);

    // Reassign consecutive x values to eliminate gaps between bars
    return chartBars.map((bars, index) => bars.map((bar) => ({ ...bar, x: index + 1 })));
  }, [incidentsData, dateValues, selectedGroupId]);

  useEffect(() => {
    setIsLoading(false);
  }, [incidentsData]);

  useEffect(() => {
    setChartContainerHeight(chartData?.length < 5 ? 300 : chartData?.length * 60);
    setChartHeight(chartData?.length < 5 ? 250 : chartData?.length * 55);
  }, [chartData]);

  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResize = () => {
    if (containerRef.current && containerRef.current.clientWidth) {
      setWidth(containerRef.current.clientWidth);
    }
  };
  useEffect(() => {
    const observer = getResizeObserver(containerRef.current, handleResize);
    handleResize();
    return () => observer();
  }, []);

  const clickHandler = (data, datum) => {
    onIncidentClick(datum.datum.group_id);
  };

  return (
    <Card
      className="incidents-chart-card"
      style={{ overflow: 'visible' }}
      data-test={DataTestIDs.IncidentsChart.Card}
    >
      <div
        ref={containerRef}
        style={{ position: 'relative' }}
        data-test={DataTestIDs.IncidentsChart.ChartContainer}
      >
        <CardHeader>
          <Flex spaceItems={{ default: 'spaceItemsMd' }}>
            <FlexItem>
              <CardTitle data-test={DataTestIDs.IncidentsChart.Title}>
                {t('Incidents Timeline')}
              </CardTitle>
            </FlexItem>
            {lastRefreshTime && (
              <FlexItem>
                <span className="pf-v6-u-text-color-subtle">
                  {t('Last updated at')} {timeFormatter.format(new Date(lastRefreshTime))}
                </span>
              </FlexItem>
            )}
          </Flex>
        </CardHeader>
        {isLoading ? (
          <Bullseye>
            <Spinner
              aria-label="incidents-chart-spinner"
              data-test={DataTestIDs.IncidentsChart.LoadingSpinner}
            />
          </Bullseye>
        ) : (
          <CardBody
            style={{
              height: chartContainerHeight,
              width: '100%',
            }}
          >
            <Chart
              containerComponent={
                <ChartVoronoiContainer
                  labelComponent={<IncidentsTooltip />}
                  voronoiPadding={0}
                  labels={({ datum }) => {
                    if (datum.nodata) {
                      return '';
                    }
                    const startDate = dateTimeFormatter(i18n.language).format(
                      new Date(
                        roundTimestampToFiveMinutes(datum.startDate.getTime() / 1000) * 1000,
                      ),
                    );
                    const endDate = datum.firing
                      ? '---'
                      : dateTimeFormatter(i18n.language).format(
                          roundDateToInterval(new Date(datum.y)),
                        );
                    const components = formatComponentList(datum.componentList);

                    return `${t('Severity')}: ${t(datum.name)}
                    ${t('ID')}: ${datum.group_id}
                    ${t('Component(s)')}: ${components}
                    ${t('Start')}: ${startDate}
                    ${t('End')}: ${endDate}`;
                  }}
                />
              }
              domainPadding={{
                x: chartData.length <= 2 ? [60, 50] : [30, 25],
              }}
              legendData={[
                {
                  name: t('Critical'),
                  symbol: {
                    fill: t_global_color_status_danger_default.var,
                  },
                },
                {
                  name: t('Info'),
                  symbol: {
                    fill: t_global_color_status_info_default.var,
                  },
                },
                {
                  name: t('Warning'),
                  symbol: {
                    fill: t_global_color_status_warning_default.var,
                  },
                },
              ]}
              legendComponent={
                <ChartLegend
                  labelComponent={
                    <ChartLabel style={{ fill: theme === 'light' ? '#1b1d21' : '#e0e0e0' }} />
                  }
                />
              }
              legendPosition="bottom-left"
              //this should be always less than the container height
              height={chartHeight}
              padding={{
                bottom: 50, // Adjusted to accommodate legend
                left: 25,
                right: 25,
                top: 0,
              }}
              width={width}
              themeColor={ChartThemeColor.purple}
            >
              <ChartAxis
                dependentAxis
                showGrid
                tickFormat={(t) =>
                  new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
                tickValues={dateValues.map((ts) => new Date(ts * 1000))}
                tickLabelComponent={
                  <ChartLabel style={{ fill: theme === 'light' ? '#1b1d21' : '#e0e0e0' }} />
                }
                domain={calculateIncidentsChartDomain(dateValues, currentTime)}
              />
              <ChartGroup horizontal data-test={DataTestIDs.IncidentsChart.ChartBars}>
                {chartData.map((bar) => {
                  return (
                    //we have several arrays and for each array we make a ChartBar
                    <ChartBar
                      data={bar}
                      key={bar[0].group_id}
                      data-test={`${DataTestIDs.IncidentsChart.ChartBar}-${bar[0].group_id}`}
                      style={{
                        data: {
                          fill: ({ datum }) => datum.fill,
                          stroke: ({ datum }) => datum.fill,
                          fillOpacity: ({ datum }) => (datum.nodata ? 0 : 1),
                          cursor: 'pointer',
                        },
                      }}
                      events={[
                        {
                          target: 'data',
                          eventHandlers: {
                            onClick: (props, datum) => clickHandler(props, datum),
                          },
                        },
                      ]}
                    />
                  );
                })}
              </ChartGroup>
            </Chart>
          </CardBody>
        )}
      </div>
    </Card>
  );
};

export default React.memo(IncidentsChart);
