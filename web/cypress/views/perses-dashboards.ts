import { commonPages } from "./common";
import { DataTestIDs, Classes, LegacyTestIDs, persesAriaLabels, persesDataTestIDs } from "../../src/components/data-test";
import { MonitoringPageTitles, persesDashboardsTimeRange, persesDashboardsRefreshInterval, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev, persesDashboardsAcceleratorsCommonMetricsPanels } from "../fixtures/monitoring/constants";

export const persesDashboardsPage = {

  shouldBeLoaded: () => {
    cy.log('persesDashboardsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).contains(persesDashboardsTimeRange.LAST_30_MINUTES).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).contains(persesDashboardsRefreshInterval.OFF).should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('input').should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible');
    cy.byLegacyTestID(LegacyTestIDs.PersesDashboardSection).should('be.visible');

  },

  clickTimeRangeDropdown: (timeRange: persesDashboardsTimeRange) => {
    cy.log('persesDashboardsPage.clickTimeRangeDropdown');
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).should('be.visible').click({force: true});
    cy.byPFRole('option').contains(timeRange).should('be.visible').click({force: true});
  },

  timeRangeDropdownAssertion: () => {
    cy.log('persesDashboardsPage.timeRangeDropdownAssertion');
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).should('be.visible').click({force: true});
    const timeRanges = Object.values(persesDashboardsTimeRange);
    timeRanges.forEach((timeRange) => {
      cy.log('Time range: ' + timeRange);
      cy.byPFRole('option').contains(timeRange).should('be.visible');
    });
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).should('be.visible').click({force: true});
  },

  clickRefreshButton: () => {
    cy.log('persesDashboardsPage.clickRefreshButton');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).should('be.visible').click();
  },

  clickRefreshIntervalDropdown: (interval: persesDashboardsRefreshInterval) => {
    cy.log('persesDashboardsPage.clickRefreshIntervalDropdown');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).should('be.visible').click({force: true});
    cy.byPFRole('option').contains(interval).should('be.visible').click({force: true});
  },

  refreshIntervalDropdownAssertion: () => {
    cy.log('persesDashboardsPage.refreshIntervalDropdownAssertion');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).should('be.visible').click({force: true});

    const intervals = Object.values(persesDashboardsRefreshInterval);
    intervals.forEach((interval) => {
      cy.log('Refresh interval: ' + interval);
      cy.byPFRole('option').contains(interval).should('be.visible');
    });
    //Closing the dropdown by clicking on the OFF option, because the dropdown is not accessible while the menu is open, even forcing it
    cy.byPFRole('option').contains(persesDashboardsRefreshInterval.OFF).should('be.visible').click({force: true});
    
  },

  clickDashboardDropdown: (dashboard: keyof typeof persesDashboardsDashboardDropdownCOO | keyof typeof persesDashboardsDashboardDropdownPersesDev) => {
    cy.log('persesDashboardsPage.clickDashboardDropdown');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible').click({force: true});
    cy.byPFRole('option').contains(dashboard).should('be.visible').click({force: true});
  },

  dashboardDropdownAssertion: (constants: typeof persesDashboardsDashboardDropdownCOO | typeof persesDashboardsDashboardDropdownPersesDev) => {
    cy.log('persesDashboardsPage.dashboardDropdownAssertion');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible').click({force: true});
    const dashboards = Object.values(constants);
    dashboards.forEach((dashboard) => {
      cy.log('Dashboard: ' + dashboard[0]);
      cy.get(Classes.MenuItem).contains(dashboard[0]).should('be.visible');
      if (dashboard[1] !== '') {
        cy.get(Classes.MenuItem).should('contain', dashboard[0]).and('contain', dashboard[1]);
      }
    });
    cy.wait(1000);
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible').click({force: true});
  },

  panelGroupHeaderAssertion: (panelGroupHeader: string) => {
    cy.log('persesDashboardsPage.panelGroupHeaderAssertion');
    cy.byDataTestID(persesDataTestIDs.panelGroupHeader).contains(panelGroupHeader).should('be.visible');
  },

  panelHeadersAcceleratorsCommonMetricsAssertion: () => {
    cy.log('persesDashboardsPage.panelHeadersAcceleratorsCommonMetricsAssertion');

    const panels = Object.values(persesDashboardsAcceleratorsCommonMetricsPanels);
    panels.forEach((panel) => {
      cy.log('Panel: ' + panel);
      cy.byDataTestID(persesDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().should('be.visible');
    });
  },

  expandCollapsePanel: (panel: keyof typeof persesDashboardsAcceleratorsCommonMetricsPanels | string) => {
    cy.log('persesDashboardsPage.expandPanel');
    cy.byDataTestID(persesDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().parents('div.MuiCardHeader-content').siblings('div.MuiCardHeader-action').find('button').should('be.visible').click();
  },

  statChartValueAssertion: (panel: keyof typeof persesDashboardsAcceleratorsCommonMetricsPanels | string, noData: boolean) => {
    cy.log('persesDashboardsPage.statChartValueAssertion');
    cy.wait(2000);
    if (noData) {
      cy.byDataTestID(persesDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().parents('header').siblings('figure').find('p').should('contain', 'No data').should('be.visible');
    } else {
      cy.byDataTestID(persesDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().parents('header').siblings('figure').find('h3').should('not.contain', 'No data').should('be.visible');
    }
  },

  searchAndSelectVariable: (variable: string, value: string) => {
    cy.log('persesDashboardsPage.searchAndSelectVariable');
    cy.byDataTestID(persesDataTestIDs.variableDropdown+'-'+variable).find('input').type(value);
    cy.byPFRole('option').contains(value).click({force: true});
    cy.wait(1000);
  },
}
