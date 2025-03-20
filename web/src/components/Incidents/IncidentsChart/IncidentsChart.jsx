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
import { Bullseye, Card, CardTitle, Spinner } from '@patternfly/react-core';
import { createIncidentsChartBars, formatDate, generateDateArray } from '../utils';
import { getResizeObserver } from '@patternfly/react-core';
import { useDispatch, useSelector } from 'react-redux';
import { setChooseIncident } from '../../../actions/observe';
import global_danger_color_100 /* CODEMODS: you should update this color token */ from '@patternfly/react-tokens/dist/esm/t_temp_dev_tbd';
import global_info_color_100 /* CODEMODS: you should update this color token */ from '@patternfly/react-tokens/dist/esm/t_temp_dev_tbd';
import global_warning_color_100 /* CODEMODS: you should update this color token */ from '@patternfly/react-tokens/dist/esm/t_temp_dev_tbd';
import { setAlertsAreLoading } from '../../../actions/observe';

const IncidentsChart = ({ incidentsData, chartDays, theme }) => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = React.useState(true);
  const [chartData, setChartData] = React.useState();
  const [chartContainerHeight, setChartContainerHeight] = React.useState();
  const [chartHeight, setChartHeight] = React.useState();
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
  React.useEffect(() => {
    setIsLoading(false);
    setChartData(
      incidentsData.map((incident) => createIncidentsChartBars(incident, theme, dateValues)),
    );
  }, [incidentsData, theme, dateValues]);
  const dateValues = generateDateArray(chartDays);

  const selectedId = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentGroupId']),
  );

  const isHidden = (group_id) => selectedId !== '' && selectedId !== group_id;
  const clickHandler = (data, datum) => {
    if (datum.datum.group_id === selectedId) {
      dispatch(
        setChooseIncident({
          incidentGroupId: '',
        }),
      );
      dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
    } else {
      dispatch(
        setChooseIncident({
          incidentGroupId: datum.datum.group_id,
        }),
      );
    }
  };

  function getOpacity(datum) {
    return (datum.fillOpacity = isHidden(datum.group_id) ? '0.3' : '1');
  }

  return (
    <Card className="incidents-chart-card">
      <div ref={containerRef}>
        <CardTitle>Incidents Timeline</CardTitle>
        {isLoading ? (
          <Bullseye>
            <Spinner aria-label="incidents-chart-spinner" />
          </Bullseye>
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
                    <ChartTooltip
                      orientation="top"
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
          </div>
        )}
      </div>
    </Card>
  );
};

export default IncidentsChart;
