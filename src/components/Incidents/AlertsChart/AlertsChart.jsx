import * as React from 'react';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartGroup,
  ChartLabel,
  ChartTooltip,
  ChartVoronoiContainer,
} from '@patternfly/react-charts';
import { Bullseye, Card, CardTitle, Spinner } from '@patternfly/react-core';
import global_danger_color_100 from '@patternfly/react-tokens/dist/esm/global_danger_color_100';
import global_info_color_100 from '@patternfly/react-tokens/dist/esm/global_info_color_100';
import global_warning_color_100 from '@patternfly/react-tokens/dist/esm/global_warning_color_100';
import { createAlertsChartBars, formatDate, generateDateArray } from '../utils';
import { getResizeObserver } from '@patternfly/react-core';

const AlertsChart = ({ alertsData, chartDays }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [chartData, setChartData] = React.useState();
  const dateValues = generateDateArray(chartDays);
  React.useEffect(() => {
    setIsLoading(false);
    setChartData(alertsData.map((alert) => createAlertsChartBars(alert)));
  }, [alertsData]);
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
        {isLoading ? (
          <Bullseye>
            <Spinner aria-label="alerts-chart-spinner" />
          </Bullseye>
        ) : (
          <div
            style={{
              height: '450px',
              width: '100%',
            }}
          >
            <Chart
              containerComponent={
                <ChartVoronoiContainer
                  labelComponent={
                    <ChartTooltip constrainToVisibleArea labelComponent={<ChartLabel />} />
                  }
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
              height={350}
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
