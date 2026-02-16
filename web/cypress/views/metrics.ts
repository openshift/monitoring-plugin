import { commonPages } from "./common";
import { DataTestIDs, Classes, IDs } from "../../src/components/data-test";
import { MetricsPageUnits, MonitoringRefreshInterval, MetricsPageQueryInput, MetricsPageActions, MetricGraphEmptyState, MetricsPagePredefinedQueries, MetricsPageQueryKebabDropdown, GraphTimespan } from "../fixtures/monitoring/constants";

export const metricsPage = {

  shouldBeLoaded: () => {
    cy.log('metricsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText('Metrics');
    cy.get('h1').find('button').eq(0).contains(MonitoringRefreshInterval.THIRTY_SECONDS).should('be.visible');
    cy.get('h1').find('button').eq(1).contains('Actions').should('be.visible');
    cy.bySemanticElement('button').contains('Hide graph').should('be.visible');
    cy.bySemanticElement('button').contains('Insert example query').should('be.visible');
    cy.byAriaLabel('Select query').should('be.visible');
    cy.bySemanticElement('button').contains('Add query').should('be.visible');
    cy.bySemanticElement('button').contains('Run queries').should('be.visible');
    cy.byAriaLabel('Hide table').should('be.visible');

    // cy.byTestID(DataTestIDs.MetricHideShowGraphButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraph).should('not.exist'); 
    // cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('be.visible');
    // cy.byTestID(DataTestIDs.TypeaheadSelectInput).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageAddQueryButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageRunQueriesButton).should('be.visible');
    // metricsPage.expandCollapseRowAssertion(true, 0, false, false);
  },

  redirectedToMetricsPageWithDatapoints: () => {
    cy.log('metricsPage.redirectedToMetricsPage');
    commonPages.titleShouldHaveText('Metrics');

    cy.get('h1').find('button').eq(0).contains(MonitoringRefreshInterval.THIRTY_SECONDS).should('be.visible');
    cy.get('h1').find('button').eq(1).contains('Actions').should('be.visible');
    cy.bySemanticElement('button').contains('Hide graph').should('be.visible');
    cy.get('button[aria-label="graph timespan"]').should('be.visible');
    cy.get('input[aria-label="graph timespan"]').should('be.visible');
    cy.bySemanticElement('button').contains('Reset zoom').should('be.visible');
    cy.get('#'+ 'disconnected').should('be.visible');
    cy.byAriaLabel('Select query').should('be.visible');
    cy.bySemanticElement('button').contains('Add query').should('be.visible');
    cy.bySemanticElement('button').contains('Run queries').should('be.visible');
    cy.byAriaLabel('Hide table').eq(0).should('be.visible');
    cy.byAriaLabel('Expression (press Shift+Enter for newlines)').eq(0).should('be.visible');
    cy.byAriaLabel('Disable query').eq(0).should('have.attr', 'checked');
    cy.byLegacyTestID('kebab-button').eq(0).should('be.visible');
    cy.byAriaLabel('query results table').eq(0).should('be.visible');
    cy.bySemanticElement('button').contains('Unselect all').eq(0).should('be.visible');
    cy.byAriaLabel('Show series').eq(0).should('be.visible');

    // cy.byTestID(DataTestIDs.MetricGraphUnitsDropDown).contains(MetricsPageUnits.NO_UNITS).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricDropdownPollInterval).contains(MonitoringRefreshInterval.REFRESH_OFF).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricHideShowGraphButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraphTimespanInput).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricResetZoomButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('be.visible');
    // cy.byTestID(DataTestIDs.TypeaheadSelectInput).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageAddQueryButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageRunQueriesButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).eq(0).should('be.visible');
    // cy.get(Classes.MetricsPageExpandedRowIcon).eq(0).should('be.visible');
    // cy.get(Classes.MetricsPageQueryInput).eq(0).should('not.have.text', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    // cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(0).should('have.attr', 'checked');
    // cy.byTestID(DataTestIDs.KebabDropdownButton).eq(0).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraph).should('be.visible'); 
    // cy.byTestID(DataTestIDs.MetricsPageQueryTable).eq(0).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).eq(0).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageSeriesButton).eq(0).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('not.exist');
  },

  redirectedToMetricsPageWithoutDatapoints: () => {
    cy.log('metricsPage.redirectedToMetricsPageWithoutDatapoints');
    commonPages.titleShouldHaveText('Metrics');
    
    cy.get('h1').find('button').eq(0).contains(MonitoringRefreshInterval.THIRTY_SECONDS).should('be.visible');
    cy.get('h1').find('button').eq(1).contains('Actions').should('be.visible');
    cy.bySemanticElement('button').contains('Hide graph').should('be.visible');
    cy.get('button[aria-label="graph timespan"]').should('be.visible');
    cy.get('input[aria-label="graph timespan"]').should('be.visible');
    cy.bySemanticElement('button').contains('Reset zoom').should('be.visible');
    cy.get('#'+ 'disconnected').should('be.visible');
    cy.byAriaLabel('Select query').should('be.visible');
    cy.bySemanticElement('button').contains('Add query').should('be.visible');
    cy.bySemanticElement('button').contains('Run queries').should('be.visible');
    cy.byAriaLabel('Hide table').eq(0).should('be.visible');
    cy.byAriaLabel('Expression (press Shift+Enter for newlines)').eq(0).should('not.have.text', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    cy.byAriaLabel('Disable query').eq(0).should('have.attr', 'checked');
    cy.byLegacyTestID('kebab-button').eq(0).should('be.visible');
    cy.byAriaLabel('query results table').eq(0).should('not.exist');
    cy.bySemanticElement('button').contains('Unselect all').eq(0).should('not.exist');
    cy.byAriaLabel('Show series').eq(0).should('not.exist');
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    cy.get('.query-browser__table-message').contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');


    // cy.byTestID(DataTestIDs.MetricDropdownPollInterval).contains(MonitoringRefreshInterval.REFRESH_OFF).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricHideShowGraphButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraphTimespanInput).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricResetZoomButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricStackedCheckbox).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('be.visible');
    
    // cy.byTestID(DataTestIDs.TypeaheadSelectInput).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageAddQueryButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageRunQueriesButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).eq(0).should('be.visible');
    // cy.get(Classes.MetricsPageExpandedRowIcon).eq(0).should('be.visible');
    // cy.get(Classes.MetricsPageQueryInput).eq(0).should('not.have.text', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    // cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(0).should('have.attr', 'checked');
    // cy.byTestID(DataTestIDs.KebabDropdownButton).eq(0).should('be.visible');
    
    // cy.byTestID(DataTestIDs.MetricsPageYellowNoDatapointsFound).contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageQueryTable).eq(0).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).eq(0).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageSeriesButton).eq(0).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('not.exist');
  },

  clickInsertExampleQuery: () => {
    cy.log('metricsPage.insertExampleQuery');
    cy.bySemanticElement('button').contains('Insert example query').click();
  },

  shouldBeLoadedWithGraph: () => {
    cy.log('metricsPage.shouldBeLoadedWithGraph');
    // cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('not.exist');
    // cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');

    cy.bySemanticElement('button').contains('Hide graph').should('be.visible');
    cy.get('input[aria-label="graph timespan"]').should('be.visible');
    cy.get('button[aria-label="graph timespan"]').should('be.visible');
    cy.bySemanticElement('button').contains('Reset zoom').should('be.visible');
    cy.get('#'+ 'disconnected').should('be.visible');
    
    // cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricGraphTimespanInput).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricResetZoomButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricHideShowGraphButton).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricStackedCheckbox).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('be.visible');
    // metricsPage.expandCollapseRowAssertion(true, 0, true, false);
  },

  clickRefreshIntervalDropdown: (interval: MonitoringRefreshInterval) => {
    cy.log('metricsPage.clickRefreshIntervalDropdown');
    cy.get('h1').find('button').eq(0).should('be.visible').click();
    // cy.byTestID(DataTestIDs.MetricDropdownPollInterval).should('be.visible').click();
    cy.get(Classes.MenuItem).contains(interval).should('be.visible').click();
  },

  refreshIntervalDropdownAssertion: () => {
    cy.log('metricsPage.refreshIntervalDropdownAssertion');
    // cy.byTestID(DataTestIDs.MetricDropdownPollInterval).should('be.visible').click();
    cy.get('h1').find('button').eq(0).should('be.visible').click();

    const intervals = Object.values(MonitoringRefreshInterval);
    intervals.forEach((interval) => {
      cy.log('Refresh interval: ' + interval);
      cy.get(Classes.MenuItem).contains(interval).should('be.visible');
    });

    cy.get(Classes.MenuItem).contains(MonitoringRefreshInterval.FIFTEEN_SECONDS).click();
    cy.get('h1').find('button').eq(0).should('contain', MonitoringRefreshInterval.FIFTEEN_SECONDS);

    cy.get('h1').find('button').eq(0).should('be.visible').click();
    cy.get(Classes.MenuItem).contains(MonitoringRefreshInterval.THIRTY_SECONDS).click();
    cy.get('h1').find('button').eq(0).should('contain', MonitoringRefreshInterval.THIRTY_SECONDS);
  },

  clickAddQueryButton: () => {
    cy.log('metricsPage.clickAddQuery');
    cy.byTestID(DataTestIDs.MetricsPageAddQueryButton).scrollIntoView().click();
    metricsPage.addQueryAssertion();
  },

  clickActions: () => {
    cy.log('metricsPage.clickActions');
    cy.wait(3000);
    cy.get('h1').find('button').eq(1).should('have.attr', 'aria-expanded', 'false').click();
    // cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('have.attr', 'aria-expanded', 'false').click();
  },

  actionsDropdownAssertion: () => {
    cy.log('metricsPage.actionsDropdownAssertion');
    cy.get('h1').find('button').eq(1).should('have.attr', 'aria-expanded', 'false').click();
    cy.byPFRole('menuitem').contains(MetricsPageActions.ADD_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageActions.COLLAPSE_ALL_QUERY_TABLES).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageActions.DELETE_ALL_QUERIES).should('be.visible');
    cy.get('h1').find('button').eq(1).should('be.visible').should('have.attr', 'aria-expanded', 'true').click();
    
    // cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('have.attr', 'aria-expanded', 'false').click();
    // cy.byTestID(DataTestIDs.MetricsPageAddQueryDropdownItem).contains(MetricsPageActions.ADD_QUERY).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageDeleteAllQueriesDropdownItem).contains(MetricsPageActions.DELETE_ALL_QUERIES).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageExpandCollapseAllDropdownItem).contains(MetricsPageActions.COLLAPSE_ALL_QUERY_TABLES).should('be.visible');
    // cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('have.attr', 'aria-expanded', 'true').click();
  },

  clickActionsAddQuery: () => {
    cy.log('metricsPage.clickActionsAddQuery');
    metricsPage.clickActions();
    cy.byPFRole('menuitem').contains(MetricsPageActions.ADD_QUERY).should('be.visible').click();
    // cy.byTestID(DataTestIDs.MetricsPageAddQueryDropdownItem).click();
    metricsPage.addQueryAssertion();
  },

  addQueryAssertion: () => {
    cy.log('metricsPage.addQueryAssertion');
    metricsPage.expandCollapseRowAssertion(true, 0, false, false);
  },

  /**
   * 
   * @param toExpand true: expand all query tables, false: collapse all query tables
   */
  clickActionsExpandCollapseAllQuery: (toExpand: boolean) => {
    cy.log('metricsPage.clickActionsExpandCollapseAllQuery');
    metricsPage.clickActions();
    if (toExpand) {
      cy.byPFRole('menuitem').contains(MetricsPageActions.EXPAND_ALL_QUERY_TABLES).should('be.visible').click();
    } else {
      cy.byPFRole('menuitem').contains(MetricsPageActions.COLLAPSE_ALL_QUERY_TABLES).should('be.visible').click();
    }
  },

  /**
   * 
   * @param expand true: to assert it is expanded, false: to assert it is collapsed
   * @param withQuery if there is any row with query,true: to assert the query table is visible, false: to assert the query table is not visible
   */
  expandCollapseAllQueryAssertion: (expanded: boolean) => {
    cy.log('metricsPage.expandCollapseAllQueryAssertion');
    cy.get('.query-browser__query-controls').then(($rowIcons) => {
      const rowIconsCount = Cypress.$($rowIcons).length;
      for (let i = 0; i < rowIconsCount; i++) {
        if (expanded) {
          cy.get('.query-browser__query-controls').eq(i).should('be.visible');
          cy.byAriaLabel('Disable query').eq(i).should('have.attr', 'checked');
        } else { //collapsed
          cy.get('.query-browser__query-controls').eq(i).should('be.visible');
          cy.byAriaLabel('Disable query').eq(i).should('have.attr', 'checked'); //collapsed does not change switch state when from actions
        }
      }
    })
  },

  /**
   * 
   * @param expand true: to expand the row, false: to collapse the row
   * @param index index of the row to expand or collapse, starting from 0
   */
  expandCollapseRow: (index: number) => {
    cy.log('metricsPage.expandCollapseRow');
    cy.get('.query-browser__query-controls').eq(index).should('be.visible').click()
  },

  /**
   * assertion for expand/collapse All rows from Actions dropdown, not manually
   * @param expanded 
   * @param index 
   * @param withQuery 
   */
  expandCollapseRowAssertion: (expanded: boolean, index: number, withQuery: boolean, withSwitch: boolean) => {
    cy.log('metricsPage.expandCollapseRowAssertion');

    if (withQuery) {
      cy.get(Classes.MetricsPageQueryInput).eq(index).should('not.contain', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    } else {
      cy.get(Classes.MetricsPageQueryInput).eq(index).should('contain', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    }

    if (expanded) {
      if (withQuery) {
        cy.get('.query-browser__query-controls').eq(index).scrollIntoView().should('be.visible');
        cy.get('.query-browser__query-controls').eq(index).find('[aria-label="Disable query"]').should('have.attr', 'checked');
        cy.get('.query-browser__query-controls').eq(index).siblings('.query-browser__table-wrapper').find('[aria-label="query results table"]').should('be.visible');
        cy.get('.query-browser__query-controls').eq(index).siblings('.query-browser__table-wrapper').find('button').eq(0).should('be.visible');
        cy.get('.query-browser__query-controls').eq(index).siblings('.query-browser__table-wrapper').find('[aria-label="Show series"]').should('have.length', 0);
      } else {
        cy.get('.query-browser__query-controls').eq(index).should('be.visible');
        cy.get('.query-browser__query-controls').eq(index).find('[aria-label="Disable query"]').should('have.attr', 'checked');
      }
    } else {
      if (withSwitch){
        cy.get('.query-browser__query-controls').eq(index).find('[aria-label="Enable query"]').should('not.have.attr', 'checked');
      }
      else {
        cy.get('.query-browser__query-controls').eq(index).find('[aria-label="Disable query"]').should('have.attr', 'checked');  
      }
      cy.get('.query-browser__query-controls').eq(index).should('be.visible');
    }
  },

  clickActionsDeleteAllQueries: () => {
    cy.log('metricsPage.clickActionsDeleteAllQueries');
    metricsPage.clickActions();
    cy.byPFRole('menuitem').contains(MetricsPageActions.DELETE_ALL_QUERIES).should('be.visible').click();
    // cy.byTestID(DataTestIDs.MetricsPageDeleteAllQueriesDropdownItem).click();
  },

  deleteAllQueriesAssertion: () => {
    cy.log('metricsPage.deleteAllQueriesAssertion');
    metricsPage.shouldBeLoaded();
  },

  clickGraphTimespanDropdown: (timespan: GraphTimespan) => {
    cy.log('metricsPage.clickGraphTimespanDropdown');
    cy.get('button[aria-label="graph timespan"]').scrollIntoView().should('be.visible').click();
    cy.byPFRole('menuitem').contains(timespan).should('be.visible').click();
    cy.get('.query-browser__loading').scrollIntoView().should('be.visible');
    cy.get('.query-browser__loading').should('not.exist');
  },

  enterGraphTimespan: (timespan: GraphTimespan) => {
    cy.log('metricsPage.enterGraphTimespan');
    cy.get('input[aria-label="graph timespan"]').scrollIntoView().should('be.visible').type('{selectall}{backspace}', {delay: 1000});
    cy.get('input[aria-label="graph timespan"]').type(timespan);
    cy.get('input[aria-label="graph timespan"]').should('have.attr', 'value', timespan);
    cy.get('.query-browser__loading').scrollIntoView().should('be.visible');
    cy.get('.query-browser__loading').should('not.exist');
  },

  graphTimespanDropdownAssertion: () => {
    cy.log('metricsPage.graphTimespanDropdownAssertion');
    cy.get('button[aria-label="graph timespan"]').scrollIntoView().should('be.visible').click();
    const timespans = Object.values(GraphTimespan);
    timespans.forEach((timespan) => {
      cy.log('Graph Timespan: ' + timespan);
      cy.byPFRole('menuitem').contains(timespan).should('be.visible');
    });
    cy.get('button[aria-label="graph timespan"]').should('be.visible').click();
  },

  clickResetZoomButton: () => {
    cy.log('metricsPage.clickResetZoomButton');
    cy.bySemanticElement('button').contains('Reset zoom').scrollIntoView().should('be.visible').click();
  },

  clickHideGraphButton: () => {
    cy.log('metricsPage.clickHideGraphButton');
    cy.bySemanticElement('button').contains('Hide graph').scrollIntoView().should('be.visible').click();
    cy.get('.pf-c-chart').should('not.exist');
  },

  clickShowGraphButton: () => {
    cy.log('metricsPage.clickShowGraphButton');
    cy.bySemanticElement('button').contains('Show graph').scrollIntoView().should('be.visible').click();
    cy.get('.pf-c-chart').should('be.visible');
  },

  clickDisconnectedCheckbox: () => {
    cy.log('metricsPage.clickDisconnectedCheckbox');
    cy.get('#'+ 'disconnected').scrollIntoView().should('be.visible').click();
  },

  clickStackedCheckbox: () => {
    cy.log('metricsPage.clickStackedCheckbox');
    cy.get('#'+ 'stacked').scrollIntoView().should('be.visible').click();
  },

  clickStackedCheckboxAndAssert: () => {
    cy.log('metricsPage.clickStackedCheckboxAndAssert');
    cy.get('[id^="' + IDs.ChartAxis1ChartLabel + '"]').invoke('text').as('yAxisLabel');
    cy.get('#'+ 'stacked').scrollIntoView().should('be.visible').click();
    cy.get('[id^="' + IDs.ChartAxis1ChartLabel + '"]').then(() => {
      cy.get('@yAxisLabel').then((value) => {
        cy.get('[id^="' + IDs.ChartAxis1ChartLabel + '"]').should('not.contain', value);
      });
    });
    cy.get('#'+ 'stacked').should('have.attr', 'data-checked-state', 'true');
  },

  graphCardInlineInfoAssertion: (visible: boolean) => {
    cy.log('metricsPage.graphCardInlineInfoAssertion');
    if (visible) {
      cy.get(Classes.GraphCardInlineInfo).scrollIntoView().should('be.visible');
    } else {
      cy.get(Classes.GraphCardInlineInfo).should('not.exist');
    }
  },

  predefinedQueriesAssertion: () => {
    cy.log('metricsPage.predefinedQueriesAssertion');
    cy.byAriaLabel('Select query').should('be.visible').click();
    const queries = Object.values(MetricsPagePredefinedQueries);
    queries.forEach((query) => {
      cy.byPFRole('option').contains(query).should('be.visible');
    });
  },

  clickPredefinedQuery: (query: MetricsPagePredefinedQueries) => {
    cy.log('metricsPage.clickPredefinedQuery');
    cy.byAriaLabel('Select query').scrollIntoView().should('be.visible').click();
    cy.byPFRole('option').contains(query).should('be.visible').click();
  },

  clickKebabDropdown: (index: number) => {
    cy.log('metricsPage.clickKebabDropdown');
    cy.byAriaLabel('toggle menu').eq(index).scrollIntoView().should('be.visible').click();
  },

  kebabDropdownAssertionWithoutQuery: () => {
    cy.log('metricsPage.kebabDropdownAssertionWithoutQuery');
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DELETE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DUPLICATE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('not.exist');
    cy.byAriaLabel('toggle menu').eq(0).should('have.attr', 'aria-expanded', 'true').click();
  },

  kebabDropdownAssertionWithQuery: () => {
    cy.log('metricsPage.kebabDropdownAssertionWithQuery');
    metricsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DELETE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.DUPLICATE_QUERY).should('be.visible');
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible');
    cy.byAriaLabel('toggle menu').eq(0).should('have.attr', 'aria-expanded', 'true').click();
  },

  clickKebabDropdownItem: (option: MetricsPageQueryKebabDropdown, index: number) => {
    cy.log('metricsPage.clickKebabDropdownItem');
    metricsPage.clickKebabDropdown(index);
    cy.byPFRole('menuitem').contains(option).should('be.visible').click();
  },

  assertKebabDropdownItem: (option: MetricsPageQueryKebabDropdown, index: number) => {
    cy.log('metricsPage.assertKebabDropdownItem');
    metricsPage.clickKebabDropdown(index);
    cy.byPFRole('menuitem').contains(option).should('be.visible');
  },

  /** viewport width: 1920px
 * viewport height: 1080px
 * configurations from cypress.config.ts:
 * 5m - 20 labels
 * 15m - 15 labels
 * 30m - 30 labels - 15 labels
 * 1h - 12 labels
 * 2h - 24 labels
 * 6h - 12 labels
 * 12h - 12 labels
 * 1d - 24 labels
 * 2h - 16 labels
 * 1w - 14 labels
 * 2w - 14 labels
 */
  graphAxisXAssertion: (graphTimespan: GraphTimespan) => {
    cy.log('metricsPage.graphAxisAssertion');
    const axisSelector = '[id^="' + IDs.ChartAxis0ChartLabel + '"]';
    // Wait for chart to render (axis labels appear async). Use Cypress retry instead of a one-time body check.
    cy.get(axisSelector, { timeout: 20000 })
      .should('have.length.gte', 1)
      .then(() => {
        switch (graphTimespan) {
          case GraphTimespan.FIVE_MINUTES:
            cy.get(axisSelector).should('have.length', 20);
            break;
          case GraphTimespan.FIFTEEN_MINUTES:
            cy.get(axisSelector).should('have.length', 15);
            break;
          case GraphTimespan.THIRTY_MINUTES:
            cy.get(axisSelector).should('have.length.lte', 30);
            break;
          case GraphTimespan.ONE_HOUR:
            cy.get(axisSelector).should('have.length', 12);
            break;
          case GraphTimespan.TWO_HOURS:
            cy.get(axisSelector).should('have.length', 24);
            break;
          case GraphTimespan.SIX_HOURS:
            cy.get(axisSelector).should('have.length', 12);
            break;
          case GraphTimespan.TWELVE_HOURS:
            cy.get(axisSelector).should('have.length', 12);
            break;
          case GraphTimespan.ONE_DAY:
            cy.get(axisSelector).should('have.length', 24);
            break;
          case GraphTimespan.TWO_DAYS:
            cy.get(axisSelector).should('have.length', 16);
            break;
          case GraphTimespan.ONE_WEEK:
            cy.get(axisSelector).should('have.length', 14);
            break;
          case GraphTimespan.TWO_WEEKS:
            cy.get(axisSelector).should('have.length', 14);
            break;
          default: //30m is default
            cy.get(axisSelector).should('have.length', 15);
            break;
        }
      });
  },

  /** Use when the query returns no data; asserts the "No datapoints found" empty state instead of chart axis. */
  graphNoDatapointsAssertion: () => {
    cy.log('metricsPage.graphNoDatapointsAssertion');
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound)
      .scrollIntoView()
      .contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND)
      .should('be.visible');
  },

  enterQueryInput: (index: number, query: string) => {
    cy.log('metricsPage.enterQueryInput');
    cy.get(Classes.MetricsPageQueryInput).eq(index).should('be.visible').clear();
    cy.get(Classes.MetricsPageQueryInput).eq(index).type(query + '{enter}');
  },

  clickRunQueriesButton: () => {
    cy.log('metricsPage.clickRunQueriesButton');
    cy.bySemanticElement('button').contains('Run queries').scrollIntoView().should('be.visible').click();
  },

  clickDisableQuerySwitch: (index: number) => {
    cy.log('metricsPage.clickDisableQuerySwitch');
    cy.byAriaLabel('Disable query').eq(index).parent('label').should('be.visible').click();
  },

  clickEnableQuerySwitch: (index: number) => {
    cy.log('metricsPage.clickEnableQuerySwitch');
    cy.byAriaLabel('Enable query').eq(index).parent('label').should('be.visible').click();
  },

  disableEnableQuerySwitchAssertion: (index: number, enabled: boolean) => {
    cy.log('metricsPage.disableEnableQuerySwitchAssertion');
    if (enabled) {
      cy.byAriaLabel('Disable query').eq(index).should('have.attr', 'checked');
    } else {
      cy.byAriaLabel('Enable query').eq(index).should('not.have.attr', 'checked');
    }
  },

  clickSeriesButton: (rowIndex: number, seriesIndex: number, toEnable: boolean) => {
    cy.log('metricsPage.clickSeriesButton');
    if (toEnable) {
      cy.byAriaLabel('query results table').eq(rowIndex).find('button[aria-label="Show series"]').eq(seriesIndex).click();
    } else {
      cy.byAriaLabel('query results table').eq(rowIndex).find('button[aria-label="Hide series"]').eq(seriesIndex).click();
    }
  },

  seriesButtonAssertion: (rowIndex: number, seriesIndex: number, enabled: boolean) => { 
    cy.log('metricsPage.seriesButtonAssertion');
    if (enabled) {
      cy.byAriaLabel('query results table').eq(rowIndex).find('button[aria-label="Hide series"]').eq(seriesIndex).should('be.visible');
    } else {
      cy.byAriaLabel('query results table').eq(rowIndex).find('button[aria-label="Show series"]').eq(seriesIndex).should('be.visible');
    }
  },

  selectAllUnselectAllButtonAssertion: (rowIndex: number, unselectAll: boolean) => {
    cy.log('metricsPage.selectAllUnselectAllButtonAssertion');
    if (unselectAll) {
      cy.bySemanticElement('button').contains('Unselect all').eq(rowIndex).scrollIntoView().should('be.visible');
    } else {
      cy.bySemanticElement('button').contains('Select all').eq(rowIndex).scrollIntoView().should('be.visible');
    }
  },

  clickSelectAllUnselectAllButton: (rowIndex: number, unselectAll: boolean) => {
    cy.log('metricsPage.clickSelectAllUnselectAllButton');
    if (unselectAll) {
      cy.bySemanticElement('button').contains('Unselect all').eq(rowIndex).scrollIntoView().should('be.visible').click();
    } else {
      cy.bySemanticElement('button').contains('Select all').eq(rowIndex).scrollIntoView().should('be.visible').click();
    }
  },
  
  exportAsCSV: (clearFolder: boolean, fileNameExp: string) => {
    cy.log('metricsPage.exportAsCSV');
    let downloadedFileName: string | null = null;
    const downloadsFolder = Cypress.config('downloadsFolder');
    const expectedFileNamePattern = fileNameExp;
    if (clearFolder) {
      cy.task('clearDownloads');
    }
    cy.byPFRole('menuitem').contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible').click();

    cy.waitUntil(() => {
      return cy.task('getFilesInFolder', downloadsFolder).then((currentFiles: string[]) => {
        const matchingFile = currentFiles.find(file => file.includes(expectedFileNamePattern));
        if (matchingFile) {
          downloadedFileName = matchingFile;
          return true;
        }
        return false;
      });
    }, {
      timeout: 20000,
      interval: 1000,
      errorMsg: `CSV file matching "${expectedFileNamePattern}" was not downloaded within timeout.`
    });

    cy.then(() => {
      expect(downloadedFileName).to.not.be.null;
      cy.task('doesFileExist', { fileName: downloadedFileName }).should('be.true');
    });

  },

  noDatapointsFound: () => {
    cy.log('metricsPage.noDatapointsFound');
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).scrollIntoView().contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    cy.get('.query-browser__table-message').scrollIntoView().contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
  },

};
