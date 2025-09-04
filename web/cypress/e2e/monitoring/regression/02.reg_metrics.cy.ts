import { nav } from '../../../views/nav';
import { metricsPage } from '../../../views/metrics';
import { Classes, DataTestIDs, IDs } from '../../../../src/components/data-test';
import { GraphTimespan, MetricGraphEmptyState, MetricsPagePredefinedQueries, MetricsPageQueryInput, MetricsPageQueryKebabDropdown, MetricsPageUnits } from '../../../fixtures/monitoring/constants';
import common = require('mocha/lib/interfaces/common');
// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Monitoring - Metrics', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  after(() => {
    cy.afterBlock(MP);
  });

  it('1. Admin perspective - Metrics', () => {
    cy.log('1.1 Metrics page loaded');
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    metricsPage.shouldBeLoaded();

    cy.log('1.2 Units dropdown');
    metricsPage.unitsDropdownAssertion();

    cy.log('1.3 Refresh interval dropdown');
    metricsPage.refreshIntervalDropdownAssertion();

    cy.log('1.4 Actions dropdown');
    metricsPage.actionsDropdownAssertion();

    cy.log('1.5 Predefined queries');
    metricsPage.predefinedQueriesAssertion();

    cy.log('1.6 Kebab dropdown');
    metricsPage.kebabDropdownAssertionWithoutQuery();

  });

  it('2. Admin perspective - Metrics > Actions - No query added', () => {
    cy.log('2.1 Only one query loaded');
    cy.visit('/monitoring/query-browser');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 1);

    cy.log('2.2 Actions >Add query');
    metricsPage.clickActionsAddQuery();

    cy.log('2.3 Only one query added, resulting in 2 rows');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 2);

    cy.log('2.3.1 Assert 2 rows - Empty state');
    metricsPage.addQueryAssertion();
    metricsPage.expandCollapseAllQueryAssertion(true);
    metricsPage.expandCollapseRowAssertion(true, 1, false, false);

    cy.log('2.4 Actions > Collapse all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(false);

    cy.log('2.5 All queries collapsed');
    metricsPage.expandCollapseAllQueryAssertion(false);
    metricsPage.expandCollapseRowAssertion(false, 0, false, false);
    metricsPage.expandCollapseRowAssertion(false, 1, false, false);

    cy.log('2.6 Actions > Expand all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(true);

    cy.log('2.7 All queries expanded');
    metricsPage.expandCollapseAllQueryAssertion(true);
    metricsPage.shouldBeLoaded();

    cy.log('2.8 Actions > Delete all queries');
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('2.9 Only one query deleted, resulting in 1 row');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 1);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');

  });

  it('3. Admin perspective - Metrics > Actions - One query added', () => {
    cy.log('3.1 Only one query loaded');
    cy.visit('/monitoring/query-browser');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.FILESYSTEM_USAGE);
    metricsPage.shouldBeLoadedWithGraph();

    cy.log('3.2 Kebab dropdown');
    metricsPage.kebabDropdownAssertionWithQuery();

    cy.log('3.3 Actions >Add query');
    metricsPage.clickActionsAddQuery();

    cy.log('3.4 Only one query added, resulting in 2 rows');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 2);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(1).should('have.attr', 'aria-expanded', 'true');

    cy.log('3.4.1 Assert 2 rows');
    metricsPage.expandCollapseAllQueryAssertion(true);
    metricsPage.expandCollapseRowAssertion(true, 0, false, false);
    metricsPage.expandCollapseRowAssertion(true, 1, true, false);

    cy.log('3.5 Actions > Collapse all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(false);

    cy.log('3.6 All queries collapsed');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'false');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(1).should('have.attr', 'aria-expanded', 'false');

    cy.log('3.6.1 Assert 2 rows - Empty state');
    metricsPage.expandCollapseAllQueryAssertion(false);
    metricsPage.expandCollapseRowAssertion(false, 0, false, false);
    metricsPage.expandCollapseRowAssertion(false, 1, true, false);

    cy.log('3.7 Actions > Expand all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(true);

    cy.log('3.8 All queries expanded');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(1).should('have.attr', 'aria-expanded', 'true');

    cy.log('3.8.1 Assert 2 rows');
    metricsPage.expandCollapseAllQueryAssertion(true);
    metricsPage.expandCollapseRowAssertion(true, 0, false, false);
    metricsPage.expandCollapseRowAssertion(true, 1, true, false);

    cy.log('3.9 Actions > Delete all queries');
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('3.10 Only one query deleted, resulting in 1 row');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 1);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    metricsPage.shouldBeLoaded();

  });

  it('4. Admin perspective - Metrics > Insert Example Query', () => {
    cy.log('4.1 Insert Example Query');
    cy.visit('/monitoring/query-browser');
    metricsPage.clickInsertExampleQuery();
    metricsPage.shouldBeLoadedWithGraph();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    metricsPage.graphAxisXAssertion(GraphTimespan.THIRTY_MINUTES);

    cy.log('4.2 Graph Timespan Dropdown');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.enterQueryInput(0, MetricsPageQueryInput.VECTOR_QUERY);
    metricsPage.clickRunQueriesButton();
    metricsPage.graphTimespanDropdownAssertion();

    cy.log('4.3 Select and Assert each timespan');
    Object.values(GraphTimespan).forEach((timespan) => {
      metricsPage.clickGraphTimespanDropdown(timespan);
      metricsPage.graphAxisXAssertion(timespan);
    });

    cy.log('4.4 Enter Graph Timespan');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.enterQueryInput(0, MetricsPageQueryInput.VECTOR_QUERY);
    metricsPage.clickRunQueriesButton();
    Object.values(GraphTimespan).forEach((timespan) => {
      metricsPage.enterGraphTimespan(timespan);
      metricsPage.graphAxisXAssertion(timespan);
    });

    cy.log('4.5 Prepare to test Reset Zoom Button');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.CPU_USAGE);
    metricsPage.graphCardInlineInfoAssertion(true);
    metricsPage.clickGraphTimespanDropdown(GraphTimespan.ONE_WEEK);
    metricsPage.graphCardInlineInfoAssertion(false);

    cy.log('4.6 Reset Zoom Button');
    metricsPage.clickResetZoomButton();
    metricsPage.graphCardInlineInfoAssertion(true);

    cy.log('4.7 Hide Graph Button');
    metricsPage.clickHideGraphButton();
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');

    cy.log('4.8 Show Graph Button');
    metricsPage.clickShowGraphButton();
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');

    cy.log('4.9 Stacked Checkbox');
    cy.byTestID(DataTestIDs.MetricStackedCheckbox).should('not.exist');

    cy.log('4.10 Disconnected Checkbox');
    cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('be.visible');

    cy.log('4.11 Prepare to test Stacked Checkbox');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.clickInsertExampleQuery();

    cy.log('4.12 Stacked Checkbox');
    metricsPage.clickStackedCheckboxAndAssert();

  });

  /**
   * TODO: uncomment when this bug gets fixed   
   * https://issues.redhat.com/browse/OU-974 - [Metrics] - Units - undefined showing in Y axis and tooltip
  it('5. Admin perspective - Metrics > Units', () => {
    cy.log('5.1 Preparation to test Units dropdown');
    cy.visit('/monitoring/query-browser');
    metricsPage.clickInsertExampleQuery();
    metricsPage.unitsDropdownAssertion();

    cy.log('5.2 Units dropdown');
    Object.values(MetricsPageUnits).forEach((unit) => {
      metricsPage.clickUnitsDropdown(unit);
      metricsPage.unitsAxisYAssertion(unit);
    });
  });
  */

  it('6. Admin perspective - Metrics > Add Query - Run Queries - Kebab icon', () => {
    cy.log('6.1 Preparation to test Add Query button');
    cy.visit('/monitoring/query-browser');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 1);
    metricsPage.clickInsertExampleQuery();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);

    cy.log('6.2 Only one query added, resulting in 2 rows');
    metricsPage.clickActionsAddQuery();
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 2);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(1).should('have.attr', 'aria-expanded', 'true');
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
 
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
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
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
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
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
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
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
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
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
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).should('have.length', 1);

    cy.log('6.17 Kebab icon - Duplicate query');
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageDuplicateQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DUPLICATE_QUERY).should('be.visible').click();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.get(Classes.MetricsPageQueryInput).eq(1).should('contain', MetricsPageQueryInput.INSERT_EXAMPLE_QUERY);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).should('have.length', 2);
    metricsPage.expandCollapseRowAssertion(true, 1, true, true);
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(0).should('not.have.attr', 'checked');
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).should('have.length', 1);
    metricsPage.clickKebabDropdown(0);
    cy.get(Classes.MenuItemDisabled).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('have.attr', 'aria-disabled', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).should('not.exist');

  });

  it('7. Admin perspective - Metrics > Predefined Queries > Export as CSV', () => {
    //OCPBUGS-54316 - [4.16] Metrics "Export as CSV" is not working for all queries 
    cy.log('7.1 Predefined Queries');
    cy.visit('/monitoring/query-browser');
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

  it('8. Admin perspective - Metrics > Ungraphable results', () => {
    cy.log('8.1 Ungraphable results');
    cy.visit('/monitoring/query-browser');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.CPU_USAGE);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.MEMORY_USAGE);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.FILESYSTEM_USAGE);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RECEIVE_BANDWIDTH);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.TRANSMIT_BANDWIDTH);
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.RATE_OF_RECEIVED_PACKETS);
    cy.get(Classes.MetricsPageUngraphableResults).scrollIntoView().contains(MetricGraphEmptyState.UNGRAPHABLE_RESULTS).should('be.visible');
    cy.get(Classes.MetricsPageUngraphableResultsDescription).scrollIntoView().contains(MetricGraphEmptyState.UNGRAPHABLE_RESULTS_DESCRIPTION).should('be.visible');
    
  });

  it('9. Admin perspective - Metrics > No Datapoints', () => {
    cy.log('9.1 No Datapoints');
    cy.visit('/monitoring/query-browser');
    metricsPage.enterQueryInput(0, 'aaaaaaaaaa');
    metricsPage.clickRunQueriesButton();
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).scrollIntoView().contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageYellowNoDatapointsFound).scrollIntoView().contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');

    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.enterQueryInput(0, 'a');
    cy.get(Classes.MetricsPageQueryAutocomplete).should('be.visible');
    cy.get(Classes.MetricsPageQueryAutocomplete).should('contain', 'abs');
    
  });

  it('10. Admin perspective - Metrics > No Datapoints with alert', () => {
    cy.log('10.1 No Datapoints with alert');
    cy.visit('/monitoring/query-browser');
    metricsPage.enterQueryInput(0, MetricsPageQueryInput.QUERY_WITH_ALERT);
    metricsPage.clickRunQueriesButton();
    cy.byOUIAID(DataTestIDs.MetricsGraphAlertDanger).should('be.visible');
  });
   
});

