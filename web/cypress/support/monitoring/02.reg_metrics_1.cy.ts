import { metricsPage } from '../../views/metrics';
import { Classes, DataTestIDs } from '../../../src/components/data-test';
import { GraphTimespan, MetricsPagePredefinedQueries, MetricsPageQueryInput, MetricsPageUnits } from '../../fixtures/monitoring/constants';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runAllRegressionMetricsTests1(perspective: PerspectiveConfig) {
  testMetricsRegression1(perspective);
}

export function testMetricsRegression1(perspective: PerspectiveConfig) {

  it(`${perspective.name} perspective - Metrics`, () => {
    cy.log('1.1 Metrics page loaded');
    metricsPage.shouldBeLoaded();

    cy.log('1.2 Refresh interval dropdown');
    metricsPage.refreshIntervalDropdownAssertion();

    cy.log('1.3 Actions dropdown');
    metricsPage.actionsDropdownAssertion();

    cy.log('1.4 Predefined queries');
    metricsPage.predefinedQueriesAssertion();

    cy.log('1.5 Kebab dropdown');
    metricsPage.kebabDropdownAssertionWithoutQuery();

  });

  it(`${perspective.name} perspective - Metrics > Actions - No query added`, () => {
    cy.log('2.1 Only one query loaded');
    cy.byAriaLabel('Hide table').should('have.length', 1);

    cy.log('2.2 Actions >Add query');
    metricsPage.clickActionsAddQuery();

    cy.log('2.3 Only one query added, resulting in 2 rows');
    cy.byAriaLabel('Hide table').should('have.length', 2);

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
    cy.byAriaLabel('Hide table').should('have.length', 1);
  });

  it(`${perspective.name} perspective - Metrics > Actions - One query added`, () => {
    cy.log('3.1 Only one query loaded');
    metricsPage.clickPredefinedQuery(MetricsPagePredefinedQueries.FILESYSTEM_USAGE);
    metricsPage.shouldBeLoadedWithGraph();

    cy.log('3.2 Kebab dropdown');
    metricsPage.kebabDropdownAssertionWithQuery();

    cy.log('3.3 Actions >Add query');
    metricsPage.clickActionsAddQuery();

    cy.log('3.4 Only one query added, resulting in 2 rows');
    cy.byAriaLabel('Hide table').should('have.length', 2);

    cy.log('3.4.1 Assert 2 rows');
    metricsPage.expandCollapseAllQueryAssertion(true);
    metricsPage.expandCollapseRowAssertion(true, 0, false, false);
    metricsPage.expandCollapseRowAssertion(true, 1, true, false);

    cy.log('3.5 Actions > Collapse all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(false);

    cy.log('3.6 All queries collapsed');
    cy.byAriaLabel('Show table').should('have.length', 2);

    cy.log('3.6.1 Assert 2 rows - Empty state');
    metricsPage.expandCollapseAllQueryAssertion(false);
    metricsPage.expandCollapseRowAssertion(false, 0, false, false);
    metricsPage.expandCollapseRowAssertion(false, 1, true, false);

    cy.log('3.7 Actions > Expand all query tables');
    metricsPage.clickActionsExpandCollapseAllQuery(true);

    cy.log('3.8 All queries expanded');
    cy.byAriaLabel('Hide table').should('have.length', 2);

    cy.log('3.8.1 Assert 2 rows');
    metricsPage.expandCollapseAllQueryAssertion(true);
    metricsPage.expandCollapseRowAssertion(true, 0, false, false);
    metricsPage.expandCollapseRowAssertion(true, 1, true, false);

    cy.log('3.9 Actions > Delete all queries');
    metricsPage.clickActionsDeleteAllQueries();

    cy.log('3.10 Only one query deleted, resulting in 1 row');
    cy.byAriaLabel('Hide table').should('have.length', 1);
    metricsPage.shouldBeLoaded();

  });

  it(`${perspective.name} perspective - Metrics > Insert Example Query`, () => {
    cy.log('4.1 Insert Example Query');
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
    metricsPage.clickGraphTimespanDropdown(GraphTimespan.ONE_WEEK);

    cy.log('4.6 Reset Zoom Button');
    metricsPage.clickResetZoomButton();
    cy.get('input[aria-label="graph timespan"]').should('have.attr', 'value', GraphTimespan.THIRTY_MINUTES);

    cy.log('4.7 Hide Graph Button');
    metricsPage.clickHideGraphButton();
    cy.get('.pf-c-chart').should('not.exist');

    cy.log('4.8 Show Graph Button');
    metricsPage.clickShowGraphButton();
    cy.get('.pf-c-chart').should('be.visible');

    cy.log('4.9 Disconnected Checkbox');
    cy.get('#'+ 'disconnected').should('be.visible');

    cy.log('4.10 Prepare to test Stacked Checkbox');
    metricsPage.clickActionsDeleteAllQueries();
    metricsPage.clickInsertExampleQuery();

    cy.log('4.11 Stacked Checkbox');
    metricsPage.clickStackedCheckboxAndAssert();

  });
  
}

