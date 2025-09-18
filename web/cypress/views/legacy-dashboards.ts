import { commonPages } from "./common";
import { LegacyDashboardPageTestIDs, DataTestIDs, Classes, IDs, LegacyTestIDs } from "../../src/components/data-test";
import { MonitoringPageTitles, LegacyDashboardsTimeRange, MonitoringRefreshInterval, LegacyDashboardsDashboardDropdown, API_PERFORMANCE_DASHBOARD_PANELS } from "../fixtures/monitoring/constants";
import { clickIfExist } from "./utils";

export const legacyDashboardsPage = {

  shouldBeLoaded: () => {
    cy.log('legacyDashboardsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.byTestID(LegacyDashboardPageTestIDs.TimeRangeDropdown).contains(LegacyDashboardsTimeRange.LAST_30_MINUTES).should('be.visible');
    cy.byTestID(LegacyDashboardPageTestIDs.PollIntervalDropdown).contains(MonitoringRefreshInterval.THIRTY_SECONDS).should('be.visible');
    cy.byTestID(LegacyDashboardPageTestIDs.DashboardDropdown).find('input').should('have.value', LegacyDashboardsDashboardDropdown.API_PERFORMANCE[0]).and('be.visible');
  },

  clickTimeRangeDropdown: (timeRange: LegacyDashboardsTimeRange) => {
    cy.log('legacyDashboardsPage.clickTimeRangeDropdown');
    cy.byTestID(LegacyDashboardPageTestIDs.TimeRangeDropdown).find('button').should('be.visible').click();
    cy.get('#'+LegacyDashboardPageTestIDs.DashboardTimeRangeDropdownMenu).find(Classes.MenuItem).contains(timeRange).should('be.visible').click();
  },

  timeRangeDropdownAssertion: () => {
    cy.log('legacyDashboardsPage.timeRangeDropdownAssertion');
    cy.byTestID(LegacyDashboardPageTestIDs.TimeRangeDropdown).find('button').should('be.visible').click();
    const timeRanges = Object.values(LegacyDashboardsTimeRange);
    timeRanges.forEach((timeRange) => {
      cy.log('Time range: ' + timeRange);
      cy.get('#'+LegacyDashboardPageTestIDs.DashboardTimeRangeDropdownMenu).find(Classes.MenuItem).contains(timeRange).should('be.visible');
    });
    cy.byTestID(LegacyDashboardPageTestIDs.TimeRangeDropdown).find('button').should('be.visible').click();
  },

  clickRefreshIntervalDropdown: (interval: MonitoringRefreshInterval) => {
    cy.log('legacyDashboardsPage.clickRefreshIntervalDropdown');
    cy.byTestID(LegacyDashboardPageTestIDs.PollIntervalDropdown).find('button').should('be.visible').click();
    cy.get('#'+LegacyDashboardPageTestIDs.DashboardRefreshIntervalDropdownMenu).find(Classes.MenuItem).contains(interval).should('be.visible').click();
  },

  refreshIntervalDropdownAssertion: () => {
    cy.log('legacyDashboardsPage.refreshIntervalDropdownAssertion');
    cy.byTestID(LegacyDashboardPageTestIDs.PollIntervalDropdown).find('button').should('be.visible').click();

    const intervals = Object.values(MonitoringRefreshInterval);
    intervals.forEach((interval) => {
      cy.log('Refresh interval: ' + interval);
      cy.get('#'+LegacyDashboardPageTestIDs.DashboardRefreshIntervalDropdownMenu).find(Classes.MenuItem).contains(interval).should('be.visible');
    });

    cy.byTestID(LegacyDashboardPageTestIDs.PollIntervalDropdown).find('button').should('be.visible').click();
  },

  clickDashboardDropdown: (dashboard: keyof typeof LegacyDashboardsDashboardDropdown) => {
    cy.log('legacyDashboardsPage.clickDashboardDropdown');
    cy.byTestID(LegacyDashboardPageTestIDs.DashboardDropdown).find('button').scrollIntoView().should('be.visible').click();
    cy.get(Classes.MenuItem).contains(LegacyDashboardsDashboardDropdown[dashboard][0]).should('be.visible').click();
  },

  dashboardDropdownAssertion: () => {
    cy.log('legacyDashboardsPage.dashboardDropdownAssertion');
    cy.byTestID(LegacyDashboardPageTestIDs.DashboardDropdown).find('button').should('be.visible').click();
    const dashboards = Object.values(LegacyDashboardsDashboardDropdown);
    dashboards.forEach((dashboard) => {
      cy.log('Dashboard: ' + dashboard[0]);
      cy.get(Classes.MenuItem).contains(dashboard[0]).should('be.visible');
      if (dashboard[1] !== '') {
        cy.get(Classes.MenuItem).should('contain', dashboard[0]).and('contain', dashboard[1]);
      }
    });
    cy.byTestID(LegacyDashboardPageTestIDs.DashboardDropdown).find('button').should('be.visible').click();
  },

  dashboardAPIPerformancePanelAssertion: (panel: API_PERFORMANCE_DASHBOARD_PANELS) => {
    cy.log('legacyDashboardsPage.dashboardAPIPerformancePanelAssertion');
    function formatDataTestID(panel: API_PERFORMANCE_DASHBOARD_PANELS): string {
      return panel.toLowerCase().replace(/\s+/g, '-').concat('-chart');
    }
    const dataTestID = Object.values(API_PERFORMANCE_DASHBOARD_PANELS).map(formatDataTestID);
    dataTestID.forEach((dataTestID) => {
      cy.log('Data test ID: ' + dataTestID);
      cy.byTestID(dataTestID).scrollIntoView().should('be.visible');
    });
  },

  clickKebabDropdown: (index: number) => {
    cy.log('legacyDashboardsPage.clickKebabDropdown');
    cy.byTestID(DataTestIDs.KebabDropdownButton).eq(index).click();
  },
  
  exportAsCSV: (clearFolder: boolean, fileNameExp: string) => {
    cy.log('metricsPage.exportAsCSV');
    let downloadedFileName: string | null = null;
    const downloadsFolder = Cypress.config('downloadsFolder');
    const expectedFileNamePattern = fileNameExp;
    if (clearFolder) {
      cy.task('clearDownloads');
    }
    cy.byTestID(LegacyDashboardPageTestIDs.ExportAsCsv).should('be.visible').click();

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

};
