import * as React from 'react';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartGroup,
  ChartLabel,
  ChartLegend,
  ChartThemeColor,
  ChartTooltip,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import { Bullseye, Card, CardBody, CardTitle, Spinner } from '@patternfly/react-core';
import {
  createIncidentsChartBars,
  formatDate,
  generateDateArray,
  updateBrowserUrl,
} from '../utils';
import { getResizeObserver } from '@patternfly/react-core';
import { useDispatch, useSelector } from 'react-redux';
import { setChooseIncident } from '../../../actions/observe';
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import { setAlertsAreLoading } from '../../../actions/observe';

const IncidentsChart = ({ incidentsData, chartDays, theme }) => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = React.useState(true);
  const [chartContainerHeight, setChartContainerHeight] = React.useState();
  const [chartHeight, setChartHeight] = React.useState();
  const dateValues = React.useMemo(() => generateDateArray(chartDays), [chartDays]);

  const chartData = React.useMemo(() => {
    if (!Array.isArray(incidentsData) || incidentsData.length === 0) return [];
    return incidentsData.map((incident) => createIncidentsChartBars(incident, theme, dateValues));
  }, [incidentsData, theme, dateValues]);

  React.useEffect(() => {
    setIsLoading(false);
  }, [incidentsData]);

  React.useEffect(() => {
    setChartContainerHeight(chartData?.length < 5 ? 300 : chartData?.length * 60);
    setChartHeight(chartData?.length < 5 ? 250 : chartData?.length * 55);
  }, [chartData]);

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

  const selectedId = useSelector((state) => state.plugins.mcp.getIn(['incidentsData', 'groupId']));
  const incidentsActiveFilters = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentsActiveFilters']),
  );

  const isHidden = React.useCallback(
    (group_id) => selectedId !== '' && selectedId !== group_id,
    [selectedId],
  );
  const clickHandler = (data, datum) => {
    if (datum.datum.group_id === selectedId) {
      dispatch(
        setChooseIncident({
          groupId: '',
        }),
      );
      updateBrowserUrl(incidentsActiveFilters, '');
      dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
    } else {
      dispatch(
        setChooseIncident({
          groupId: datum.datum.group_id,
        }),
      );
      updateBrowserUrl(incidentsActiveFilters, datum.datum.group_id);
    }
  };

  const getOpacity = React.useCallback(
    (datum) => (datum.fillOpacity = isHidden(datum.group_id) ? '0.3' : '1'),
    [isHidden],
  );

  return (
    <Card className="incidents-chart-card">
      <div ref={containerRef}>
        <CardTitle>Incidents Timeline</CardTitle>
        {isLoading ? (
          <Bullseye>
            <Spinner aria-label="incidents-chart-spinner" />
          </Bullseye>
        ) : (
          <CardBody
            style={{
              height: { chartContainerHeight },
              width: '100%',
            }}
          >
            <Chart
              containerComponent={
                <ChartVoronoiContainer
                  labelComponent={
                    <ChartTooltip
                      orientation="top"
                      dx={({ x, x0 }) => -(x - x0) / 2}
                      dy={-5} // Position tooltip so pointer appears above bar
                      constrainToVisibleArea
                      labelComponent={<ChartLabel />}
                    />
                  }
                  labels={({ datum }) => {
                    if (datum.nodata) {
                      return null;
                    }
                    return `Severity: ${datum.name}
                    Component: ${datum.componentList?.join(', ')}
                    Incident ID: ${datum.group_id}
                    Start: ${formatDate(new Date(datum.y0), true)}
                    End: ${datum.firing ? '---' : formatDate(new Date(datum.y), true)}`;
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
              themeColor={ChartThemeColor.purple}
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
                {chartData.map((bar) => {
                  return (
                    //we have several arrays and for each array we make a ChartBar
                    <ChartBar
                      data={bar}
                      key={bar.group_id}
                      style={{
                        data: {
                          fill: ({ datum }) => datum.fill,
                          stroke: ({ datum }) => datum.fill,
                          fillOpacity: ({ datum }) => (datum.nodata ? 0 : getOpacity(datum)),
                          cursor: 'pointer',
                        },
                      }}
                      events={[
                        {
                          eventHandlers: {
                            onClick: (props, datum) => clickHandler(props, datum),
                          },
                        },
                      ]}
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

export default IncidentsChart;
