import { nav } from '../../../views/nav';
import { metricsPage } from '../../../views/metrics';
import { Classes, DataTestIDs, IDs } from '../../../../src/components/data-test';
import { GraphTimespan, MetricsPagePredefinedQueries, MetricsPageQueryInput } from '../../../fixtures/monitoring/constants';
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
    metricsPage.expandCollapseRowAssertion(true, 1, false);

    cy.log('2.4 Actions > Collapse all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(false);

    cy.log('2.5 All queries collapsed');
    metricsPage.expandCollapseAllQueryAssertion(false);
    metricsPage.expandCollapseRowAssertion(false, 0, false);
    metricsPage.expandCollapseRowAssertion(false, 1, false);

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
    metricsPage.expandCollapseRowAssertion(true, 0, false);
    metricsPage.expandCollapseRowAssertion(true, 1, true);

    cy.log('3.5 Actions > Collapse all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(false);

    cy.log('3.6 All queries collapsed');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'false');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(1).should('have.attr', 'aria-expanded', 'false');

    cy.log('3.6.1 Assert 2 rows - Empty state');
    metricsPage.expandCollapseAllQueryAssertion(false);
    metricsPage.expandCollapseRowAssertion(false, 0, false);
    metricsPage.expandCollapseRowAssertion(false, 1, true);

    cy.log('3.7 Actions > Expand all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(true);

    cy.log('3.8 All queries expanded');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(0).should('have.attr', 'aria-expanded', 'true');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).find('button').eq(1).should('have.attr', 'aria-expanded', 'true');

    cy.log('3.8.1 Assert 2 rows');
    metricsPage.expandCollapseAllQueryAssertion(true);
    metricsPage.expandCollapseRowAssertion(true, 0, false);
    metricsPage.expandCollapseRowAssertion(true, 1, true);

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
    metricsPage.graphAxisAssertion(GraphTimespan.THIRTY_MINUTES);

    cy.log('4.2 Graph Timespan Dropdown');
    metricsPage.graphTimespanDropdownAssertion();

    cy.log('4.3 Select and Assert each timespan');
    Object.values(GraphTimespan).forEach((timespan) => {
      metricsPage.clickGraphTimespanDropdown(timespan);
      metricsPage.graphAxisAssertion(timespan);
    });

    cy.log('4.4 Enter Graph Timespan');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.clickInsertExampleQuery();
    Object.values(GraphTimespan).forEach((timespan) => {
      metricsPage.enterGraphTimespan(timespan);
      metricsPage.graphAxisAssertion(timespan);
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
    cy.get(Classes.GraphCard).should('not.exist');

    cy.log('4.8 Show Graph Button');
    metricsPage.clickShowGraphButton();
    cy.get(Classes.GraphCard).should('be.visible');

    cy.log('4.9 Stacked Checkbox');
    cy.byTestID(DataTestIDs.MetricStackedCheckbox).should('not.exist');

    cy.log('4.10 Disconnected Checkbox');
    metricsPage.clickDisconnectedCheckbox();
    cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('have.attr', 'data-checked-state', 'true');

    cy.log('4.11 Prepare to test Stacked Checkbox');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.clickInsertExampleQuery();
    cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('have.attr', 'disabled');

    cy.log('4.12 Stacked Checkbox');
    metricsPage.clickStackedCheckboxAndAssert();

  });

});




/** TODO
//https://issues.redhat.com/browse/OU-974 - [Metrics] - Units - undefined showing in Y axis and tooltip


it('5. Admin perspective - Metrics > Add Query - Run Queries - Kebab icon', () => {
   cy.log('1.1 Visual Assertions');
   nav.sidenav.clickNavLink(['Observe', 'Metrics']);
   commonPages.titleShouldHaveText('Metrics');

 });

 it('6. Admin perspective - Metrics > Predefined Queries > Export as CSV', () => {
   //OCPBUGS-54316 - [4.16] Metrics "Export as CSV" is not working for all queries 
   cy.log('1.1 Visual Assertions');
   nav.sidenav.clickNavLink(['Observe', 'Metrics']);
   commonPages.titleShouldHaveText('Metrics');

 });
 */
