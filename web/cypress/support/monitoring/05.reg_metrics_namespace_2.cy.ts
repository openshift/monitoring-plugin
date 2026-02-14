import { metricsPage } from '../../views/metrics';
import { Classes, DataTestIDs } from '../../../src/components/data-test';
import { MetricsPageUnits, GraphTimespan, MetricsPagePredefinedQueries, MetricsPageQueryInput, MetricsPageQueryKebabDropdown, MetricsPageQueryInputByNamespace } from '../../fixtures/monitoring/constants';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runAllRegressionMetricsTestsNamespace2(perspective: PerspectiveConfig) {
  testMetricsRegressionNamespace2(perspective);
}

export function testMetricsRegressionNamespace2(perspective: PerspectiveConfig) {

  it(`${perspective.name} perspective - Metrics > Add Query - Run Queries - Kebab icon`, () => {
    cy.log('6.1 Preparation to test Add Query button');
    metricsPage.shouldBeLoaded();
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 1);
    metricsPage.clickInsertExampleQuery();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);

    cy.log('6.2 Only one query added, resulting in 2 rows');
    metricsPage.clickActionsAddQuery();
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 2);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(1).should('have.attr', 'aria-expanded', 'true');
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);
 
    cy.log('6.3 Preparation to test Run Queries button');
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('be.visible').clear();
    cy.get(Classes.MetricsPageQueryInput).eq(0).type(MetricsPageQueryInput.VECTOR_QUERY);
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).should('have.length', 1);

    cy.log('6.4 Run Queries button');
    metricsPage.clickRunQueriesButton();
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).should('have.length', 2);

    cy.log('6.5 Preparation to test Kebab icon - Disable query');
    metricsPage.disableEnableQuerySwitchAssertion(0, true);
    metricsPage.disableEnableQuerySwitchAssertion(1, true);
    metricsPage.expandCollapseRowAssertion(true, 0, true, true);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    
    cy.log('6.6 Kebab icon - Disable query');
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible').click();
    metricsPage.disableEnableQuerySwitchAssertion(0, false);
    metricsPage.disableEnableQuerySwitchAssertion(1, true);
    metricsPage.expandCollapseRowAssertion(false, 0, true, true);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.VECTOR_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);
    cy.byTestID(DataTestIDs.MetricGraph).scrollIntoView().should('be.visible');
    metricsPage.clickKebabDropdown(0);
    cy.get(Classes.MenuItemDisabled).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).should('not.exist');

    cy.log('6.7 Kebab icon - Enable query');
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.ENABLE_QUERY).should('be.visible').click();
    metricsPage.disableEnableQuerySwitchAssertion(0, true);
    metricsPage.disableEnableQuerySwitchAssertion(1, true);
    metricsPage.expandCollapseRowAssertion(true, 0, true, true);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.VECTOR_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);
    cy.byTestID(DataTestIDs.MetricGraph).scrollIntoView().should('be.visible');
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible');
    metricsPage.clickKebabDropdown(0);

    cy.log('6.8 Switch - Disable query for both queries');
    metricsPage.clickDisableEnableQuerySwitch(0);
    metricsPage.clickDisableEnableQuerySwitch(1);
    metricsPage.disableEnableQuerySwitchAssertion(0, false);
    metricsPage.disableEnableQuerySwitchAssertion(1, false);
    metricsPage.expandCollapseRowAssertion(false, 0, true, true);
    metricsPage.expandCollapseRowAssertion(false, 1, true, true);
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.ENABLE_QUERY).should('be.visible');
    cy.get(Classes.MenuItemDisabled).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('have.attr', 'aria-disabled', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).should('not.exist');
    metricsPage.clickKebabDropdown(0);

    metricsPage.clickKebabDropdown(1);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.ENABLE_QUERY).should('be.visible');
    cy.get(Classes.MenuItemDisabled).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('have.attr', 'aria-disabled', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).should('not.exist');
    metricsPage.clickKebabDropdown(1);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.VECTOR_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('be.visible');
    
    cy.log('6.9 Switch - Enable query for both queries');
    metricsPage.clickDisableEnableQuerySwitch(0);
    metricsPage.clickDisableEnableQuerySwitch(1);
    metricsPage.disableEnableQuerySwitchAssertion(0, true);
    metricsPage.disableEnableQuerySwitchAssertion(1, true);
    metricsPage.expandCollapseRowAssertion(true, 0, true, true);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible');
    metricsPage.clickKebabDropdown(0);

    metricsPage.clickKebabDropdown(1);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible');
    metricsPage.clickKebabDropdown(1);
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.VECTOR_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);
    cy.byTestID(DataTestIDs.MetricGraph).scrollIntoView().should('be.visible');

    cy.log('6.10 Kebab icon - Hide all series');
    metricsPage.clickKebabDropdown(1);
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible').click();
    cy.get(Classes.MetricsPageExpandedRowIcon).eq(1).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').then(($seriesButtons) => {
      const seriesButtonsCount: number = Cypress.$($seriesButtons).length;
      for (let i = 0; i < seriesButtonsCount; i++) {
        metricsPage.seriesButtonAssertion(1, i, false);
      }
    });
    metricsPage.selectAllUnselectAllButtonAssertion(1, false);

    cy.log('6.11 Kebab icon - Show all series');
    metricsPage.clickKebabDropdown(1);
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.SHOW_ALL_SERIES).should('be.visible').click();
    cy.get(Classes.MetricsPageExpandedRowIcon).eq(1).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').then(($seriesButtons) => {
      const seriesButtonsCount: number = Cypress.$($seriesButtons).length;
      for (let i = 0; i < seriesButtonsCount; i++) {
        metricsPage.seriesButtonAssertion(1, i, true);
      }
    });
    metricsPage.clickKebabDropdown(1);
    metricsPage.selectAllUnselectAllButtonAssertion(1, true);

    cy.log('6.12 Hide serie - index 1 - manually');
    metricsPage.clickSeriesButton(1, 0, false);
    metricsPage.seriesButtonAssertion(1, 0, false);
    metricsPage.selectAllUnselectAllButtonAssertion(1, false);
    metricsPage.clickKebabDropdown(1);
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.SHOW_ALL_SERIES).should('be.visible');
    metricsPage.clickKebabDropdown(1);

    cy.log('6.13 Select serie - index 1 - manually');
    metricsPage.clickSeriesButton(1, 0, true);
    metricsPage.seriesButtonAssertion(1, 0, true);
    metricsPage.selectAllUnselectAllButtonAssertion(1, true);
    metricsPage.clickKebabDropdown(1);
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    metricsPage.clickKebabDropdown(1);

    cy.log('6.14 Unselect all - index 1 - manually');
    metricsPage.clickSelectAllUnselectAllButton(1, true);
    metricsPage.selectAllUnselectAllButtonAssertion(1, false);
    cy.get(Classes.MetricsPageExpandedRowIcon).eq(1).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').then(($seriesButtons) => {
      const seriesButtonsCount: number = Cypress.$($seriesButtons).length;
      for (let i = 0; i < seriesButtonsCount; i++) {
        metricsPage.seriesButtonAssertion(1, i, false);
      }
    });
    metricsPage.clickKebabDropdown(1);
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.SHOW_ALL_SERIES).should('be.visible');
    metricsPage.clickKebabDropdown(1);

    cy.log('6.15 Select all - index 1 - manually');
    metricsPage.clickSelectAllUnselectAllButton(1, false);
    metricsPage.selectAllUnselectAllButtonAssertion(1, true);
    cy.get(Classes.MetricsPageExpandedRowIcon).eq(1).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').then(($seriesButtons) => {
      const seriesButtonsCount: number = Cypress.$($seriesButtons).length;
      for (let i = 0; i < seriesButtonsCount; i++) {
        metricsPage.seriesButtonAssertion(1, i, true);
      }
    });
    metricsPage.clickKebabDropdown(1);
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    metricsPage.clickKebabDropdown(1);

    cy.log('6.16 Kebab icon - Delete query');
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageDeleteQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DELETE_QUERY).should('be.visible').click();
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 1);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).should('have.length', 1);

    cy.log('6.17 Kebab icon - Duplicate query');
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageDuplicateQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DUPLICATE_QUERY).should('be.visible').click();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY_NAMESPACE);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 2);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(0).should('not.have.attr', 'checked');
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).should('have.length', 1);
    metricsPage.clickKebabDropdown(0);
    cy.get(Classes.MenuItemDisabled).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('have.attr', 'aria-disabled', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).should('not.exist');
  });

  it(`${perspective.name} perspective - Metrics > Predefined Queries > Export as CSV`, () => {
    //OCPBUGS-54316 - [4.16] Metrics "Export as CSV" is not working for all queries 
    cy.log('7.1 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.CPU_USAGE);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.CPU_USAGE);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.2 Predefined Queries'); 
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.MEMORY_USAGE);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.MEMORY_USAGE);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.3 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.FILESYSTEM_USAGE);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.FILESYSTEM_USAGE);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.4 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RECEIVE_BANDWIDTH);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.RECEIVE_BANDWIDTH);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.5 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.TRANSMIT_BANDWIDTH);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.TRANSMIT_BANDWIDTH);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.6 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_RECEIVED_PACKETS);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.RATE_OF_RECEIVED_PACKETS);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.7 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_TRANSMITTED_PACKETS);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.RATE_OF_TRANSMITTED_PACKETS);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.8 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_RECEIVED_PACKETS_DROPPED);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.RATE_OF_RECEIVED_PACKETS_DROPPED);
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('7.9 Predefined Queries');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_TRANSMITTED_PACKETS_DROPPED);
    metricsPage.clickKebabDropdown(0);
    metricsPage.exportAsCSV(true, MetricsPageQueryInputByNamespace.RATE_OF_TRANSMITTED_PACKETS_DROPPED);
    metricsPage.clickActionsDeleteAllQueries();

  });

  it(`${perspective.name} perspective - Metrics > No Datapoints`, () => {
    cy.log('9.1 No Datapoints');
    metricsPage.enterQueryInput(0, 'aaaaaaaaaa');
    metricsPage.clickRunQueriesButton();
    metricsPage.noDatapointsFound();

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

  it(`${perspective.name} perspective - Metrics > Empty state`, () => {
    cy.log('11.1 Insert example query - Empty state');
    cy.changeNamespace("default");
    metricsPage.clickInsertExampleQuery();
    metricsPage.noDatapointsFound();

    cy.log('11.2 Query - Empty state');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_TRANSMITTED_PACKETS_DROPPED);
    metricsPage.noDatapointsFound();

  });
   
}
