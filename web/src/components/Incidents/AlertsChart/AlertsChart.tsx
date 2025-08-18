import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartGroup,
  ChartLabel,
  ChartLegend,
  ChartTooltip,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import { Card, CardBody, CardTitle, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { createAlertsChartBars, formatDate, generateDateArray } from '../utils';
import { getResizeObserver } from '@patternfly/react-core';
import { useDispatch, useSelector } from 'react-redux';
import { setAlertsAreLoading } from '../../../actions/observe';
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import { MonitoringState } from '../../../reducers/observe';
import { VictoryPortal } from 'victory';

const AlertsChart = ({ chartDays, theme }: { chartDays: number; theme: 'light' | 'dark' }) => {
  const dispatch = useDispatch();
  const [chartContainerHeight, setChartContainerHeight] = useState<number>();
  const [chartHeight, setChartHeight] = useState<number>();
  const alertsData = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsData']),
  );
  const alertsAreLoading = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsAreLoading']),
  );
  const filteredData = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'filteredIncidentsData']),
  );
  const incidentGroupId = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'groupId']),
  );

  const dateValues = useMemo(() => generateDateArray(chartDays), [chartDays]);

  const chartData = useMemo(() => {
    if (!Array.isArray(alertsData) || alertsData.length === 0) return [];
    return alertsData.map((alert) => createAlertsChartBars(alert, dateValues));
  }, [alertsData, dateValues]);

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
  const containerRef = useRef(null);
  const handleResize = useCallback(() => {
    if (containerRef.current && containerRef.current.clientWidth) {
      setWidth(containerRef.current.clientWidth);
    }
  }, []);
  useEffect(() => {
    const observer = getResizeObserver(containerRef.current, handleResize);
    handleResize();
    return () => observer();
  }, [handleResize]);

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
            <EmptyStateBody>Select an incident in the chart above to see alerts.</EmptyStateBody>
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
                  labelComponent={
                    <VictoryPortal>
                      <ChartTooltip
                        orientation="top"
                        dx={({ x, x0 }: any) => -(x - x0) / 2}
                        dy={-5} // Position tooltip so pointer appears above bar
                        labelComponent={<ChartLabel />}
                      />
                    </VictoryPortal>
                  }
                  labels={({ datum }) => {
                    if (datum.nodata) {
                      return null;
                    }
                    return `Alert Severity: ${datum.severity}
                    Alert Name: ${datum.name ? datum.name : '---'}
                    Namespace: ${datum.namespace ? datum.namespace : '---'}
                    Layer: ${datum.layer ? datum.layer : '---'}
                    Component: ${datum.component}
                    Start: ${formatDate(new Date(datum.y0), true)}
                    End: ${
                      datum.alertstate === 'firing' ? '---' : formatDate(new Date(datum.y), true)
                    }`;
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
                          fillOpacity: ({ datum }) => (datum.nodata ? 0 : 1),
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
