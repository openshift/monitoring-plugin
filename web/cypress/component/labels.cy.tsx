import { Labels } from '../../src/components/labels';

describe('Labels', () => {
  it('renders "No labels" when labels is empty', () => {
    cy.mount(<Labels labels={{}} />);
    cy.contains('No labels').should('be.visible');
  });

  it('renders "No labels" when labels is undefined', () => {
    cy.mount(<Labels labels={undefined} />);
    cy.contains('No labels').should('be.visible');
  });

  it('renders a single label', () => {
    cy.mount(<Labels labels={{ app: 'monitoring' }} />);
    cy.contains('app').should('be.visible');
    cy.contains('monitoring').should('be.visible');
  });

  it('renders multiple labels', () => {
    const labels = {
      app: 'monitoring',
      env: 'production',
      team: 'platform',
    };
    cy.mount(<Labels labels={labels} />);

    cy.contains('app').should('be.visible');
    cy.contains('monitoring').should('be.visible');
    cy.contains('env').should('be.visible');
    cy.contains('production').should('be.visible');
    cy.contains('team').should('be.visible');
    cy.contains('platform').should('be.visible');
  });

  it('renders label with key=value format', () => {
    cy.mount(<Labels labels={{ severity: 'critical' }} />);
    cy.get('.pf-v6-c-label').within(() => {
      cy.contains('severity');
      cy.contains('=');
      cy.contains('critical');
    });
  });
});
