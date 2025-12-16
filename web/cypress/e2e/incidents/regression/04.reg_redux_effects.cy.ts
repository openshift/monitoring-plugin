/*
Regression tests for Redux state management and effects issues (Section 4.5).

Test cases:
1. Initial Loading Bug: All incidents should load on fresh page load without
   requiring days filter manipulation.
   Verifies: OU-1002
2. Dropdown Closure on Deselection: Verifies dropdowns close when incident is
   deselected via bar click OR chip removal.
   Verifies: OU-1033
3. Filter State Preservation: When incident ID is selected and a non-matching
   severity filter is added, both filters should remain applied.
   Verifies: OU-1030
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

describe('Regression: Redux State Management', { tags: ['@incidents', '@incidents-redux'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    cy.log('Navigate to Observe → Incidents');
    incidentsPage.goTo();
    cy.log('Setting up comprehensive filtering test scenarios');
    cy.mockIncidentFixture('incident-scenarios/7-comprehensive-filtering-test-scenarios.yaml');
  });

  it('1. Fresh load should display all 12 incidents without days filter manipulation', () => {
    cy.log('1.1 Verify all incidents load immediately on fresh page load');
    
    incidentsPage.clearAllFilters();
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    
    // The bug: initially not all incidents are loaded, requiring days filter toggle
    // Use waitUntil to give it time to load, but it should load quickly if working properly
    cy.waitUntil(
      () => incidentsPage.elements.incidentsChartBarsGroups().then($groups => $groups.length === 12),
      {
        timeout: 10000,
        interval: 500,
        errorMsg: 'All 12 incidents should load within 10 seconds on fresh page load'
      }
    );
    cy.log('SUCCESS: All 12 incidents loaded on fresh page load');
    
    cy.log('1.2 Verify incident count remains stable without manipulation');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 12);
    cy.log('Incident count stable: 12 incidents maintained');
    
    cy.log('1.3 Verify days filter is set to default value');
    incidentsPage.elements.daysSelectToggle().should('contain.text', '7 days');
    cy.log('Default days filter confirmed: 7 days');
  });


  it('2. Dropdown should close and not reposition after incident deselection', () => {
    const dropdownScenarios = [
      {
        name: 'Filter type',
        setup: () => {},
        toggleElement: () => incidentsPage.elements.filtersSelectToggle(),
        listElement: () => incidentsPage.elements.filtersSelectList(),
      },
      {
        name: 'Severity value',
        setup: () => {
          incidentsPage.elements.filtersSelectToggle().click();
          incidentsPage.elements.filtersSelectOption('Severity').click();
        },
        toggleElement: () => incidentsPage.elements.severityFilterToggle(),
        listElement: () => incidentsPage.elements.severityFilterList(),
      },
      {
        name: 'Days filter',
        setup: () => {},
        toggleElement: () => incidentsPage.elements.daysSelectToggle(),
        listElement: () => incidentsPage.elements.daysSelectList(),
      }
    ];

    const deselectionMethods = [
      {
        name: 'bar click',
        action: () => {
          incidentsPage.elements.incidentsChartBarsVisiblePathsNonEmpty()
            .first()
            .click({ force: true });
        }
      },
      {
        name: 'chip removal',
        action: () => {
          incidentsPage.removeFilterCategory('Incident ID');
        }
      }
    ];

    incidentsPage.clearAllFilters();

    dropdownScenarios.forEach((dropdown) => {
      deselectionMethods.forEach((deselection) => {
        cy.log(`Testing: ${dropdown.name} dropdown with ${deselection.name} deselection`);
        
        incidentsPage.elements.incidentsChartBarsVisiblePathsNonEmpty()
          .first()
          .click({ force: true });
        
        incidentsPage.elements.alertsChartContainer().should('be.visible');
        incidentsPage.elements.incidentIdFilterChip().should('be.visible');
        
        dropdown.setup();
        
        dropdown.toggleElement().click();
        dropdown.listElement().should('be.visible');
        
        deselection.action();

        cy.wait(2000)
        
        dropdown.listElement().should('not.exist');
        cy.log(`SUCCESS: ${dropdown.name} dropdown closed after ${deselection.name}`);
      });
    });
  });

  it('3. Adding filter when incident selected should not remove the incident ID filter', () => {
    cy.log('3.1 Clear all filters and ensure critical incidents exist');
    incidentsPage.clearAllFilters();
    
    cy.log('3.2 Apply critical severity filter');
    incidentsPage.toggleFilter('Critical');
    
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length.greaterThan', 0);
    
    cy.log('3.3 Click on the first critical incident to select it by ID');
    incidentsPage.elements.incidentsChartBarsVisiblePathsNonEmpty()
      .first()
      .click({ force: true });
    
    cy.log('3.4 Verify incident ID filter chip appears');
    incidentsPage.elements.incidentIdFilterChip().should('be.visible');

    cy.log('3.5 Verify both Critical and Incident ID chips are present');
    incidentsPage.elements.filterChipValue('Critical').should('be.visible');
    incidentsPage.elements.incidentIdFilterChip().should('be.visible');
    
    cy.log('3.6 Deselect Critical and Apply Warning filter (which does not match the critical incident)');
    incidentsPage.toggleFilter('Critical');
    incidentsPage.toggleFilter('Warning');
    
    cy.log('3.7 Verify incident is filtered out (no bars visible)');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 0);
    cy.log('Incident correctly filtered out due to Warning filter');
    
    cy.log('3.8 Verify BOTH Warning filter and Incident ID filter are still applied');
    incidentsPage.elements.filterChipValue('Warning').should('be.visible');
    incidentsPage.elements.incidentIdFilterChip().should('be.visible');
    
    cy.log('SUCCESS: Incident ID filter was not removed when non-matching severity filter was added');
    
    cy.log('3.9 Remove Warning filter and verify incident reappears');
    incidentsPage.toggleFilter('Warning');
    
    cy.log('3.10 With only Incident ID filter, incident should be visible again');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 1);
    incidentsPage.elements.incidentIdFilterChip().should('be.visible');
    cy.log('SUCCESS: Incident reappears when conflicting filter removed');
  });
});
