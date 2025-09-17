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
  CardTitle,
  EmptyState,
  EmptyStateBody,
  getResizeObserver,
} from '@patternfly/react-core';
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import { useDispatch, useSelector } from 'react-redux';
import { IncidentsTooltip } from '../IncidentsTooltip';
import { createAlertsChartBars, generateDateArray, generateAlertsDateArray } from '../utils';
import { dateTimeFormatter } from '../../console/utils/datetime';
import { useTranslation } from 'react-i18next';
import { AlertsChartBar } from '../model';
import { setAlertsAreLoading } from '../../../store/actions';
import { MonitoringState } from '../../../store/store';

const AlertsChart = ({ theme }: { theme: 'light' | 'dark' }) => {
  const dispatch = useDispatch();
  const [chartContainerHeight, setChartContainerHeight] = useState<number>();
  const [chartHeight, setChartHeight] = useState<number>();
  const alertsData = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.alertsData,
  );
  const alertsAreLoading = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.alertsAreLoading,
  );
  const filteredData = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.filteredIncidentsData,
  );
  const incidentGroupId = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.groupId,
  );
  const { i18n } = useTranslation();
  // Use dynamic date range based on actual alerts data instead of fixed chartDays
  const dateValues = useMemo(() => {
    if (!Array.isArray(alertsData) || alertsData.length === 0) {
      // Fallback to single day if no alerts data
      return generateDateArray(1);
    }
    return generateAlertsDateArray(alertsData);
  }, [alertsData]);

  const chartData: AlertsChartBar[][] = useMemo(() => {
    if (!Array.isArray(alertsData) || alertsData.length === 0) return [];
    return alertsData.map((alert) => createAlertsChartBars(alert));
  }, [alertsData]);

  useEffect(() => {
    setChartContainerHeight(chartData?.length < 5 ? 300 : chartData?.length * 60);
    setChartHeight(chartData?.length < 5 ? 250 : chartData?.length * 55);
  }, [chartData]);

  const selectedIncidentIsVisible = useMemo(() => {
    return filteredData.some((incident) => incident.group_id === incidentGroupId);
  }, [filteredData, incidentGroupId]);

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
    <Card className="alerts-chart-card" style={{ overflow: 'visible' }}>
      <div ref={containerRef}>
        <CardTitle>Alerts Timeline</CardTitle>
        {alertsAreLoading ? (
          <EmptyState
            variant="lg"
            style={{
              height: '250px',
            }}
          >
            <EmptyStateBody>
              To view alerts, select an incident from the chart above or from the filters.
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
                    const startDate = dateTimeFormatter(i18n.language).format(new Date(datum.y0));
                    const endDate =
                      datum.alertstate === 'firing'
                        ? '---'
                        : dateTimeFormatter(i18n.language).format(new Date(datum.y));
                    return `Severity: ${datum.severity}
                    Alert Name: ${datum.name ? datum.name : '---'}
                    Namespace: ${datum.namespace ? datum.namespace : '---'}
                    Layer: ${datum.layer ? datum.layer : '---'}
                    Component: ${datum.component}
                    Start: ${startDate}
                    End: ${endDate};
                    Silenced: ${datum.silenced}`;
                  }}
                />
              }
              domainPadding={{ x: [30, 25] }}
              legendData={[
                {
                  name: 'Critical',
                  symbol: {
                    fill: t_global_color_status_danger_default.var,
                  },
                },
                {
                  name: 'Info',
                  symbol: {
                    fill: t_global_color_status_info_default.var,
                  },
                },
                {
                  name: 'Warning',
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
                bottom: 75, // Adjusted to accommodate legend
                left: 50,
                right: 25, // Adjusted to accommodate tooltip
                top: 50,
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
              <ChartGroup horizontal>
                {chartData.map((bar, index) => {
                  return (
                    //we have several arrays and for each array we make a ChartBar
                    <ChartBar
                      data={bar}
                      key={index}
                      style={{
                        data: {
                          fill: ({ datum }) => datum.fill,
                          stroke: ({ datum }) => datum.fill,
                          fillOpacity: ({ datum }) => (datum.nodata ? 0 : getOpacity(datum)),
                          cursor: 'pointer',
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
