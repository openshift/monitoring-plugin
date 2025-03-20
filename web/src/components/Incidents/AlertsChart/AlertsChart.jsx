import * as React from 'react';

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
import { Card, CardTitle, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { createAlertsChartBars, formatDate, generateDateArray } from '../utils';
import { getResizeObserver } from '@patternfly/react-core';
import { useDispatch, useSelector } from 'react-redux';
import global_danger_color_100 /* CODEMODS: you should update this color token */ from '@patternfly/react-tokens/dist/esm/t_temp_dev_tbd';
import global_info_color_100 /* CODEMODS: you should update this color token */ from '@patternfly/react-tokens/dist/esm/t_temp_dev_tbd';
import global_warning_color_100 /* CODEMODS: you should update this color token */ from '@patternfly/react-tokens/dist/esm/t_temp_dev_tbd';
import * as _ from 'lodash-es';
import { setAlertsAreLoading } from '../../../actions/observe';

const AlertsChart = ({ chartDays, theme }) => {
  const dispatch = useDispatch();
  const [chartData, setChartData] = React.useState([]);
  const [chartContainerHeight, setChartContainerHeight] = React.useState();
  const [chartHeight, setChartHeight] = React.useState();
  const alertsData = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsData']),
  );
  const alertsAreLoading = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsAreLoading']),
  );
  const filteredData = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'filteredIncidentsData']),
  );
  const incidentGroupId = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentGroupId']),
  );
  React.useEffect(() => {
    setChartContainerHeight(chartData?.length < 5 ? 300 : chartData?.length * 60);
    setChartHeight(chartData?.length < 5 ? 250 : chartData?.length * 55);
  }, [chartData]);
  const dateValues = generateDateArray(chartDays);

  React.useEffect(() => {
    setChartData(alertsData.map((alert) => createAlertsChartBars(alert, theme, dateValues)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsData]);

  React.useEffect(() => {
    //state when chosen incident not passing filters or the is no data
    if (
      _.isEmpty(filteredData) ||
      !filteredData.find((incident) => incident.group_id === incidentGroupId)
    ) {
      dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
    } //state when chosen incident passing filters
    else if (filteredData.find((incident) => incident.group_id === incidentGroupId)) {
      dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData]);

  const [width, setWidth] = React.useState(0);
  const containerRef = React.useRef(null);
  const handleResize = () => {
    if (containerRef.current && containerRef.current.clientWidth) {
      setWidth(containerRef.current.clientWidth);
    }
  };
  React.useEffect(() => {
    const observer = getResizeObserver(containerRef.current, handleResize);
    handleResize();
    return () => observer();
  }, []);

  return (
    <Card className="alerts-chart-card">
      <div ref={containerRef}>
        <CardTitle>Alerts Timeline</CardTitle>
        {alertsAreLoading ? (
          <EmptyState
            variant="large"
            style={{
              height: '250px',
            }}
          >
            <EmptyStateBody>Select an incident in the chart above to see alerts.</EmptyStateBody>
          </EmptyState>
        ) : (
          <div
            style={{
              height: { chartContainerHeight },
              width: '100%',
            }}
          >
            <Chart
              containerComponent={
                <ChartVoronoiContainer
                  labelComponent={
                    <ChartTooltip constrainToVisibleArea labelComponent={<ChartLabel />} />
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
                    fill: theme === 'light' ? global_danger_color_100.var : '#C9190B',
                  },
                },
                {
                  name: 'Info',
                  symbol: {
                    fill: theme === 'light' ? global_info_color_100.var : '#06C',
                  },
                },
                {
                  name: 'Warning',
                  symbol: {
                    fill: theme === 'light' ? global_warning_color_100.var : '#F0AB00',
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
                tickValues={dateValues}
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
                        },
                      }}
                    />
                  );
                })}
              </ChartGroup>
            </Chart>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AlertsChart;
