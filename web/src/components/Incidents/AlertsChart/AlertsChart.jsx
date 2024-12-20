import * as React from 'react';

import { Chart, ChartAxis, ChartBar, ChartGroup, createContainer } from '@patternfly/react-charts';
import { Card, CardTitle, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import global_danger_color_100 from '@patternfly/react-tokens/dist/esm/global_danger_color_100';
import global_info_color_100 from '@patternfly/react-tokens/dist/esm/global_info_color_100';
import global_warning_color_100 from '@patternfly/react-tokens/dist/esm/global_warning_color_100';
import { createAlertsChartBars, formatDate, generateDateArray } from '../utils';
import { getResizeObserver } from '@patternfly/react-core';

const AlertsChart = ({ alertsData = [], chartDays }) => {
  const [chartData, setChartData] = React.useState([]);
  const [chartContainerHeight, setChartContainerHeight] = React.useState();
  const [chartHeight, setChartHeight] = React.useState();
  React.useEffect(() => {
    setChartContainerHeight(chartData?.length < 5 ? 250 : chartData?.length * 40);
    setChartHeight(chartData?.length < 5 ? 200 : chartData?.length * 35);
  }, [chartData]);
  const dateValues = generateDateArray(chartDays);
  React.useEffect(() => {
    setChartData(alertsData.map((alert) => createAlertsChartBars(alert)));
  }, [alertsData]);
  const isLoading = alertsData.length === 0 ? true : false;
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

  const CursorVoronoiContainer = createContainer('voronoi');

  return (
    <Card className="alerts-chart-card">
      <div ref={containerRef}>
        <CardTitle>Alerts Timeline</CardTitle>
        {isLoading ? (
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
                <CursorVoronoiContainer
                  mouseFollowTooltips
                  labels={({ datum }) =>
                    `Alert severity: ${datum.severity}\nAlert name: ${datum.name}\nNamespace: ${
                      datum.namespace
                    }\nLayer: ${datum.layer}\nComponent: ${
                      datum.component
                    }\nStart time: ${formatDate(new Date(datum.y0), true)}\nStop time: ${formatDate(
                      new Date(datum.y),
                      true,
                    )}`
                  }
                />
              }
              domainPadding={{ x: [30, 25] }}
              legendData={[
                { name: 'Critical', symbol: { fill: global_danger_color_100.var } },
                { name: 'Info', symbol: { fill: global_info_color_100.var } },
                { name: 'Warning', symbol: { fill: global_warning_color_100.var } },
              ]}
              legendPosition="bottom-left"
              //this should be always less than the container height
              height={chartHeight}
              padding={{
                bottom: 75, // Adjusted to accommodate legend
                left: 50,
                right: 25, // Adjusted to accommodate tooltip
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
                tickValues={dateValues}
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
