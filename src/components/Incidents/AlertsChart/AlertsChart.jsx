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
import { createChartBars } from '../utils';

const AlertsChart = ({ alertsData }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  React.useEffect(() => {
    setIsLoading(false);
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
            height: '350px',
            //TODO: WIDTH SHOULD BE AUTOMATICALLY ADJUSTED
            width: '100%',
          }}
        >
          <Chart
            containerComponent={
              <ChartVoronoiContainer
                labelComponent={
                  <ChartTooltip
                    constrainToVisibleArea
                    labelComponent={<ChartLabel dx={-65} textAnchor="start" />}
                  />
                }
                //TODO: add dates based on the time range
                /* labels={({ datum }) =>
                `Severity: ${datum.severity}\nStart: ${formatDate(
                  new Date(datum.y0),
                  true,
                )}\nEnd: ${formatDate(new Date(datum.y), true)}`
              } */
              />
            }
            //TODO: domain ranges should be adjusted based on the amount of rows and day range
            domain={{ x: [0, 17], y: [0, 15] }}
            domainPadding={{ x: [30, 25] }}
            legendData={[
              { name: 'Critical', symbol: { fill: global_danger_color_100.var } },
              { name: 'Info', symbol: { fill: global_info_color_100.var } },
              { name: 'Warning', symbol: { fill: global_warning_color_100.var } },
            ]}
            legendPosition="bottom-left"
            height={300}
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
            <ChartAxis dependentAxis showGrid tickFormat={(t) => `Aug ${t}`} />
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
              {/* <ChartBar
              data={[
                { name: 'Critical', x: 1.2, y: 4, y0: 1 },
                { name: 'Critical', x: 1.2, y: 5, y0: 4.5 },
                { name: 'Critical', x: 1.2, y: 6, y0: 5.5 },
                { name: 'Critical', x: 1.2, y: 14.5, y0: 6.5 },
              ]}
              style={{
                data: {
                  fill: global_danger_color_100.var,
                  stroke: global_danger_color_100.var,
                },
              }}
            />
            <ChartBar
              data={[
                { name: 'Critical', x: 1, y: 3, y0: 2 },
                { name: 'Critical', x: 1, y: 4, y0: 2.5 },
                { name: 'Critical', x: 1, y: 5, y0: 4.5 },
                { name: 'Critical', x: 1, y: 6, y0: 5.5 },
                { name: 'Critical', x: 1, y: 7, y0: 6.5 },
                { name: 'Critical', x: 1, y: 9, y0: 8 },
              ]}
              style={{
                data: {
                  fill: global_danger_color_100.var,
                  stroke: global_danger_color_100.var,
                },
              }}
            />
            <ChartBar
              data={[
                { name: 'Info', x: 0.8, y: 3, y0: 2.5 },
                { name: 'Info', x: 0.8, y: 4, y0: 3.5 },
                { name: 'Info', x: 0.8, y: 5, y0: 4.5 },
                { name: 'Info', x: 0.8, y: 6, y0: 5.5 },
                { name: 'Info', x: 0.8, y: 7, y0: 6.5 },
              ]}
              style={{
                data: {
                  fill: global_info_color_100.var,
                  stroke: global_info_color_100.var,
                },
              }}
            />
            <ChartBar
              data={[
                { name: 'Warning', x: 0.6, y: 4, y0: 3 },
                { name: 'Warning', x: 0.6, y: 8, y0: 5 },
                { name: 'Warning', x: 0.6, y: 9, y0: 8.5 },
                { name: 'Warning', x: 0.6, y: 10.5, y0: 9.5 },
              ]}
              style={{
                data: {
                  fill: global_warning_color_100.var,
                  stroke: global_warning_color_100.var,
                },
              }}
            />
            <ChartBar
              data={[
                { name: 'Warning', x: 0.2, y: 3, y0: 1 },
                { name: 'Warning', x: 0.2, y: 3.5, y0: 8 },
                { name: 'Warning', x: 0.2, y: 9, y0: 8.5 },
                { name: 'Warning', x: 0.2, y: 10.5, y0: 9.5 },
              ]}
              style={{
                data: {
                  fill: global_warning_color_100.var,
                  stroke: global_warning_color_100.var,
                },
              }}
            /> */}
              <ChartBar
                data={[
                  { name: 'Warning', x: 0.4, y: 2, y0: 1 },
                  { name: 'Warning', x: 0.4, y: 6, y0: 4 },
                  { name: 'Warning', x: 0.4, y: 9, y0: 8.5 },
                  { name: 'Warning', x: 0.4, y: 10, y0: 9.5 },
                ]}
                style={{
                  data: {
                    fill: global_warning_color_100.var,
                    stroke: global_warning_color_100.var,
                  },
                }}
              />
              {alertsData.map((alert, index) => createChartBars(alert, index))}
            </ChartGroup>
          </Chart>
        </div>
      )}
    </Card>
  );
};

export default AlertsChart;
