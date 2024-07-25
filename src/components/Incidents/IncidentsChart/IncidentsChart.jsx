import * as React from 'react';

import { ChartLegend, ChartBaseTheme } from '@patternfly/react-charts';
import { Flex, FlexItem, Title } from '@patternfly/react-core';
import './IncidentsChart.css';
import IncidentsChartLegend from './IncidentsChartLegend';

export function IncidentGanttChart({ groups, viewport }) {
  // TODO useResizeObserver()
  const width = '100%';
  const height = 200;

  const titleCss = {
    fontSize: '--pf-v5-c-title--m-lg--FontSize',
    fontWeight: '--pf-v5-c-title--m-lg--FontWeight',
    lineHeight: '--pf-v5-c-title--m-lg--LineHeight',
  };

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        border: '1px solid #EFEFEF',
        paddingBottom: '50',
        paddingTop: '50',
        paddingLeft: '50',
        paddingRight: '50',
      }}
      className="incidents-top-chart-container"
    >
      <Flex
        direction={{ default: 'column' }}
        style={{ position: 'relative', paddingBottom: '10px' }}
        className="incidents-top-chart-graph"
      >
        <FlexItem align={{ md: 'alignLeft' }}>
          <Title
            className="incidents-chart-title"
            style={{
              paddingLeft: '2rem',
              marginTop: `0.375rem`,
              fontSize: '1.125rem',
              fontWeight: '400',
              lineHeight: '1.5',
            }}
            headingLevel="h2"
            size="md"
          >
            Incidents timeline
          </Title>
        </FlexItem>
        <FlexItem>
          {groups.map((group, i) => (
            <IncidentsRow key={i} incidents={group} viewport={viewport} />
          ))}
        </FlexItem>
        <FlexItem>
          <Ticks />
        </FlexItem>
      </Flex>
      <FlexItem>
        <div style={{ position: 'relative', borderTop: '2px solid #F3F3F3' }}>
          <TicksHeader viewport={viewport} />
        </div>
      </FlexItem>
      <IncidentsChartLegend />
    </div>
  );
}

export function IncidentsRow({ incidents, viewport }) {
  return (
    <div style={{ position: 'relative', height: '10px' }} className="incidents-top-chart-rows">
      {incidents.map((incident, i) => (
        <IncidentBox key={i} incident={incident} viewport={viewport} />
      ))}
    </div>
  );
}

export function IncidentBox({ incident, viewport }) {
  const incidentDuration = incident.end.getTime() - incident.start.getTime();
  const viewportDuration = viewport.end.getTime() - viewport.start.getTime();
  const relativeStart = (incident.start.getTime() - viewport.start.getTime()) / viewportDuration;
  const relativeDuration = incidentDuration / viewportDuration;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${relativeStart * 100}%`,
        width: `${relativeDuration * 100}%`,
        top: '15%',
        height: '70%',
        backgroundColor: incident.color,
      }}
    />
  );
}

function formatDate(d) {
  const options = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  };
  return d.toLocaleString(undefined, options);
}

export function Ticks() {
  //TODO should be aligned with days on the bottom part of the chart
  return (
    <div className="incidents-top-chart-ticks">
      <div
        style={{
          left: '25%',
          position: 'absolute',
          top: 0,
          bottom: 0,
          borderLeft: '1px solid #F3F3F3',
        }}
      />
      <div
        style={{
          left: '50%',
          position: 'absolute',
          top: 0,
          bottom: 0,
          borderLeft: '1px solid #F3F3F3',
        }}
      />
      <div
        style={{
          left: '75%',
          position: 'absolute',
          top: 0,
          bottom: 0,
          borderLeft: '1px solid #F3F3F3',
        }}
      />
    </div>
  );
}

export function TicksHeader({ viewport }) {
  const duration = viewport.end.getTime() - viewport.start.getTime();
  const startAt = viewport.start.getTime();

  return (
    <div>
      <div
        style={{ left: '25%', position: 'absolute', height: '100%', transform: 'translate(-50%)' }}
      >
        {formatDate(new Date(startAt + duration * 0.25))}
      </div>
      <div
        style={{ left: '50%', position: 'absolute', height: '100%', transform: 'translate(-50%)' }}
      >
        {formatDate(new Date(startAt + duration * 0.5))}
      </div>
      <div
        style={{ left: '75%', position: 'absolute', height: '100%', transform: 'translate(-50%)' }}
      >
        {formatDate(new Date(startAt + duration * 0.75))}
      </div>
    </div>
  );
}
