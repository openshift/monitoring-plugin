import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartGroup,
  ChartLabel,
  ChartLegend,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  getResizeObserver,
} from '@patternfly/react-core';
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import { useDispatch, useSelector } from 'react-redux';
import { IncidentsTooltip } from '../IncidentsTooltip';
import {
  createAlertsChartBars,
  generateDateArray,
  generateAlertsDateArray,
  getCurrentTime,
  roundDateToInterval,
  roundTimestampToFiveMinutes,
} from '../utils';
import { dateTimeFormatter, timeFormatter } from '../../console/utils/datetime';
import { useTranslation } from 'react-i18next';
import { AlertsChartBar } from '../model';
import { setAlertsAreLoading } from '../../../store/actions';
import { MonitoringState } from '../../../store/store';
import { isEmpty } from 'lodash-es';
import { DataTestIDs } from '../../data-test';

const AlertsChart = ({ theme }: { theme: 'light' | 'dark' }) => {
  const dispatch = useDispatch();
  const [chartContainerHeight, setChartContainerHeight] = useState<number>();
  const [chartHeight, setChartHeight] = useState<number>();
  const alertsData = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.alertsData,
  );
  const filteredData = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.filteredIncidentsData,
  );
  const incidentsActiveFilters = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.incidentsActiveFilters,
  );
  const incidentsLastRefreshTime = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.incidentsLastRefreshTime,
  );
  const { t, i18n } = useTranslation(process.env.I18N_NAMESPACE);

  const currentTime = incidentsLastRefreshTime ?? getCurrentTime();

  // Use dynamic date range based on actual alerts data instead of fixed chartDays
  const dateValues = useMemo(() => {
    if (!Array.isArray(alertsData) || alertsData.length === 0) {
      // Fallback to single day if no alerts data
      return generateDateArray(1, currentTime);
    }
    return generateAlertsDateArray(alertsData, currentTime);
  }, [alertsData, currentTime]);

  const chartData: AlertsChartBar[][] = useMemo(() => {
    if (!Array.isArray(alertsData) || alertsData.length === 0) return [];
    return alertsData.map((alert) => createAlertsChartBars(alert));
  }, [alertsData]);

  useEffect(() => {
    setChartContainerHeight(chartData?.length < 5 ? 300 : chartData?.length * 55);
    setChartHeight(chartData?.length < 5 ? 250 : chartData?.length * 55);
  }, [chartData]);

  const selectedIncidentIsVisible = useMemo(() => {
    return filteredData.some(
      (incident) => incident.group_id === incidentsActiveFilters.groupId?.[0],
    );
  }, [filteredData, incidentsActiveFilters.groupId]);

  useEffect(() => {
    dispatch(setAlertsAreLoading({ alertsAreLoading: !selectedIncidentIsVisible }));
  }, [dispatch, selectedIncidentIsVisible]);

  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleResize = useCallback(() => {
    if (containerRef.current && containerRef.current.clientWidth) {
      setWidth(containerRef.current.clientWidth);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const observer = getResizeObserver(containerRef.current, handleResize);
    handleResize();
    return () => observer();
  }, [handleResize]);

  const getOpacity = useCallback((datum) => {
    const opacity = datum.silenced ? 0.3 : 1;
    return opacity;
  }, []);

  return (
    <Card
      className="alerts-chart-card"
      style={{ overflow: 'visible' }}
      data-test={DataTestIDs.AlertsChart.Card}
    >
      <div ref={containerRef} data-test={DataTestIDs.AlertsChart.ChartContainer}>
        <CardHeader>
          <Flex spaceItems={{ default: 'spaceItemsMd' }}>
            <FlexItem>
              <CardTitle data-test={DataTestIDs.AlertsChart.Title}>
                {t('Alerts Timeline')}
              </CardTitle>
            </FlexItem>
            {incidentsLastRefreshTime && (
              <FlexItem>
                <span className="pf-v6-u-text-color-subtle">
                  {t('Last updated at')} {timeFormatter.format(new Date(incidentsLastRefreshTime))}
                </span>
              </FlexItem>
            )}
          </Flex>
        </CardHeader>
        {!selectedIncidentIsVisible || isEmpty(incidentsActiveFilters.groupId) ? (
          <EmptyState
            variant="lg"
            style={{
              height: '250px',
            }}
            data-test={DataTestIDs.AlertsChart.EmptyState}
          >
            <EmptyStateBody>
              {t('To view alerts, select an incident from the chart above or from the filters.')}
            </EmptyStateBody>
          </EmptyState>
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
                  labels={({ datum }) => {
                    if (datum.nodata) {
                      return '';
                    }
                    const startDate = dateTimeFormatter(i18n.language).format(
                      new Date(
                        roundTimestampToFiveMinutes(datum.startDate.getTime() / 1000) * 1000,
                      ),
                    );
                    const endDate =
                      datum.alertstate === 'firing'
                        ? '---'
                        : dateTimeFormatter(i18n.language).format(
                            roundDateToInterval(new Date(datum.y)),
                          );

                    const alertName = datum.silenced ? `${datum.name} (silenced)` : datum.name;

                    return `${t('Severity')}: ${t(datum.severity)}
                    ${t('Alert Name')}: ${alertName || '---'}
                    ${t('Namespace')}: ${datum.namespace || '---'}
                    ${t('Component')}: ${datum.component}
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
              />
              <ChartGroup horizontal data-test={DataTestIDs.AlertsChart.ChartContainer}>
                {chartData.map((bar, index) => {
                  return (
                    //we have several arrays and for each array we make a ChartBar
                    <ChartBar
                      data={bar}
                      key={index}
                      data-test={`${DataTestIDs.AlertsChart.ChartBar}-${index}`}
                      style={{
                        data: {
                          fill: ({ datum }) => datum.fill,
                          stroke: ({ datum }) => datum.fill,
                          fillOpacity: ({ datum }) => (datum.nodata ? 0 : getOpacity(datum)),
                        },
                      }}
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

export default AlertsChart;
