import * as React from 'react';

import { Chart, ChartAxis, ChartBar, ChartGroup, ChartThemeColor } from '@patternfly/react-charts';
import { VictoryZoomContainer } from 'victory-zoom-container';

const AlertsChart = () => {
  return (
    <div style={{
      height: '400px',
      //TODO: WIDTH SHOULD BE AUTOMATICALLY ADJUSTED
      width: '100%' }}>
      <Chart
        ariaDesc="Alerts Chart"
        ariaTitle="Alerts Timeline"
        containerComponent={<VictoryZoomContainer />}
        domain={{ x: [0, 3], y: [0, 11] }}
        domainPadding={{ x: [30, 25] }}
        legendData={[
          { name: 'Critical', symbol: { fill: 'red' } },
          { name: 'Info', symbol: { fill: 'blue' } },
          { name: 'Warning', symbol: { fill: 'orange' } },
        ]}
        legendPosition="bottom-left"
        height={400}
        padding={{
          bottom: 75, // Adjusted to accommodate legend
          left: 50,
          right: 100, // Adjusted to accommodate tooltip
          top: 50,
        }}
        themeColor={ChartThemeColor.multiOrdered}
        //TODO: WIDTH SHOULD BE AUTOMATICALLY ADJUSTED
        width={1570}
      >
        <ChartAxis dependentAxis showGrid tickFormat={(t) => `June ${t}`} />
        <ChartGroup offset={11} horizontal>
          <ChartBar
            data={[
              { name: 'Critical', x: 3, y: 4, y0: 1 },
              { name: 'Critical', x: 3, y: 5, y0: 4.5 },
              { name: 'Critical', x: 3, y: 6, y0: 5.5 },
              { name: 'Critical', x: 3, y: 10.5, y0: 6.5 },
            ]}
            style={{
              data: {
                fill: 'red',
                stroke: 'red',
              },
            }}
          />
          <ChartBar
            data={[
              { name: 'Critical', x: 2.5, y: 3, y0: 2 },
              { name: 'Critical', x: 2.5, y: 4, y0: 2.5 },
              { name: 'Critical', x: 2.5, y: 5, y0: 4.5 },
              { name: 'Critical', x: 2.5, y: 6, y0: 5.5 },
              { name: 'Critical', x: 2.5, y: 7, y0: 6.5 },
              { name: 'Critical', x: 2.5, y: 9, y0: 8 },
            ]}
            style={{
              data: {
                fill: 'red',
                stroke: 'red',
              },
            }}
          />
          <ChartBar
            data={[
              { name: 'Info', x: 2, y: 3, y0: 2.5 },
              { name: 'Info', x: 2, y: 4, y0: 3.5 },
              { name: 'Info', x: 2, y: 5, y0: 4.5 },
              { name: 'Info', x: 2, y: 6, y0: 5.5 },
              { name: 'Info', x: 2, y: 7, y0: 6.5 },
            ]}
            style={{
              data: {
                fill: 'blue',
                stroke: 'blue',
              },
            }}
          />
          <ChartBar
            data={[
              { name: 'Warning', x: 1.5, y: 4, y0: 3 },
              { name: 'Warning', x: 1.5, y: 8, y0: 5 },
              { name: 'Warning', x: 1.5, y: 9, y0: 8.5 },
              { name: 'Warning', x: 1.5, y: 10.5, y0: 9.5 },
            ]}
            style={{
              data: {
                fill: 'orange',
                stroke: 'orange',
              },
            }}
          />
          <ChartBar
            data={[
              { name: 'Warning', x: 1, y: 2, y0: 1 },
              { name: 'Warning', x: 1, y: 6, y0: 4 },
              { name: 'Warning', x: 1, y: 9, y0: 8.5 },
              { name: 'Warning', x: 1, y: 10, y0: 9.5 },
            ]}
            style={{
              data: {
                fill: 'orange',
                stroke: 'orange',
              },
            }}
          />
          <ChartBar
            data={[
              { name: 'Warning', x: 0.5, y: 3, y0: 1 },
              { name: 'Warning', x: 0.5, y: 3.5, y0: 8 },
              { name: 'Warning', x: 0.5, y: 9, y0: 8.5 },
              { name: 'Warning', x: 0.5, y: 10.5, y0: 9.5 },
            ]}
            style={{
              data: {
                fill: 'orange',
                stroke: 'orange',
              },
            }}
          />
        </ChartGroup>
      </Chart>
    </div>
  );
};

export default AlertsChart;
