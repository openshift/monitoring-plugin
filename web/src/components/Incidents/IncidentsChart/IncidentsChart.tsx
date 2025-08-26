import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartGroup,
  ChartLabel,
  ChartLegend,
  ChartThemeColor,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import {
  Bullseye,
  Card,
  CardBody,
  CardTitle,
  getResizeObserver,
  Spinner,
} from '@patternfly/react-core';
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import { useDispatch, useSelector } from 'react-redux';
import { VictoryPortal } from 'victory';
import { setAlertsAreLoading, setChooseIncident } from '../../../actions/observe';
import { MonitoringState } from '../../../reducers/observe';
import '../incidents-styles.css';
import { Incident } from '../model';
import {
  createIncidentsChartBars,
  formatDate,
  generateDateArray,
  updateBrowserUrl,
} from '../utils';

const TOOLTIP_MAX_HEIGHT = 300;
const TOOLTIP_MAX_WIDTH = 500;

const IncidentsTooltip = ({
  x,
  y,
  x0,
  height,
  text,
}: {
  x?: number;
  y?: number;
  x0?: number;
  height?: number;
  text?: string | Array<string>;
}) => {
  const posx = x - (x - x0) / 2 - TOOLTIP_MAX_WIDTH / 2;
  const posy = y - Math.min(height || 0, TOOLTIP_MAX_HEIGHT) / 2 - 20;
  const textArray: Array<string> = Array.isArray(text) ? text : [text];

  return (
    <VictoryPortal>
      <foreignObject height={TOOLTIP_MAX_HEIGHT} width={TOOLTIP_MAX_WIDTH} x={posx} y={posy}>
        <div className="incidents__tooltip-wrap">
          <div className="incidents__tooltip">
            {textArray.map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>
          <div className="incidents__tooltip-arrow" />
        </div>
      </foreignObject>
    </VictoryPortal>
  );
};

const IncidentsChart = ({
  incidentsData,
  chartDays,
  theme,
}: {
  incidentsData: Array<Incident>;
  chartDays: number;
  theme: 'light' | 'dark';
}) => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [chartContainerHeight, setChartContainerHeight] = useState<number>();
  const [chartHeight, setChartHeight] = useState<number>();
  const dateValues = useMemo(() => generateDateArray(chartDays), [chartDays]);

  const chartData = useMemo(() => {
    if (!Array.isArray(incidentsData) || incidentsData.length === 0) return [];
    return incidentsData.map((incident) => createIncidentsChartBars(incident, dateValues));
  }, [incidentsData, dateValues]);

  useEffect(() => {
    setIsLoading(false);
  }, [incidentsData]);

  useEffect(() => {
    setChartContainerHeight(chartData?.length < 5 ? 300 : chartData?.length * 60);
    setChartHeight(chartData?.length < 5 ? 250 : chartData?.length * 55);
  }, [chartData]);

  const [width, setWidth] = useState(0);
  const containerRef = useRef(null);

  const handleResize = () => {
    if (containerRef.current && containerRef.current.clientWidth) {
      setWidth(containerRef.current.clientWidth);
    }
  };
  useEffect(() => {
    const observer = getResizeObserver(containerRef.current, handleResize);
    handleResize();
    return () => observer();
  }, []);

  const selectedId = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'groupId']),
  );
  const incidentsActiveFilters = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentsActiveFilters']),
  );

  const isHidden = useCallback(
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

  const getOpacity = useCallback(
    (datum) => (datum.fillOpacity = isHidden(datum.group_id) ? '0.3' : '1'),
    [isHidden],
  );

  return (
    <Card className="incidents-chart-card" style={{ overflow: 'visible' }}>
      <div ref={containerRef} style={{ position: 'relative' }}>
        <CardTitle>Incidents Timeline</CardTitle>
        {isLoading ? (
          <Bullseye>
            <Spinner aria-label="incidents-chart-spinner" />
          </Bullseye>
        ) : (
          <CardBody
            style={{
              height: chartContainerHeight,
              width: '100%',
            }}
          >
            <Chart
              containerComponent={
                <ChartVoronoiContainer
                  labelComponent={<IncidentsTooltip />}
                  voronoiPadding={0}
                  labels={({ datum }) => {
                    if (datum.nodata) {
                      return null;
                    }
                    return `Severity: ${datum.name}
                    Component: ${datum.componentList?.join(', ')}
                    Incident ID: 
                    ${datum.group_id}
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
                tickValues={dateValues.map((ts) => new Date(ts * 1000))}
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
                      key={bar[0].group_id}
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
                          target: 'data',
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
