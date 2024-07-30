import * as React from 'react';
import { Flex, FlexItem } from '@patternfly/react-core';
import './AlertsChart.css';

const IncidentsChartLegend = () => {
  return (
    <Flex direction={{ default: 'row' }} justifyContent={{ default: 'justifyContentFlexStart' }}>
      <FlexItem spacer={{ default: 'spacerNone' }}>
        <svg width="28" height="32">
          <rect width="28" height="32" fill="red" x="18" y="22" className="chart-legend-1" />
        </svg>
        <text id="chart3-ChartLegend-ChartLabel-0">
          <tspan x="70.8" dx="0" dy="0" textAnchor="start" className="chart-legend-text">
            Critical
          </tspan>
        </text>
      </FlexItem>
      <FlexItem spacer={{ default: 'spacerNone' }}>
        <svg width="28" height="32">
          <rect width="28" height="32" fill="red" x="18" y="22" className="chart-legend-2" />
        </svg>
        <text id="chart3-ChartLegend-ChartLabel-1" direction="inherit">
          <tspan x="139.478125" dx="0" dy="0" textAnchor="start" className="chart-legend-text">
            Warning
          </tspan>
        </text>
      </FlexItem>
      <FlexItem spacer={{ default: 'spacerNone' }}>
        <svg width="28" height="32">
          <rect width="28" height="32" fill="red" x="18" y="22" className="chart-legend-3" />
        </svg>
        <text id="chart3-ChartLegend-ChartLabel-2" direction="inherit">
          <tspan x="211.875" dx="0" dy="0" textAnchor="start" className="chart-legend-text">
            Info
          </tspan>
        </text>
      </FlexItem>
    </Flex>
  );
};

export default IncidentsChartLegend;
