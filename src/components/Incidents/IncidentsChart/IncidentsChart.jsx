import * as React from 'react';

export function IncidentGanttChart({ groups, viewport }) {
    // TODO useResizeObserver()
    const width = 550;
    const height = 100;

    return (
      <React.Component
        style={{
          position: 'relative',
          width,
          height,
          overflow: 'hidden',
          border: '1px solid #EFEFEF',
        }}
      >
        <React.Component style={{ position: 'relative', paddingBottom: '10px' }}>
          {groups.map((group, i) => (
            <IncidentsRow key={i} incidents={group} viewport={viewport} />
          ))}
          <Ticks />
        </React.Component>
        <React.Component style={{ position: 'relative', borderTop: '2px solid #F3F3F3' }}>
          <TicksHeader viewport={viewport} />
        </React.Component>
      </React.Component>
    );
  }

  export function IncidentsRow({ incidents, viewport }) {
    return (
      <React.Component style={{ position: 'relative', height: '10px' }}>
        {incidents.map((incident, i) => (
          <IncidentBox key={i} incident={incident} viewport={viewport} />
        ))}
      </React.Component>
    );
  }

  export function IncidentBox({ incident, viewport }) {
    const incidentDuration = incident.end.getTime() - incident.start.getTime();
    const viewportDuration = viewport.end.getTime() - viewport.start.getTime();
    const relativeStart = (incident.start.getTime() - viewport.start.getTime()) / viewportDuration;
    const relativeDuration = incidentDuration / viewportDuration;

    return (
      <React.Component
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

  const TickHeaderBox = () => ({
    position: 'absolute',
    height: '100%',
    transform: 'translate(-50%)',
  });

  const TickBox = () => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeft: '1px solid #F3F3F3',
  });

  export function Ticks() {
    return (
      <>
        <TickBox style={{ left: '25%' }} />
        <TickBox style={{ left: '50%' }} />
        <TickBox style={{ left: '75%' }} />
      </>
    );
  }

  export function TicksHeader({ viewport }) {
    const duration = viewport.end.getTime() - viewport.start.getTime();
    const startAt = viewport.start.getTime();

    return (
      <React.Component>
        <TickHeaderBox style={{ left: '25%' }}>
          {formatDate(new Date(startAt + duration * 0.25))}
        </TickHeaderBox>
        <TickHeaderBox style={{ left: '50%' }}>
          {formatDate(new Date(startAt + duration * 0.5))}
        </TickHeaderBox>
        <TickHeaderBox style={{ left: '75%' }}>
          {formatDate(new Date(startAt + duration * 0.75))}
        </TickHeaderBox>
      </React.Component>
    );
  }