/* eslint-disable prettier/prettier */
import * as React from 'react';

import { Chart, ChartAxis, ChartBar, ChartGroup, createContainer } from '@patternfly/react-charts';
import { Bullseye, Card, CardTitle, Spinner } from '@patternfly/react-core';
import global_danger_color_100 from '@patternfly/react-tokens/dist/esm/global_danger_color_100';
import global_info_color_100 from '@patternfly/react-tokens/dist/esm/global_info_color_100';
import global_warning_color_100 from '@patternfly/react-tokens/dist/esm/global_warning_color_100';
import { createIncidentsChartBars, formatDate, generateDateArray } from '../utils';
import { getResizeObserver } from '@patternfly/react-core';
import { useDispatch, useSelector } from 'react-redux';
import { setChooseIncident } from '../../../actions/observe';

const IncidentsChart = ({ incidentsData, chartDays }) => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = React.useState(true);
  const [chartData, setChartData] = React.useState();
  const [chartContainerHeight, setChartContainerHeight] = React.useState();
  const [chartHeight, setChartHeight] = React.useState();
  React.useEffect(() => {
    setChartContainerHeight(chartData?.length < 5 ? 250 : chartData?.length * 40);
    setChartHeight(chartData?.length < 5 ? 200 : chartData?.length * 35);
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
    setChartData(incidentsData.map((incident) => createIncidentsChartBars(incident)));
  }, [incidentsData]);
  const dateValues = generateDateArray(chartDays);

  const selectedId = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentGroupId']),
  );

  const isHidden = (group_id) => selectedId !== '' && selectedId !== group_id;
  const clickHandler = (data, datum) => {
    dispatch(
      setChooseIncident({
        incidentGroupId: datum.datum.group_id,
      }),
    );
  };

  function getAdjustedFillColor(datum) {
    if (isHidden(datum.group_id)) {
      switch (datum.fill) {
        case 'var(--pf-v5-global--warning-color--100)':
          return '#F8DFA7'; // Less transparent for warning
        case 'var(--pf-v5-global--info-color--100)':
          return '#B2D1F0'; // Less transparent for info
        case 'var(--pf-v5-global--danger-color--100)':
          return '#EFBAB6'; // Less transparent for danger
      }
    }

    return datum.fill; // Original fill color if the bar is selected
  }

  const CursorVoronoiContainer = createContainer('voronoi');
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
                <CursorVoronoiContainer
                  mouseFollowTooltips
                  labels={({ datum }) =>
                    `Severity: ${datum.name}\nComponent: ${datum.componentList?.join(
                      ', ',
                    )}\nIncident ID: ${datum.group_id}\nStart: ${formatDate(
                      new Date(datum.y0),
                      true,
                    )}\nEnd: ${formatDate(new Date(datum.y), true)}`
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
                {chartData.map((bar) => {
                  return (
                    //we have several arrays and for each array we make a ChartBar
                    <ChartBar
                      data={bar}
                      key={bar.group_id}
                      style={{
                        data: {
                          fill: ({ datum }) => getAdjustedFillColor(datum),
                          stroke: ({ datum }) => datum.fill,
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
