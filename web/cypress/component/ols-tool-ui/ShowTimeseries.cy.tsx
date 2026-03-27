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
        const definition = JSON.parse(json);
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
});
