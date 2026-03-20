import { metricsPage } from '../../views/metrics';
import { Classes, DataTestIDs, LegacyTestIDs } from '../../../src/components/data-test';
import { MetricGraphEmptyState, MetricsPagePredefinedQueries, MetricsPageQueryInput, MetricsPageQueryKebabDropdown } from '../../fixtures/monitoring/constants';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runAllRegressionMetricsTests2(perspective: PerspectiveConfig) {
  testMetricsRegression2(perspective);
}

export function testMetricsRegression2(perspective: PerspectiveConfig) {

  it(`${perspective.name} perspective - Metrics > Add Query - Run Queries - Kebab icon`, () => {
    cy.log('6.1 Preparation to test Add Query button');
    metricsPage.clickActionsDeleteAllQueries();
    cy.byAriaLabel('Hide table').scrollIntoView().should('be.visible').should('have.length', 1);
    metricsPage.clickInsertExampleQuery();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);

    cy.log('6.2 Only one query added, resulting in 2 rows');
    metricsPage.clickActionsAddQuery();
    cy.byAriaLabel('Hide table').should('have.length', 2);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
 
    cy.log('6.3 Preparation to test Run Queries button');
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('be.visible').clear();
    cy.get(Classes.MetricsPageQueryInput).eq(0).type(MetricsPageQueryInput.VECTOR_QUERY);
    cy.bySemanticElement('button').contains('Unselect all').scrollIntoView().should('be.visible').should('have.length', 1);

    cy.log('6.4 Run Queries button');
    metricsPage.clickRunQueriesButton();
    cy.wait(5000);
    cy.get(Classes.MetricsPageUnselectedAllButton).should('have.length', 2);

    cy.log('6.5 Preparation to test Kebab icon - Disable query');
    metricsPage.disableEnableQuerySwitchAssertion(0, true);
    metricsPage.disableEnableQuerySwitchAssertion(1, true);
    metricsPage.expandCollapseRowAssertion(true, 0, true, true);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    
    cy.log('6.6 Kebab icon - Disable query');
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible').click();
    metricsPage.disableEnableQuerySwitchAssertion(0, false);
    metricsPage.disableEnableQuerySwitchAssertion(0, true);
    metricsPage.expandCollapseRowAssertion(false, 0, true, true);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.VECTOR_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.get('.pf-c-chart').should('be.visible');
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('not.exist');

    cy.log('6.7 Kebab icon - Enable query');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.ENABLE_QUERY).should('be.visible').click();
    metricsPage.disableEnableQuerySwitchAssertion(0, true);
    metricsPage.disableEnableQuerySwitchAssertion(1, true);
    metricsPage.expandCollapseRowAssertion(true, 0, true, true);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.VECTOR_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.get('.pf-c-chart').should('be.visible');
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible');
    metricsPage.clickKebabDropdown(0);

    cy.log('6.8 Switch - Disable query for both queries');
    metricsPage.clickDisableQuerySwitch(0);
    metricsPage.clickDisableQuerySwitch(0);
    metricsPage.disableEnableQuerySwitchAssertion(0, false);
    metricsPage.disableEnableQuerySwitchAssertion(1, false);
    metricsPage.expandCollapseRowAssertion(false, 0, true, true);
    metricsPage.expandCollapseRowAssertion(false, 1, true, true);
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.ENABLE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('have.attr', 'aria-disabled', 'true');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('not.exist');
    metricsPage.clickKebabDropdown(0);

    metricsPage.clickKebabDropdown(1);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.ENABLE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('have.attr', 'aria-disabled', 'true');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('not.exist');
    metricsPage.clickKebabDropdown(1);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.VECTOR_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.get('.pf-c-chart').should('not.exist');
    cy.get('h2').contains('No query entered').should('be.visible');
    cy.bySemanticElement('button').contains('Insert example query').should('be.visible');
    
    cy.log('6.9 Switch - Enable query for both queries');
    metricsPage.clickEnableQuerySwitch(0);
    metricsPage.clickEnableQuerySwitch(0);
    metricsPage.disableEnableQuerySwitchAssertion(0, true);
    metricsPage.disableEnableQuerySwitchAssertion(1, true);
    metricsPage.expandCollapseRowAssertion(true, 0, true, true);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible');
    metricsPage.clickKebabDropdown(0);

    metricsPage.clickKebabDropdown(1);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible');
    metricsPage.clickKebabDropdown(1);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.VECTOR_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.get('.pf-c-chart').should('be.visible');

    cy.log('6.10 Kebab icon - Hide all series');
    metricsPage.clickKebabDropdown(1);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible').click();
    cy.byAriaLabel('query results table').eq(1).find('button[aria-label="Show series"]').then(($seriesButtons) => {
      const seriesButtonsCount: number = Cypress.$($seriesButtons).length;
      for (let i = 0; i < seriesButtonsCount; i++) {
        metricsPage.seriesButtonAssertion(1, i, false);
      }
    });
    metricsPage.selectAllUnselectAllButtonAssertion(0, false);

    cy.log('6.11 Kebab icon - Show all series');
    metricsPage.clickKebabDropdown(1);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.SHOW_ALL_SERIES).should('be.visible').click();
    cy.byAriaLabel('query results table').eq(1).find('button[aria-label="Hide series"]').then(($seriesButtons) => {
      const seriesButtonsCount: number = Cypress.$($seriesButtons).length;
      for (let i = 0; i < seriesButtonsCount; i++) {
        metricsPage.seriesButtonAssertion(1, i, true);
      }
    });
    metricsPage.clickKebabDropdown(1);
    metricsPage.selectAllUnselectAllButtonAssertion(0, true);

    cy.log('6.12 Hide serie - index 1 - manually');
    metricsPage.clickSeriesButton(1, 0, false);
    metricsPage.seriesButtonAssertion(1, 0, false);
    metricsPage.selectAllUnselectAllButtonAssertion(0, false);
    metricsPage.clickKebabDropdown(1);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.SHOW_ALL_SERIES).should('be.visible');
    metricsPage.clickKebabDropdown(1);

    cy.log('6.13 Select serie - index 1 - manually');
    metricsPage.clickSeriesButton(1, 0, true);
    metricsPage.seriesButtonAssertion(1, 0, true);
    metricsPage.clickKebabDropdown(1);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    metricsPage.clickKebabDropdown(1);

    cy.log('6.14 Kebab icon - Delete query');
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DELETE_QUERY).should('be.visible').click();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.get(Classes.MetricsPageUnselectedAllButton).should('have.length', 1);

    cy.log('6.15 Kebab icon - Duplicate query');
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DUPLICATE_QUERY).should('be.visible').click();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.byAriaLabel('toggle menu').should('have.length', 2);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    cy.byAriaLabel('Enable query').eq(0).should('not.have.attr', 'checked');
    cy.get(Classes.MetricsPageUnselectedAllButton).should('have.length', 1);
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('have.attr', 'aria-disabled', 'true');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('not.exist');

  });

  it(`${perspective.name} perspective - Metrics > Predefined Queries > Export as CSV`, () => {
    //OCPBUGS-54316 - [4.16] Metrics "Export as CSV" is not working for all queries 
    cy.log('7.1 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.CPU_USAGE);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.CPU_USAGE);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.2 Predefined Queries'); 
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.MEMORY_USAGE);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.MEMORY_USAGE);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.3 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.FILESYSTEM_USAGE);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.FILESYSTEM_USAGE);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.4 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RECEIVE_BANDWIDTH);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.RECEIVE_BANDWIDTH);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.5 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.TRANSMIT_BANDWIDTH);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.TRANSMIT_BANDWIDTH);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.6 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_RECEIVED_PACKETS);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.RATE_OF_RECEIVED_PACKETS);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.7 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_TRANSMITTED_PACKETS);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.RATE_OF_TRANSMITTED_PACKETS);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.8 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_RECEIVED_PACKETS_DROPPED);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.RATE_OF_RECEIVED_PACKETS_DROPPED);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.9 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_TRANSMITTED_PACKETS_DROPPED);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInput.RATE_OF_TRANSMITTED_PACKETS_DROPPED);
    metricsPage.clickActionsDeleteAllQueries();

  });

  it(`${perspective.name} perspective - Metrics > Ungraphable results`, () => {
    cy.log('8.1 Ungraphable results');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.CPU_USAGE);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.MEMORY_USAGE);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.FILESYSTEM_USAGE);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RECEIVE_BANDWIDTH);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.TRANSMIT_BANDWIDTH);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_RECEIVED_PACKETS);
    cy.bySemanticElement('h1', 'Metrics').scrollIntoView(); 
    
    cy.get(Classes.MetricsPageUngraphableResults).contains(MetricGraphEmptyState.UNGRAPHABLE_RESULTS).should('be.visible');
    cy.get(Classes.MetricsPageUngraphableResultsDescription).contains(MetricGraphEmptyState.UNGRAPHABLE_RESULTS_DESCRIPTION).should('be.visible');
    
  });

  it(`${perspective.name} perspective - Metrics > No Datapoints`, () => {
    cy.log('9.1 No Datapoints');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.enterQueryInput(0, 'aaaaaaaaaa');
    metricsPage.clickRunQueriesButton();
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).scrollIntoView().contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    cy.get(Classes.MetricsPageNoDatapointsFoundTableMessage).contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');

    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.enterQueryInput(0, 'a');
    cy.get(Classes.MetricsPageQueryAutocomplete).should('be.visible');
    cy.get(Classes.MetricsPageQueryAutocomplete).should('contain', 'abs');
    
  });

  it(`${perspective.name} perspective - Metrics > No Datapoints with alert`, () => {
    cy.log('10.1 No Datapoints with alert');
    metricsPage.enterQueryInput(0, MetricsPageQueryInput.QUERY_WITH_ALERT);
    metricsPage.clickRunQueriesButton();
    cy.byOUIAID(DataTestIDs.MetricsGraphAlertDanger).should('be.visible');
  });
   
}

