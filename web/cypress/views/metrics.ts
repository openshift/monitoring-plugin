import { commonPages } from "./common";
import { DataTestIDs, Classes, IDs } from "../../src/components/data-test";
import { MetricsPageUnits, MonitoringRefreshInterval, MetricsPageQueryInput, MetricsPageActions, MetricGraphEmptyState, MetricsPagePredefinedQueries, MetricsPageQueryKebabDropdown, GraphTimespan } from "../fixtures/monitoring/constants";

export const metricsPage = {

  shouldBeLoaded: () => {
    cy.log('metricsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText('Metrics');
    cy.byTestID(DataTestIDs.MetricGraphUnitsDropDown).contains(MetricsPageUnits.NO_UNITS).should('be.visible');
    cy.byTestID(DataTestIDs.MetricDropdownPollInterval).contains(MonitoringRefreshInterval.REFRESH_OFF).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist'); 
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('be.visible');
    cy.byTestID(DataTestIDs.TypeaheadSelectInput).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageAddQueryButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageRunQueriesButton).should('be.visible');
    metricsPage.expandCollapseRowAssertion(true, 0, false, false);
  },

  redirectedToMetricsPageWithDatapoints: () => {
    cy.log('metricsPage.redirectedToMetricsPage');
    commonPages.titleShouldHaveText('Metrics');
    cy.byTestID(DataTestIDs.MetricGraphUnitsDropDown).contains(MetricsPageUnits.NO_UNITS).should('be.visible');
    cy.byTestID(DataTestIDs.MetricDropdownPollInterval).contains(MonitoringRefreshInterval.REFRESH_OFF).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraphTimespanInput).should('be.visible');
    cy.byTestID(DataTestIDs.MetricResetZoomButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('be.visible');
    cy.byTestID(DataTestIDs.TypeaheadSelectInput).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageAddQueryButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageRunQueriesButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).eq(0).should('be.visible');
    cy.get(Classes.MetricsPageExpandedRowIcon).eq(0).should('be.visible');
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('not.have.text', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(0).should('have.attr', 'checked');
    cy.byTestID(DataTestIDs.KebabDropdownButton).eq(0).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible'); 
    cy.byTestID(DataTestIDs.MetricsPageQueryTable).eq(0).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).eq(0).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageSeriesButton).eq(0).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('not.exist');
  },

  redirectedToMetricsPageWithoutDatapoints: () => {
    cy.log('metricsPage.redirectedToMetricsPageWithoutDatapoints');
    commonPages.titleShouldHaveText('Metrics');
    cy.byTestID(DataTestIDs.MetricGraphUnitsDropDown).contains(MetricsPageUnits.NO_UNITS).should('be.visible');
    cy.byTestID(DataTestIDs.MetricDropdownPollInterval).contains(MonitoringRefreshInterval.REFRESH_OFF).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraphTimespanInput).should('be.visible');
    cy.byTestID(DataTestIDs.MetricResetZoomButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricStackedCheckbox).should('be.visible');
    cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    cy.byTestID(DataTestIDs.TypeaheadSelectInput).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageAddQueryButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageRunQueriesButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).eq(0).should('be.visible');
    cy.get(Classes.MetricsPageExpandedRowIcon).eq(0).should('be.visible');
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('not.have.text', MetricsPageQueryInput.EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(0).should('have.attr', 'checked');
    cy.byTestID(DataTestIDs.KebabDropdownButton).eq(0).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageYellowNoDatapointsFound).contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageQueryTable).eq(0).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).eq(0).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageSeriesButton).eq(0).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('not.exist');
  },

  clickInsertExampleQuery: () => {
    cy.log('metricsPage.insertExampleQuery');
    cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).click();
  },

  shouldBeLoadedWithGraph: () => {
    cy.log('metricsPage.shouldBeLoadedWithGraph');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEnteredTitle).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageNoQueryEntered).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('not.exist');
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraphTimespanInput).should('be.visible');
    cy.byTestID(DataTestIDs.MetricResetZoomButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).should('be.visible');
    cy.byTestID(DataTestIDs.MetricStackedCheckbox).should('be.visible');
    cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).should('be.visible');
    metricsPage.expandCollapseRowAssertion(true, 0, true, false);
  },

  clickUnitsDropdown: (units: MetricsPageUnits) => {
    cy.log('metricsPage.clickUnitsDropdown');
    cy.byTestID(DataTestIDs.MetricGraphUnitsDropDown).should('be.visible').click();
    cy.get(Classes.MenuItem).contains(units).should('be.visible').click();
  },

  unitsDropdownAssertion: () => {
    cy.log('metricsPage.unitsDropdownAssertion');
    cy.byTestID(DataTestIDs.MetricGraphUnitsDropDown).should('be.visible').click();

    const units = Object.values(MetricsPageUnits);
    units.forEach((unit) => {
      cy.log('Unit: ' + unit);
      cy.get(Classes.MenuItem).contains(unit).should('be.visible');
    });

    cy.byTestID(DataTestIDs.MetricGraphUnitsDropDown).should('be.visible').click();
  },

  unitsAxisYAssertion: (unit: MetricsPageUnits) => {
    cy.log('metricsPage.unitsAxisYAssertion');
    cy.get('[id^="' + IDs.ChartAxis1ChartLabel + '"]').should('be.visible');
    cy.get('[id^="' + IDs.ChartAxis1ChartLabel + '"]').should('not.contain', 'undefined');
  },

  clickRefreshIntervalDropdown: (interval: MonitoringRefreshInterval) => {
    cy.log('metricsPage.clickRefreshIntervalDropdown');
    cy.byTestID(DataTestIDs.MetricDropdownPollInterval).should('be.visible').click();
    cy.get(Classes.MenuItem).contains(interval).should('be.visible').click();
  },

  refreshIntervalDropdownAssertion: () => {
    cy.log('metricsPage.refreshIntervalDropdownAssertion');
    cy.byTestID(DataTestIDs.MetricDropdownPollInterval).should('be.visible').click();

    const intervals = Object.values(MonitoringRefreshInterval);
    intervals.forEach((interval) => {
      cy.log('Refresh interval: ' + interval);
      cy.get(Classes.MenuItem).contains(interval).should('be.visible');
    });

    cy.get(Classes.MenuItem).contains(MonitoringRefreshInterval.FIFTEEN_SECONDS).click();
    cy.byTestID(DataTestIDs.MetricDropdownPollInterval).should(
      'contain',
      MonitoringRefreshInterval.FIFTEEN_SECONDS,
    );

    cy.byTestID(DataTestIDs.MetricDropdownPollInterval).should('be.visible').click();
    cy.get(Classes.MenuItem).contains(MonitoringRefreshInterval.REFRESH_OFF).click();
    cy.byTestID(DataTestIDs.MetricDropdownPollInterval).should(
      'contain',
      MonitoringRefreshInterval.REFRESH_OFF,
    );
  },

  clickAddQueryButton: () => {
    cy.log('metricsPage.clickAddQuery');
    cy.byTestID(DataTestIDs.MetricsPageAddQueryButton).scrollIntoView().click();
    metricsPage.addQueryAssertion();
  },

  clickActions: () => {
    cy.log('metricsPage.clickActions');
    cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('have.attr', 'aria-expanded', 'false').click();
  },

  actionsDropdownAssertion: () => {
    cy.log('metricsPage.actionsDropdownAssertion');
    cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('have.attr', 'aria-expanded', 'false').click();
    cy.byTestID(DataTestIDs.MetricsPageAddQueryDropdownItem).contains(MetricsPageActions.ADD_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageDeleteAllQueriesDropdownItem).contains(MetricsPageActions.DELETE_ALL_QUERIES).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseAllDropdownItem).contains(MetricsPageActions.COLLAPSE_ALL_QUERY_TABLES).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageActionsDropdownButton).should('have.attr', 'aria-expanded', 'true').click();
  },

  clickActionsAddQuery: () => {
    cy.log('metricsPage.clickActionsAddQuery');
    metricsPage.clickActions();
    cy.byTestID(DataTestIDs.MetricsPageAddQueryDropdownItem).click();
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
      cy.byTestID(DataTestIDs.MetricsPageExpandCollapseAllDropdownItem).contains(MetricsPageActions.EXPAND_ALL_QUERY_TABLES).click();
    } else {
      cy.byTestID(DataTestIDs.MetricsPageExpandCollapseAllDropdownItem).contains(MetricsPageActions.COLLAPSE_ALL_QUERY_TABLES).click();
    }
  },

  /**
   * 
   * @param expand true: to assert it is expanded, false: to assert it is collapsed
   * @param withQuery if there is any row with query,true: to assert the query table is visible, false: to assert the query table is not visible
   */
  expandCollapseAllQueryAssertion: (expanded: boolean) => {
    cy.log('metricsPage.expandCollapseAllQueryAssertion');
    cy.byTestID(DataTestIDs.MetricsPageExpandCollapseRowButton).then(($rowIcons) => {
      const rowIconsCount = Cypress.$($rowIcons).length;
      for (let i = 0; i < rowIconsCount; i++) {
        if (expanded) {
          cy.get(Classes.MetricsPageRows).find('li').eq(i).should('be.visible');
          cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(i).should('have.attr', 'checked');
        } else { //collapsed
          cy.get(Classes.MetricsPageRows).find('li').eq(i).should('be.visible');
          cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(i).should('have.attr', 'checked'); //collapsed does not change switch state when from actions
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
    cy.get(Classes.MetricsPageRows).find('li').eq(index).should('be.visible').click()
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
        cy.get(Classes.MetricsPageRows).find('li').eq(index).scrollIntoView().should('be.visible');
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageDisableEnableQuerySwitch + '"]').should('have.attr', 'checked');
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageQueryTable + '"]').should('be.visible');
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageSelectAllUnselectAllButton + '"]').should('be.visible');
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').should('have.length.gt', 0);
      } else {
        cy.get(Classes.MetricsPageRows).find('li').eq(index).should('be.visible');
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageDisableEnableQuerySwitch + '"]').should('have.attr', 'checked');
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageQueryTable + '"]').should('not.exist');
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageSelectAllUnselectAllButton + '"]').should('not.exist');
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').should('not.exist');
      }
    } else {
      if (withSwitch){
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageDisableEnableQuerySwitch + '"]').should('not.have.attr', 'checked');
      }
      else {
        cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageDisableEnableQuerySwitch + '"]').should('have.attr', 'checked');  
      }
      cy.get(Classes.MetricsPageRows).find('li').eq(index).should('be.visible');
      cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageQueryTable + '"]').should('not.exist');
      cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageSelectAllUnselectAllButton + '"]').should('not.exist');
      cy.get(Classes.MetricsPageRows).find('li').eq(index).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').should('not.exist');
    }
  },

  clickActionsDeleteAllQueries: () => {
    cy.log('metricsPage.clickActionsDeleteAllQueries');
    metricsPage.clickActions();
    cy.byTestID(DataTestIDs.MetricsPageDeleteAllQueriesDropdownItem).click();
  },

  deleteAllQueriesAssertion: () => {
    cy.log('metricsPage.deleteAllQueriesAssertion');
    metricsPage.shouldBeLoaded();
  },

  clickGraphTimespanDropdown: (timespan: GraphTimespan) => {
    cy.log('metricsPage.clickGraphTimespanDropdown');
    cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).scrollIntoView().should('be.visible').click();
    cy.get(Classes.MenuItem).contains(timespan).should('be.visible').click();
    cy.byPFRole('progressbar').should('be.visible');
    cy.byPFRole('progressbar').should('not.exist');
  },

  enterGraphTimespan: (timespan: GraphTimespan) => {
    cy.log('metricsPage.enterGraphTimespan');
    cy.byTestID(DataTestIDs.MetricGraphTimespanInput).scrollIntoView().should('be.visible').type('{selectall}{backspace}', {delay: 1000});
    cy.byTestID(DataTestIDs.MetricGraphTimespanInput).type(timespan);
    cy.byTestID(DataTestIDs.MetricGraphTimespanInput).should('have.attr', 'value', timespan);
    cy.byPFRole('progressbar').should('be.visible');
    cy.byPFRole('progressbar').should('not.exist');
  },

  graphTimespanDropdownAssertion: () => {
    cy.log('metricsPage.graphTimespanDropdownAssertion');
    cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).should('be.visible').click();
    const timespans = Object.values(GraphTimespan);
    timespans.forEach((timespan) => {
      cy.log('Graph Timespan: ' + timespan);
      cy.get(Classes.MenuItem).contains(timespan).should('be.visible');
    });
    cy.byTestID(DataTestIDs.MetricGraphTimespanDropdown).should('be.visible').click();
  },

  clickResetZoomButton: () => {
    cy.log('metricsPage.clickResetZoomButton');
    cy.byTestID(DataTestIDs.MetricResetZoomButton).scrollIntoView().should('be.visible').click();
  },

  clickHideGraphButton: () => {
    cy.log('metricsPage.clickHideGraphButton');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).scrollIntoView().should('be.visible').click();
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
  },

  clickShowGraphButton: () => {
    cy.log('metricsPage.clickShowGraphButton');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).scrollIntoView().should('be.visible').click();
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
  },

  clickDisconnectedCheckbox: () => {
    cy.log('metricsPage.clickDisconnectedCheckbox');
    cy.byTestID(DataTestIDs.MetricDisconnectedCheckbox).scrollIntoView().should('be.visible').click();
  },

  clickStackedCheckbox: () => {
    cy.log('metricsPage.clickStackedCheckbox');
    cy.byTestID(DataTestIDs.MetricStackedCheckbox).scrollIntoView().should('be.visible').click();
  },

  clickStackedCheckboxAndAssert: () => {
    cy.log('metricsPage.clickStackedCheckboxAndAssert');
    cy.get('[id^="' + IDs.ChartAxis1ChartLabel + '"]').invoke('text').as('yAxisLabel');
    cy.byTestID(DataTestIDs.MetricStackedCheckbox).scrollIntoView().should('be.visible').click();
    cy.get('[id^="' + IDs.ChartAxis1ChartLabel + '"]').then(() => {
      cy.get('@yAxisLabel').then((value) => {
        cy.get('[id^="' + IDs.ChartAxis1ChartLabel + '"]').should('not.contain', value);
      });
    });
    cy.byTestID(DataTestIDs.MetricStackedCheckbox).should('have.attr', 'data-checked-state', 'true');
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
    cy.byTestID(DataTestIDs.TypeaheadSelectInput).scrollIntoView().should('be.visible').click();

    const queries = Object.values(MetricsPagePredefinedQueries);
    queries.forEach((query) => {
      cy.log('Predefined Query: ' + query);
      cy.get(Classes.MetricsPagePredefinedQueriesMenuItem).contains(query).should('be.visible');
    });
  },

  clickPredefinedQuery: (query: MetricsPagePredefinedQueries) => {
    cy.log('metricsPage.clickPredefinedQuery');
    cy.byTestID(DataTestIDs.TypeaheadSelectInput).scrollIntoView().should('be.visible').click();
    cy.get(Classes.MetricsPagePredefinedQueriesMenuItem).contains(query).should('be.visible').click();
  },

  clickKebabDropdown: (index: number) => {
    cy.log('metricsPage.clickKebabDropdown');
    cy.byTestID(DataTestIDs.KebabDropdownButton).eq(index).click();
  },

  kebabDropdownAssertionWithoutQuery: () => {
    cy.log('metricsPage.kebabDropdownAssertionWithoutQuery');
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageDeleteQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DELETE_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageDuplicateQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DUPLICATE_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).should('not.exist');

    cy.byTestID(DataTestIDs.KebabDropdownButton).eq(0).should('have.attr', 'aria-expanded', 'true').click();
  },

  kebabDropdownAssertionWithQuery: () => {
    cy.log('metricsPage.kebabDropdownAssertionWithQuery');
    metricsPage.clickKebabDropdown(0);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DISABLE_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem).contains(MetricsPageQueryKebabDropdown.HIDE_ALL_SERIES).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageDeleteQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DELETE_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageDuplicateQueryDropdownItem).contains(MetricsPageQueryKebabDropdown.DUPLICATE_QUERY).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).contains(MetricsPageQueryKebabDropdown.EXPORT_AS_CSV).should('be.visible');
    cy.byTestID(DataTestIDs.KebabDropdownButton).eq(0).should('have.attr', 'aria-expanded', 'true').click();
  },

  clickKebabDropdownItem: (option: MetricsPageQueryKebabDropdown, index: number) => {
    cy.log('metricsPage.clickKebabDropdownItem');
    metricsPage.clickKebabDropdown(index);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(option).should('be.visible').click();
  },

  assertKebabDropdownItem: (option: MetricsPageQueryKebabDropdown, index: number) => {
    cy.log('metricsPage.assertKebabDropdownItem');
    metricsPage.clickKebabDropdown(index);
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQueryDropdownItem).contains(option).should('be.visible');
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
    cy.get('body').then($body => {
      if ($body.find('[id^="' + IDs.ChartAxis0ChartLabel + '"]').length > 0) {
        switch (graphTimespan) {
          case GraphTimespan.FIVE_MINUTES:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 20);
            break;
          case GraphTimespan.FIFTEEN_MINUTES:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 15);
            break;
          case GraphTimespan.THIRTY_MINUTES:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length.lte', 30);
            break;
          case GraphTimespan.ONE_HOUR:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 12);
            break;
          case GraphTimespan.TWO_HOURS:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 24);
            break;
          case GraphTimespan.SIX_HOURS:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 12);
            break;
          case GraphTimespan.TWELVE_HOURS:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 12);
            break;
          case GraphTimespan.ONE_DAY:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 24);
            break;
          case GraphTimespan.TWO_DAYS:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 16);
            break;
          case GraphTimespan.ONE_WEEK:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 14);
            break;
          case GraphTimespan.TWO_WEEKS:
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 14);
            break;
          default: //30m is default
            cy.get('[id^="' + IDs.ChartAxis0ChartLabel + '"]').should('have.length', 15);
            break;
        }
      } else {
        cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).scrollIntoView().contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
      }
    });
  },

  enterQueryInput: (index: number, query: string) => {
    cy.log('metricsPage.enterQueryInput');
    cy.get(Classes.MetricsPageQueryInput).eq(index).should('be.visible').clear();
    cy.get(Classes.MetricsPageQueryInput).eq(index).type(query + '{enter}');
  },

  clickRunQueriesButton: () => {
    cy.log('metricsPage.clickRunQueriesButton');
    cy.byTestID(DataTestIDs.MetricsPageRunQueriesButton).should('be.visible').click();
  },

  clickDisableEnableQuerySwitch: (index: number) => {
    cy.log('metricsPage.clickDisableEnableQuerySwitch');
    cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(index).parent('label').should('be.visible').click();
  },

  disableEnableQuerySwitchAssertion: (index: number, enabled: boolean) => {
    cy.log('metricsPage.disableEnableQuerySwitchAssertion');
    if (enabled) {
      cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(index).should('have.attr', 'checked');
    } else {
      cy.byTestID(DataTestIDs.MetricsPageDisableEnableQuerySwitch).eq(index).should('not.have.attr', 'checked');
    }
  },

  clickSeriesButton: (rowIndex: number, seriesIndex: number, toEnable: boolean) => {
    cy.log('metricsPage.clickSeriesButton');
    if (toEnable) {
      cy.get(Classes.MetricsPageExpandedRowIcon).eq(rowIndex).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').eq(seriesIndex).should('have.attr', 'aria-label', 'Show series').click();
    } else {
      cy.get(Classes.MetricsPageExpandedRowIcon).eq(rowIndex).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').eq(seriesIndex).should('have.attr', 'aria-label', 'Hide series').click();
    }
  },

  seriesButtonAssertion: (rowIndex: number, seriesIndex: number, enabled: boolean) => { 
    cy.log('metricsPage.seriesButtonAssertion');
    if (enabled) {
      cy.get(Classes.MetricsPageExpandedRowIcon).eq(rowIndex).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').eq(seriesIndex).should('have.attr', 'aria-label', 'Hide series');
    } else {
      cy.get(Classes.MetricsPageExpandedRowIcon).eq(rowIndex).find('[data-test="' + DataTestIDs.MetricsPageSeriesButton + '"]').eq(seriesIndex).should('have.attr', 'aria-label', 'Show series');
    }
  },

  selectAllUnselectAllButtonAssertion: (rowIndex: number, unselectAll: boolean) => {
    cy.log('metricsPage.selectAllUnselectAllButtonAssertion');
    if (unselectAll) {
      cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).eq(rowIndex).contains('Unselect all').should('be.visible');
    } else {
      cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).eq(rowIndex).contains('Select all').should('be.visible');
    }
  },

  clickSelectAllUnselectAllButton: (rowIndex: number, unselectAll: boolean) => {
    cy.log('metricsPage.clickSelectAllUnselectAllButton');
    if (unselectAll) {
      cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).eq(rowIndex).contains('Unselect all').should('be.visible').click();
    } else {
      cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).eq(rowIndex).contains('Select all').should('be.visible').click();
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
    cy.byTestID(DataTestIDs.MetricsPageExportCsvDropdownItem).should('be.visible').click();

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
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageYellowNoDatapointsFound).contains(MetricGraphEmptyState.NO_DATAPOINTS_FOUND).should('be.visible');
    cy.byTestID(DataTestIDs.MetricsPageInsertExampleQueryButton).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageQueryTable).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageSelectAllUnselectAllButton).should('not.exist');
    cy.byTestID(DataTestIDs.MetricsPageSeriesButton).should('not.exist');
  },

};