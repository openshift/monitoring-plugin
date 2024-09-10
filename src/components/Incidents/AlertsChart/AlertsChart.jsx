import * as React from 'react';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartGroup,
  ChartLabel,
  ChartThemeColor,
  ChartTooltip,
  ChartVoronoiContainer,
} from '@patternfly/react-charts';
import { VictoryZoomContainer } from 'victory-zoom-container';
import { Bullseye, Card, CardTitle, Spinner } from '@patternfly/react-core';
import global_danger_color_100 from '@patternfly/react-tokens/dist/esm/global_danger_color_100';
import global_info_color_100 from '@patternfly/react-tokens/dist/esm/global_info_color_100';
import global_warning_color_100 from '@patternfly/react-tokens/dist/esm/global_warning_color_100';
import { createAlertsChartBars, createDateArray, formatDate, generateDateArray } from '../utils';

const AlertsChart = ({ alertsData, chartDays }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [chartData, setChartData] = React.useState();
  const dateValues = generateDateArray(chartDays);
  React.useEffect(() => {
    setIsLoading(false);
    setChartData(alertsData.map((alert) => createAlertsChartBars(alert)));
  }, [alertsData]);

  return (
    <Card className="alerts-chart-card">
      <CardTitle>Alerts Timeline</CardTitle>
      {isLoading ? (
        <Bullseye>
          <Spinner aria-label="alerts-chart-spinner" />
        </Bullseye>
      ) : (
        <div
          style={{
            height: '450px',
            //TODO: WIDTH SHOULD BE AUTOMATICALLY ADJUSTED
            width: '100%',
          }}
        >
          <Chart
            containerComponent={
              <ChartVoronoiContainer
                labelComponent={
                  <ChartTooltip constrainToVisibleArea labelComponent={<ChartLabel />} />
                }
                //TODO: add dates based on the time range
                labels={({ datum }) =>
                  `Severity: ${datum.name}\nStart: ${formatDate(
                    new Date(datum.y0),
                    true,
                  )}\nEnd: ${formatDate(new Date(datum.y), true)}`
                }
              />
            }
            //TODO: domain ranges should be adjusted based on the amount of rows and day range
            domainPadding={{ x: [30, 25] }}
            legendData={[
              { name: 'Critical', symbol: { fill: global_danger_color_100.var } },
              { name: 'Info', symbol: { fill: global_info_color_100.var } },
              { name: 'Warning', symbol: { fill: global_warning_color_100.var } },
            ]}
            legendPosition="bottom-left"
            //this should be always less than the container height
            height={400}
            padding={{
              bottom: 75, // Adjusted to accommodate legend
              left: 50,
              right: 25, // Adjusted to accommodate tooltip
              top: 0,
            }}
            themeColor={ChartThemeColor.multiOrdered}
            //TODO: WIDTH SHOULD BE AUTOMATICALLY ADJUSTED
            width={1570}
          >
            <ChartAxis
              dependentAxis
              showGrid
              tickFormat={(t) =>
                new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
              tickValues={dateValues}
            />
            <ChartAxis
              label="Alerts"
              //TODO: Values of dy and dx should be adjusted according to the chart height
              axisLabelComponent={
                <ChartLabel angle={0} dy={-120} dx={33} padding={{ top: 20, bottom: 60 }} />
              }
              style={{
                axis: {
                  stroke: 'transparent',
                },
                ticks: {
                  stroke: 'transparent',
                },
                tickLabels: {
                  fill: 'transparent',
                },
              }}
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
    </Card>
  );
};

export default AlertsChart;
