import { nav } from './nav';

export const incidentsPage = {
  goTo: () => {
    cy.log('incidentsPage.goTo');
    nav.sidenav.clickNavLink(['Observe', 'Incidents']);
  },

  setDays: (value: '1 day' | '3 days' | '7 days' | '15 days') => {
    cy.log('incidentsPage.setDays');
    incidentsPage.elements.daysSelect().click();
    cy.contains(value).should('be.visible').click();
  },

  toggleFilter: (name: 'Critical' | 'Warning' | 'Informative' | 'Firing' | 'Resolved') => {
    cy.log('incidentsPage.toggleFilter');
    incidentsPage.elements.filtersSelect().click();
    cy.contains('label', name)
      .find('input[type="checkbox"]')
      .click({ force: true });  
    incidentsPage.elements.filtersSelect().click();
  },

  clearAllFilters: () => {
    cy.log('incidentsPage.clearAllFilters');
    incidentsPage.elements.clearAllFiltersButton().click({ force: true });
  },

  toggleCharts: () => {
    cy.log('incidentsPage.toggleCharts');
    incidentsPage.elements.toggleChartsButton().click();
  },

  selectIncidentByBarIndex: (index = 0) => {
    cy.log('incidentsPage.selectIncidentByBarIndex');
    incidentsPage.elements.incidentsChartCard()
      .find('path[role="presentation"]')
      .eq(index)
      .click({ force: true });
  },

  expandRow: (rowIndex = 0) => {
    cy.log('incidentsPage.expandRow');
    incidentsPage.elements.alertsTable()
      .find('tbody')
      .eq(rowIndex)
      .within(() => {
        cy.get('[aria-label="Details"], button[aria-expanded], button.pf-m-plain')
          .first()
          .click({ force: true });
      });
  },

  // Centralized element selectors - all selectors defined in one place
  elements: {
    // Page structure
    toolbar: () => cy.get('#toolbar-with-filter'),

    // Controls and filters
    daysSelect: () => cy.get('button[data-ouia-component-id="OUIA-Generated-MenuToggle-4"]'),
    filtersSelect: () => cy.get('button[data-ouia-component-id="OUIA-Generated-MenuToggle-5"]'),
    clearAllFiltersButton: () => cy.contains('button', 'Clear all filters'),
    toggleChartsButton: () => cy.contains('button', /Hide graph|Show graph/),

    // Charts and visualizations  
    incidentsChartTitle: () => cy.contains('Incidents Timeline'),
    incidentsChartCard: () => cy.contains('Incidents Timeline').closest('.pf-v6-c-card'),
    incidentsChartSvg: () => incidentsPage.elements.incidentsChartCard().find('svg'),
    
    alertsChartTitle: () => cy.contains('Alerts Timeline'),
    alertsChartCard: () => cy.contains('Alerts Timeline').closest('.pf-v6-c-card'),
    alertsChartSvg: () => incidentsPage.elements.alertsChartCard().find('svg'),
    alertsChartEmptyState: () => cy.contains('Select an incident in the chart above to see alerts.').closest('.pf-v6-c-card'),

    // Tables and data
    alertsTable: () => cy.get('[aria-label="alerts-table"]'),
  },
};