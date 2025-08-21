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
    // TODO: There are two bars for the same incident, one transparent, one not. 
    // Right now, we use both which works but doubles the execution time.
    return cy.waitUntil(() => {
      return incidentsPage.elements.incidentsChartCard()
        .find('path[role="presentation"]')
        .eq(index)
        .click({ force: true })
        .then(() => {
          return Cypress.$('[aria-label="alerts-table"]').length > 0;
        });
    }, { interval: 10000, timeout: 120000 })
    .then(() => incidentsPage.elements.alertsTable().scrollIntoView().should('be.visible'))
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


  findIncidentWithAlert: (alertName: string): Cypress.Chainable<boolean> => {
    cy.log(`incidentsPage.findIncidentWithAlert: ${alertName}`);
    return incidentsPage.elements.incidentsChartCard()
      .find('path[role="presentation"]')
      .then(($bars) => {
        const totalBars = $bars.length;
        if (totalBars <= 3) { // 3 paths are always present in the legend,
        // their parent is g without presentation label opposed ot the proper bars
          cy.task('log', 'No bars found in incidents chart');
          return cy.wrap(false);
        }

        const tryIndex = (index: number): Cypress.Chainable<boolean> => {
          if (index >= totalBars - 3) {
            return cy.wrap(false);
          }

          return cy
            .wrap(null)
            .then(() => {
              incidentsPage.selectIncidentByBarIndex(index);
              return null;
            })
            .then(() => incidentsPage.elements.alertsTable().invoke('text'))
            .then((text) => {
              if (String(text).includes(alertName)) {
                return cy.wrap(true);
              }
              // Expand a row if present to surface nested details
              incidentsPage.expandRow(0);
              return incidentsPage.elements.alertsTable().invoke('text').then((text2) => {
                if (String(text2).includes(alertName)) {
                  return cy.wrap(true);
                }
                return tryIndex(index + 1);
              });
            });
        };

        return tryIndex(0);
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