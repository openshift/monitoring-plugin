import * as React from 'react';

import { Chart, ChartAxis, ChartBar, ChartGroup, ChartLabel, ChartThemeColor } from '@patternfly/react-charts';
import { VictoryZoomContainer } from 'victory-zoom-container';
import { Card, CardTitle } from '@patternfly/react-core';

const days = ['Jul 25', 'Jul 26', 'Jul 27', 'Jul 28', 'Jul 29', 'Jul 30', 'Jul 31', 'Aug 1', 'Aug 2', 'Aug 3', 'Aug 4', 'Aug 5', 'Aug 6', 'Aug 7', 'Today',]
const IncidentsChart = () => {
  return (
    <Card>
      <CardTitle>Incidents Timeline</CardTitle>
    <div style={{
      height: '300px',
      //TODO: WIDTH SHOULD BE AUTOMATICALLY ADJUSTED
      width: '100%' }}>
      <Chart
        containerComponent={<VictoryZoomContainer />}
        domain={{ x: [0, 3], y: [0, 15] }}
        domainPadding={{ x: [30, 25] }}
        legendData={[
          { name: 'Critical', symbol: { fill: 'red' } },
          { name: 'Info', symbol: { fill: 'blue' } },
          { name: 'Warning', symbol: { fill: 'orange' } },
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
      <ChartAxis
      label="Incidents"
      axisLabelComponent={
        <ChartLabel angle={0} dx={-745} dy={-268}/>
      }
      dependentAxis
      showGrid
      tickFormat={(t) => `June ${t}`} />
        <ChartGroup
        offset={11}
        horizontal>
          <ChartBar
            data={[
              { name: 'Critical', x: 3, y: 4, y0: 1 },
              { name: 'Critical', x: 3, y: 5, y0: 4.5 },
              { name: 'Critical', x: 3, y: 6, y0: 5.5 },
              { name: 'Critical', x: 3, y: 14.5, y0: 6.5 },
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
    </Card>
  );
};

export default IncidentsChart;
