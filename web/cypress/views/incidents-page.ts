import { nav } from './nav';
import { DataTestIDs } from '../../src/components/data-test';


export const incidentsPage = {
  
    // Centralized element selectors - all selectors defined in one place
    elements: {
      // Page structure
      toolbar: () => cy.byTestID(DataTestIDs.IncidentsPage.Toolbar),
      loadingSpinner: () => cy.byTestID(DataTestIDs.IncidentsPage.LoadingSpinner),
  
      // Controls and filters
      daysSelect: () => cy.byTestID(DataTestIDs.IncidentsPage.DaysSelect),
      daysSelectToggle: () => cy.byTestID(DataTestIDs.IncidentsPage.DaysSelectToggle),
      
      // Filter type selection (first step)
      filtersSelect: () => cy.byTestID(DataTestIDs.IncidentsPage.FiltersSelect),
      filtersSelectToggle: () => cy.byTestID(DataTestIDs.IncidentsPage.FiltersSelectToggle),
      filtersSelectList: () => cy.byTestID(DataTestIDs.IncidentsPage.FiltersSelectList),
      filtersSelectOption: (filterType: string) => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectOption}-${filterType.toLowerCase()}`),
      
      // Specific filter selects (second step) - only visible when filter type is selected
      severityFilterSelect: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelect}-severity`),
      severityFilterToggle: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectToggle}-severity`),
      severityFilterList: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectList}-severity`),
      severityFilterOption: (severity: string) => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectOption}-severity-${severity.toLowerCase()}`),
      
      stateFilterSelect: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelect}-state`),
      stateFilterToggle: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectToggle}-state`),
      stateFilterList: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectList}-state`),
      stateFilterOption: (state: string) => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectOption}-state-${state.toLowerCase()}`),
      
      incidentIdFilterSelect: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelect}-incident id`),
      incidentIdFilterToggle: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectToggle}-incident id`),
      incidentIdFilterList: () => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectList}-incident id`),
      incidentIdFilterOption: (incidentId: string) => cy.byTestID(`${DataTestIDs.IncidentsPage.FiltersSelectOption}-incident id-${incidentId.toLowerCase()}`),
      
      // Filter chips (active filters with remove buttons)
      // Note: PatternFly ToolbarFilter doesn't pass through data-test attributes,
      // so we use semantic selectors based on the category labels
      severityFilterChip: () => incidentsPage.elements.toolbar().contains('span', 'Severity').parent(),
      stateFilterChip: () => incidentsPage.elements.toolbar().contains('span', 'State').parent(),
      incidentIdFilterChip: () => incidentsPage.elements.toolbar().contains('span', 'Incident ID').parent(),
      filterChipValue: (value: string) => incidentsPage.elements.toolbar().contains('span', value),
      
      clearAllFiltersButton: () => cy.byTestID(DataTestIDs.IncidentsPage.Toolbar).contains('button', 'Clear all filters'),
      toggleChartsButton: () => cy.byTestID(DataTestIDs.IncidentsPage.ToggleChartsButton),
  
      // Charts and visualizations  
      incidentsChartTitle: () => cy.byTestID(DataTestIDs.IncidentsChart.Title),
      incidentsChartCard: () => cy.byTestID(DataTestIDs.IncidentsChart.Card),
      incidentsChartContainer: () => cy.byTestID(DataTestIDs.IncidentsChart.ChartContainer),
      incidentsChartLoadingSpinner: () => cy.byTestID(DataTestIDs.IncidentsChart.LoadingSpinner),
      incidentsChartBars: () => cy.byTestID(DataTestIDs.IncidentsChart.ChartBars),
      incidentsChartBar: (groupId: string) => cy.byTestID(`${DataTestIDs.IncidentsChart.ChartBar}-${groupId}`),
      incidentsChartBarsVisiblePaths: () => {
        return cy.get('body').then($body => {
          // There is a delay between the element being rendered and the paths being visible.
          // The case when no paths are visible is valid, so we can not use should or conditional testing semantics.
          cy.wait(500);
          // We need to use the $body as both cases when the element is there or not are valid.
          const exists = $body.find('g[role="presentation"][data-test*="incidents-chart-bar-"]').length > 0;
          if (exists) {
            return cy.get('g[role="presentation"][data-test*="incidents-chart-bar-"]')
              .find('path[role="presentation"]')
              .filter((index, element) => {
                const fillOpacity = Cypress.$(element).css('fill-opacity') || Cypress.$(element).attr('fill-opacity');
                return parseFloat(fillOpacity || '0') > 0;
              });
          } else {
            cy.log('Chart bars were not found. Test continues.');
            return cy.wrap([]);
          }
        });
      },
      incidentsChartBarsVisiblePathsNonEmpty: () => {
        return cy.get('g[role="presentation"][data-test*="incidents-chart-bar-"]')
          .should('exist')
          .find('path[role="presentation"]')
          .should('have.length.greaterThan', 0)
          .filter((index, element) => {
            const fillOpacity = Cypress.$(element).css('fill-opacity') || Cypress.$(element).attr('fill-opacity');
            return parseFloat(fillOpacity || '0') > 0;
          });
      },
      incidentsChartBarsGroups: () => cy.byTestID(DataTestIDs.IncidentsChart.ChartBars)
      .find('g[role="presentation"][data-test*="incidents-chart-bar-"]'),
      incidentsChartSvg: () => incidentsPage.elements.incidentsChartCard().find('svg'),
      
      alertsChartTitle: () => cy.byTestID(DataTestIDs.AlertsChart.Title),
      alertsChartCard: () => cy.byTestID(DataTestIDs.AlertsChart.Card),
      alertsChartContainer: () => cy.byTestID(DataTestIDs.AlertsChart.ChartContainer),
      alertsChartSvg: () => incidentsPage.elements.alertsChartCard().find('svg'),
      alertsChartEmptyState: () => cy.byTestID(DataTestIDs.AlertsChart.EmptyState),
  
      // Tables and data
      incidentsTable: () => cy.byTestID(DataTestIDs.IncidentsTable.Table),
      incidentsTableRow: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsTable.Row}-${index}`),
      incidentsTableExpandButton: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsTable.ExpandButton}-${index}`).find('button'),
      incidentsTableComponentCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsTable.ComponentCell}-${index}`),
      incidentsTableSeverityCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsTable.SeverityCell}-${index}`),
      incidentsTableStateCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsTable.StateCell}-${index}`),
      
      // Details table (expanded row)
      incidentsDetailsTable: () => cy.byTestID(DataTestIDs.IncidentsDetailsTable.Table),
      incidentsDetailsLoadingSpinner: () => cy.byTestID(DataTestIDs.IncidentsDetailsTable.LoadingSpinner),
      incidentsDetailsRow: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsDetailsTable.Row}-${index}`),
      incidentsDetailsAlertRuleCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsDetailsTable.AlertRuleCell}-${index}`),
      incidentsDetailsAlertRuleLink: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsDetailsTable.AlertRuleLink}-${index}`),
      incidentsDetailsNamespaceCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsDetailsTable.NamespaceCell}-${index}`),
      incidentsDetailsSeverityCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsDetailsTable.SeverityCell}-${index}`),
      incidentsDetailsStateCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsDetailsTable.StateCell}-${index}`),
      incidentsDetailsStartCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsDetailsTable.StartCell}-${index}`),
      incidentsDetailsEndCell: (index: number) => cy.byTestID(`${DataTestIDs.IncidentsDetailsTable.EndCell}-${index}`),
      
      // Generic selectors for incident table rows and details table rows
      incidentsTableRows: () => incidentsPage.elements.incidentsTable().find(`tbody[data-test*="${DataTestIDs.IncidentsTable.Row}-"]`),
      incidentsDetailsTableRows: () => incidentsPage.elements.incidentsDetailsTable().find('tbody tr'),
      
      // Days select options
      daysSelectList: () => cy.byTestID(DataTestIDs.IncidentsPage.DaysSelectList),
      daysSelectOption: (days: string) => cy.byTestID(`${DataTestIDs.IncidentsPage.DaysSelectOption}-${days.replace(' ', '-')}`),
    },
  
  
  
  goTo: () => {
    cy.log('incidentsPage.goTo');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Incidents');

  },

  setDays: (value: '1 day' | '3 days' | '7 days' | '15 days') => {
    cy.log('incidentsPage.setDays');

    incidentsPage.elements.daysSelectToggle().scrollIntoView().click();
    const dayKey = value.replace(' ', '-');
    cy.byTestID(`${DataTestIDs.IncidentsPage.DaysSelectOption}-${dayKey}`).should('be.visible').click();
    incidentsPage.elements.daysSelectToggle().should('contain.text', value);
  },

  toggleFilter: (name: 'Critical' | 'Warning' | 'Informative' | 'Firing' | 'Resolved') => {
    cy.log('incidentsPage.toggleFilter');
    
    // Determine filter type based on the filter name
    const isSeverityFilter = ['Critical', 'Warning', 'Informative'].includes(name);
    const filterType = isSeverityFilter ? 'Severity' : 'State';
    
    // Step 1: Select filter type if not already selected
    incidentsPage.elements.filtersSelectToggle().click();
    incidentsPage.elements.filtersSelectOption(filterType).click();
    
    // Step 2: Select the specific filter value
    if (isSeverityFilter) {
      incidentsPage.elements.severityFilterToggle().click();
      incidentsPage.elements.severityFilterOption(name).click();
    } else {
      incidentsPage.elements.stateFilterToggle().click();
      incidentsPage.elements.stateFilterOption(name).click();
    }
  },

  clearAllFilters: () => {
    cy.log('incidentsPage.clearAllFilters');
    incidentsPage.elements.clearAllFiltersButton().click({ force: true });
  },

  removeFilter: (category: 'Severity' | 'State' | 'Incident ID', value: string) => {
    cy.log(`incidentsPage.removeFilter: Removing ${value} from ${category} filters`);
    // Bulletproof approach: directly target the close button by its specific aria-label
    // This is the most reliable selector since each button has a unique aria-label
    incidentsPage.elements.toolbar()
      .find(`button[aria-label="Close ${value}"]`)
      .click({ force: true });
  },

  removeFilterCategory: (category: 'Severity' | 'State' | 'Incident ID') => {
    const chipElementMap = {
      'Severity': () => incidentsPage.elements.severityFilterChip(),
      'State': () => incidentsPage.elements.stateFilterChip(),
      'Incident ID': () => incidentsPage.elements.incidentIdFilterChip(),
    };
    
    chipElementMap[category]().within(() => {
      cy.get('button[aria-label*="Close"]').click({ force: true });
    });
  },

  toggleCharts: () => {
    cy.log('incidentsPage.toggleCharts');
    incidentsPage.elements.toggleChartsButton().click();
  },

  /**
   * Selects an incident from the chart by clicking on a bar at the specified index.
   * 
   * @param index - Zero-based index of the incident bar to click (default: 0)
   * @returns Promise that resolves when the incidents table is visible
   */
  selectIncidentByBarIndex: (index = 0) => {
    cy.log(`incidentsPage.selectIncidentByBarIndex: ${index} (clicking visible path elements)`);
    
    return incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .should('have.length.greaterThan', index)
      .then(($paths) => {
        if (index >= $paths.length) {
          throw new Error(`Index ${index} exceeds available paths (${$paths.length})`);
        }
        
        return cy.wrap($paths.eq(index))
          .click({ force: true });
      })
      .then(() => {
        // The incident table loads the alerts for the previous incident first, then hides them and shows the alerts for the new incident
        // This is why we need to wait for 2 seconds and can not use should or conditional testing semantics
        cy.wait(2000);
        return incidentsPage.elements.incidentsTable()
          .scrollIntoView()
          .should('exist');
      });
  },

  deselectIncidentByBar: () => {
    cy.log('incidentsPage.deselectIncidentByBar');
    return incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .then(($paths) => {
        if ($paths.length === 0) {
          throw new Error('No paths found in incidents chart');
        }
        return cy.wrap($paths.eq(0))
          .click({ force: true });
      })
      .then(() => {
        return incidentsPage.elements.incidentsTable()
          .should('not.exist');
      });
  },

  expandRow: (rowIndex = 0) => {
    cy.log('incidentsPage.expandRow');
    incidentsPage.elements.incidentsTableExpandButton(rowIndex)
          .click({ force: true });
  },

  // Constants for search configuration
  SEARCH_CONFIG: {
    CHART_LOAD_WAIT: 1000,
    DEFAULT_DAYS: '1 day' as const,
  },

  prepareIncidentsPageForSearch: () => {
    cy.log('incidentsPage.prepareIncidentsPageForSearch: Setting up page for search');
    cy.reload();
    incidentsPage.setDays(incidentsPage.SEARCH_CONFIG.DEFAULT_DAYS);
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    cy.wait(incidentsPage.SEARCH_CONFIG.CHART_LOAD_WAIT);
  },

  /**
   * Checks if an alert name appears anywhere in the current incidents table text content.
   * 
   * @param alertName - Name of the alert to search for
   * @param incidentIndex - Zero-based incident index for logging purposes
   * @returns Promise resolving to true if alert name is found in table text
   */
  checkComponentRowInIncidentTableForAlert: (alertName: string, incidentIndex: number): Cypress.Chainable<boolean> => {
    return incidentsPage.elements.incidentsTable().invoke('text').then((text) => {
      if (String(text).includes(alertName)) {
        cy.log(`Found alert "${alertName}" in incident ${incidentIndex + 1} table content`);
        cy.log(text);
        return cy.wrap(true);
      }
      return cy.wrap(false);
    });
  },

  /**
   * Recursively expands and checks incident table rows for a specific alert.
   * Continues until alert is found or all rows are checked.
   * 
   * @param alertName - Name of the alert to search for
   * @param incidentIndex - Zero-based incident index for logging
   * @param totalRows - Total number of rows to check
   * @param currentRowIndex - Current row being checked (default: 0)
   * @returns Promise resolving to true if alert is found in any row
   */
  checkComponentInIncident: (alertName: string, incidentIndex: number, totalRows: number, currentRowIndex: number = 0): Cypress.Chainable<boolean> => {
    if (currentRowIndex >= totalRows) {
      cy.log(`Checked all ${totalRows} rows in incident ${incidentIndex + 1}, alert not found`);
      return cy.wrap(false);
    }
    
    cy.log(`Expanding and checking row ${currentRowIndex} in incident ${incidentIndex + 1}`);
    incidentsPage.expandRow(currentRowIndex);
    
    return incidentsPage.checkComponentRowInIncidentTableForAlert(alertName, incidentIndex)
      .then((found) => {
        if (found) {
          cy.log(`Found alert "${alertName}" in expanded row ${currentRowIndex} of incident ${incidentIndex + 1}`);
          return cy.wrap(true);
        }
        return incidentsPage.checkComponentInIncident(alertName, incidentIndex, totalRows, currentRowIndex + 1);
      });
  },

  /**
   * Searches for an alert in all components (usually connected with namespaces) of a single incident.
   * First checks main table content, then recursively expands and checks each row.
   * 
   * @param alertName - Name of the alert to search for
   * @param incidentIndex - Zero-based incident index for logging
   * @returns Promise resolving to true if alert is found anywhere in the incident
   */
  searchAllComponentsInIncident: (alertName: string, incidentIndex: number): Cypress.Chainable<boolean> => {
    cy.log(`incidentsPage.searchAllRowsInIncident: Checking all rows in incident ${incidentIndex + 1} for alert "${alertName}"`);
    
    return incidentsPage.checkComponentRowInIncidentTableForAlert(alertName, incidentIndex)
      .then((foundInMain) => {
        if (foundInMain) {
          return cy.wrap(true);
        }
        
        return incidentsPage.elements.incidentsTable()
          .find('tbody[data-test*="incidents-table-row-"]')
          .then(($rows) => {
            const totalRows = $rows.length;
            if (totalRows === 0) {
              cy.log(`No rows found in incident ${incidentIndex + 1}`);
              return cy.wrap(false);
            }
            
            cy.log(`Found ${totalRows} incident rows to check in incident ${incidentIndex + 1}`);
            return incidentsPage.checkComponentInIncident(alertName, incidentIndex, totalRows);
          });
      });
  },

  /**
   * Searches for an alert within a specific incident by selecting it and checking all components.
   * Combines incident selection with comprehensive component search.
   * 
   * @param alertName - Name of the alert to search for
   * @param incidentIndex - Zero-based index of the incident to search
   * @returns Promise resolving to true if alert is found in the incident
   */
  searchForAlertInIncident: (alertName: string, incidentIndex: number): Cypress.Chainable<boolean> => {
    cy.log(`incidentsPage.searchForAlertInIncident: Checking incident ${incidentIndex + 1} for alert "${alertName}"`);
    
    return cy
      .wrap(null)
      .then(() => {
        incidentsPage.selectIncidentByBarIndex(incidentIndex);
        return null;
      })
      .then(() => incidentsPage.searchAllComponentsInIncident(alertName, incidentIndex));
  },

  /**
   * Recursively traverses all incident bars in the chart, searching each one for a specific alert.
   * Uses internal recursive function to systematically check each incident until found or exhausted.
   * 
   * @param alertName - Name of the alert to search for
   * @param totalIncidents - Total number of incidents to traverse
   * @returns Promise resolving to true if alert is found in any incident
   */
  traverseAllIncidentsBars: (alertName: string, totalIncidents: number): Cypress.Chainable<boolean> => {
    cy.log(`incidentsPage.searchAllIncidents: Searching ${totalIncidents} incidents for alert "${alertName}"`);
    
    const searchNextIncidentBar = (currentIndex: number): Cypress.Chainable<boolean> => {
      if (currentIndex >= totalIncidents) {
        cy.log(`Checked all ${totalIncidents} incidents, alert "${alertName}" not found`);
        return cy.wrap(false);
      }

      return incidentsPage.searchForAlertInIncident(alertName, currentIndex)
        .then((found) => {
          if (found) {
            return cy.wrap(true);
          }
          incidentsPage.deselectIncidentByBar();
          // Wait for the incident to be deselected
          // Quick workaround, could be improved by waiting for the number of paths to change, but it
          // does not has to if 1 initially. The check for the alert table non existance is already implemented,
          // but there seems to be a short delay between the alert table closing and new bars rendering.
          cy.wait(500)
          return searchNextIncidentBar(currentIndex + 1);
        });
    };

    return searchNextIncidentBar(0);
  },

  /**
   * Main entry point for finding an alert across all incidents in the chart.
   * Prepares the page, gets visible incident bars, and initiates comprehensive search.
   * 
   * @param alertName - Name of the alert to search for across all incidents
   * @returns Promise resolving to true if alert is found in any incident
   */
  findIncidentWithAlert: (alertName: string): Cypress.Chainable<boolean> => {
    cy.log(`incidentsPage.findIncidentWithAlert: Starting search for alert "${alertName}"`);
    
    incidentsPage.prepareIncidentsPageForSearch();
    
    return incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .then(($paths) => {
        const totalPaths = $paths.length;
        if (totalPaths === 0) {
          cy.log('No visible incident bar paths found in chart');
          return cy.wrap(false);
        }
        
        return incidentsPage.traverseAllIncidentsBars(alertName, totalPaths);
      });
  },

  /**
   * Gets structured information about alerts in the currently selected incident.
   * Expands all incident rows and collects alert details from the expanded tables.
   * 
   * @returns Promise resolving to an array of alert information objects
   */
  getSelectedIncidentAlerts: () => {
    cy.log('incidentsPage.getSelectedIncidentAlerts: Collecting alert information from selected incident');
    
    return incidentsPage.elements.incidentsTableRows()
      .then(($rows) => {
        const totalRows = $rows.length;
        if (totalRows === 0) {
          cy.log('No incident rows found');
          return cy.wrap([]);
        }

        cy.log(`Found ${totalRows} incident rows to expand`);
        
        // Expand all rows first
        for (let i = 0; i < totalRows; i++) {
          incidentsPage.expandRow(i);
        }
        
        // Wait for all details to load
        cy.wait(1000);
        
        // Count alert rows using the generic selector for details table rows
        return incidentsPage.elements.incidentsDetailsTableRows()
          .then(($detailRows) => {
            const alerts = [];
            
            // Create alert info objects with row indices and element references
            for (let i = 0; i < $detailRows.length; i++) {
              alerts.push({
                index: i,
                // Provide direct element reference for the row
                getRow: () => cy.wrap($detailRows.eq(i)),
                // Provide cell getters using column selectors based on data-label attributes
                getAlertRuleCell: () => cy.wrap($detailRows.eq(i)).find('td[data-label*="alertname"]'),
                getNamespaceCell: () => cy.wrap($detailRows.eq(i)).find('td[data-label*="namespace"]'),
                getSeverityCell: () => cy.wrap($detailRows.eq(i)).find('td[data-label*="severity"]'),
                getStateCell: () => cy.wrap($detailRows.eq(i)).find('td[data-label*="alertstate"]'),
                getStartCell: () => cy.wrap($detailRows.eq(i)).find('td[data-label*="firingstart"]'),
                getEndCell: () => cy.wrap($detailRows.eq(i)).find('td[data-label*="firingend"]')
              });
            }
            
            cy.log(`Collected information for ${alerts.length} alerts`);
            return cy.wrap(alerts);
          });
      });
  }
};