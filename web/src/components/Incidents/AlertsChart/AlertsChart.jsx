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
import { Card, CardBody, CardTitle, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { createAlertsChartBars, formatDate, generateDateArray } from '../utils';
import { getResizeObserver } from '@patternfly/react-core';
import { useDispatch, useSelector } from 'react-redux';
import {
  t_global_color_status_warning_100,
  t_global_color_status_info_100,
  t_global_color_status_danger_100,
} from '@patternfly/react-tokens';

import * as _ from 'lodash-es';
import { setAlertsAreLoading } from '../../../actions/observe';

const AlertsChart = ({ chartDays, theme }) => {
  const dispatch = useDispatch();
  const [chartData, setChartData] = React.useState([]);
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

  if (alertsAreLoading) {
    return (
      <Card>
        <CardTitle>Alerts Timeline</CardTitle>
        <CardBody>
          <EmptyState variant="large">
            <EmptyStateBody>Select an incident in the chart above to see alerts.</EmptyStateBody>
          </EmptyState>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Alerts Timeline</CardTitle>
      <CardBody>
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
                fill: t_global_color_status_danger_100.var,
              },
            },
            {
              name: 'Info',
              symbol: {
                fill: t_global_color_status_info_100.var,
              },
            },
            {
              name: 'Warning',
              symbol: {
                fill: t_global_color_status_warning_100.var,
              },
            },
          ]}
          legendComponent={<ChartLegend labelComponent={<ChartLabel />} />}
          legendPosition="bottom-left"
          //this should be always less than the container height
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
            tickLabelComponent={<ChartLabel />}
          />
          <ChartGroup horizontal>
            {chartData.map((bar, index) => {
              return (
                //we have several arrays and for each array we make a ChartBar
                <ChartBar data={bar} key={index} />
              );
            })}
          </ChartGroup>
        </Chart>
      </CardBody>
    </Card>
  );
};

export default AlertsChart;
