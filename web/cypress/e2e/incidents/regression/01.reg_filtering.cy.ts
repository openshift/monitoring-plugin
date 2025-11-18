/*
Regression test for incidents filtering functionality.

This test uses the comprehensive filtering test scenarios to verify
that filtering works correctly across various incident types and severities.
Uses elements defined in incidents-page.ts for all interactions.

Verifies: OU-727
*/

import { incidentsPage } from '../../../views/incidents-page';

const MCP = {
  namespace: Cypress.env('COO_NAMESPACE'),
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: Cypress.env('COO_NAMESPACE'),
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Incidents Filtering', () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    cy.log('Navigate to Observe → Incidents');
    incidentsPage.goTo();
    cy.log('Setting up comprehensive filtering test scenarios');
    cy.mockIncidentFixture('incident-scenarios/7-comprehensive-filtering-test-scenarios.yaml');
  });

  it('1. Severity filtering - Critical, Warning, Info', () => {
    cy.log('1.1 Clear all filters and ensure all incidents are loaded');
    incidentsPage.clearAllFilters();

    incidentsPage.setDays('1 day');
    incidentsPage.setDays('7 days');
    
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 12);
    cy.log('All 12 incidents from comprehensive filtering scenarios are loaded');
    
    
    cy.log('1.2 Active filters: Critical');
    incidentsPage.toggleFilter('Critical');
    
    incidentsPage.elements.severityFilterChip().should('be.visible');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 7);
    
    cy.log('Verified: 7 incidents shown');
    
    
    cy.log('1.3 Active filters: Warning');
    incidentsPage.toggleFilter('Critical');  // Deselect Critical
    incidentsPage.toggleFilter('Warning');   // Select Warning
    incidentsPage.elements.severityFilterChip().should('be.visible');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 5);
    
    cy.log('Verified: 5 incidents shown');
    
    
    cy.log('1.4 Active filters: Informative');
    incidentsPage.toggleFilter('Warning');     // Deselect Warning
    incidentsPage.toggleFilter('Informative'); // Select Info
    incidentsPage.elements.severityFilterChip().should('be.visible');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 3);
    
    cy.log('Verified: 3 incidents shown');
    
    
    cy.log('1.6 Test severity filter combinations');
    cy.log('1.6.1 Active filters: Critical + Informative');
    incidentsPage.toggleFilter('Critical');  // Add Critical to existing Info
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 9);
    cy.log('Verified: 9 incidents shown');
    
    
    cy.log('1.6.2 Active filters: Warning + Informative');
    incidentsPage.toggleFilter('Critical');  // Deselect Critical
    incidentsPage.toggleFilter('Warning');   // Add Warning to existing Info
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 7);
    cy.log('Verified: 7 incidents shown');
    

    cy.log('1.6.3 Active filters: Critical + Warning + Informative');
    incidentsPage.toggleFilter('Critical');  // Add Critical to existing Info + Warning
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 12);
    cy.log('Verified: 12 incidents shown');
    
    
    cy.log('1.7 Test state filter combinations - remove all severity filters and focus on Info + state');
    cy.log('1.7.1 Active filters: Informative + Resolved');
    incidentsPage.toggleFilter('Critical');  // Deselect Critical
    incidentsPage.toggleFilter('Warning');   // Deselect Warning
    // Now we have only Informative selected
    incidentsPage.toggleFilter('Resolved');  // Add Resolved state filter
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 1);
    cy.log('Verified: 1 incident shown');
    
    
    cy.log('1.7.2 Active filters: Informative + Firing');
    incidentsPage.toggleFilter('Resolved'); // Deselect Resolved
    incidentsPage.toggleFilter('Firing');   // Select Firing
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 2);
    cy.log('Verified: 2 incidents shown');
    
    
    incidentsPage.clearAllFilters();
  });

  it('2. Chart interaction with active filters', () => {
    cy.log('Setting up filters for chart interaction testing');
    incidentsPage.clearAllFilters();
    
    // Set up a specific filter state for testing
    incidentsPage.toggleFilter('Informative');
    incidentsPage.toggleFilter('Firing');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 2);
    cy.log('Setup complete: Informative + Firing filters active, 2 incidents shown');
    
    cy.log('2.1 Select incident bar while filters are active');
    incidentsPage.selectIncidentByBarIndex(0);
    incidentsPage.elements.incidentsTable().should('be.visible');
    cy.log('Incident table displayed after bar selection');
    
    cy.log('2.2 Verify just selected incident is shown in the chart');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 1);
    cy.log('Verified: 1 incident shown');
    
    cy.log('2.3 Deselect incident bar and verify filter persistence');
    incidentsPage.deselectIncidentByBar();
    incidentsPage.elements.incidentsTable().should('not.exist');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 2);
    cy.log('Filters persisted after deselection: 2 incidents still shown');
    
    incidentsPage.clearAllFilters();
  });

});
