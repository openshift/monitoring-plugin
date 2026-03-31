import { ShowTimeseries } from '../../../src/components/ols-tool-ui/ShowTimeseries';

describe('ShowTimeseries', () => {
  const tool = {
    args: {
      title: 'CPU Usage',
      query: 'rate(process_cpu_seconds_total[5m])',
      description: 'CPU usage over time',
    },
  };

  it('renders the panel with correct title and description', () => {
    cy.mount(<ShowTimeseries tool={tool} />);
    cy.get('[data-testid="panel-definition"]')
      .invoke('attr', 'data-definition')
      .then((json) => {
        const definition = JSON.parse(json as string);
        expect(definition.spec.display.name).to.eq('CPU Usage');
        expect(definition.spec.display.description).to.contain('CPU usage over time');
        expect(definition.spec.display.description).to.contain('Query:');
      });
  });

  it('renders the AddToDashboardButton with correct props', () => {
    cy.mount(<ShowTimeseries tool={tool} />);
    cy.get('[data-testid="add-to-dashboard"]')
      .should('have.attr', 'data-name', 'CPU Usage')
      .and('have.attr', 'data-query', 'rate(process_cpu_seconds_total[5m])')
      .and('have.attr', 'data-description', 'CPU usage over time');
  });

  it('wraps content in the Perses wrapper', () => {
    cy.mount(<ShowTimeseries tool={tool} />);
    cy.get('[data-testid="perses-wrapper"]').should('exist');
    cy.get('[data-testid="mock-panel"]').should('exist');
  });

  const relativeTimeRangeCases = [
    {
      name: 'defaults to 1h when no time args provided',
      timeArgs: {},
      expected: { pastDuration: '1h' },
    },
    {
      name: 'uses custom duration',
      timeArgs: { duration: '30m' },
      expected: { pastDuration: '30m' },
    },
    {
      name: 'treats end=NOW without start as relative',
      timeArgs: { end: 'NOW', duration: '2h' },
      expected: { pastDuration: '2h' },
    },
  ];

  relativeTimeRangeCases.forEach(({ name, timeArgs, expected }) => {
    it(`relative time range: ${name}`, () => {
      cy.mount(<ShowTimeseries tool={{ args: { ...tool.args, ...timeArgs } }} />);
      cy.get('[data-testid="perses-wrapper"]')
        .invoke('attr', 'data-time-range')
        .then((json) => {
          expect(JSON.parse(json as string)).to.deep.eq(expected);
        });
    });
  });

  const absoluteTimeRangeCases = [
    {
      name: 'ISO start and end',
      timeArgs: { start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z', duration: '1h' },
      expected: { startISO: '2024-01-01T00:00:00.000Z', endISO: '2024-01-02T00:00:00.000Z' },
    },
    {
      name: 'ISO start with end=NOW',
      timeArgs: { start: '2024-01-01T00:00:00Z', end: 'NOW' },
      expected: { startISO: '2024-01-01T00:00:00.000Z', endOffsetMs: 0 },
    },
    {
      name: 'NOW-offset expressions (NOW-48h to NOW-24h)',
      timeArgs: { start: 'NOW-48h', end: 'NOW-24h' },
      expected: { startOffsetMs: 48 * 3600 * 1000, endOffsetMs: 24 * 3600 * 1000 },
    },
    {
      name: 'compound Prometheus-style duration (NOW-1d2h)',
      timeArgs: { start: 'NOW-1d2h', end: 'NOW' },
      expected: { startOffsetMs: (24 + 2) * 3600 * 1000, endOffsetMs: 0 },
    },
  ];

  absoluteTimeRangeCases.forEach(({ name, timeArgs, expected }) => {
    it(`absolute time range: ${name}`, () => {
      const now = Date.now();
      cy.mount(<ShowTimeseries tool={{ args: { ...tool.args, ...timeArgs } }} />);
      cy.get('[data-testid="perses-wrapper"]')
        .invoke('attr', 'data-time-range')
        .then((json) => {
          const timeRange = JSON.parse(json as string);
          if (expected.startISO) {
            expect(timeRange.start).to.eq(expected.startISO);
          } else {
            expect(new Date(timeRange.start).getTime()).to.be.closeTo(now - expected.startOffsetMs, 5000);
          }
          if (expected.endISO) {
            expect(timeRange.end).to.eq(expected.endISO);
          } else {
            expect(new Date(timeRange.end).getTime()).to.be.closeTo(now - expected.endOffsetMs, 5000);
          }
        });
    });
  });

  it('timezone support: defaults to UTC when not specified', () => {
    cy.mount(<ShowTimeseries tool={tool} />);
    cy.get('[data-testid="perses-wrapper"]')
      .should('have.attr', 'data-timezone', 'UTC');
  });
});
