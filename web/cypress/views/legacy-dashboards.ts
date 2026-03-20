import { commonPages } from "./common";
import { LegacyDashboardPageTestIDs, DataTestIDs, Classes, IDs, LegacyTestIDs } from "../../src/components/data-test";
import { MonitoringPageTitles, LegacyDashboardsTimeRange, MonitoringRefreshInterval, LegacyDashboardsDashboardDropdown, API_PERFORMANCE_DASHBOARD_PANELS, LegacyDashboardsDashboardDropdownNamespace, KUBERNETES_COMPUTE_RESOURCES_NAMESPACE_PODS_PANELS } from "../fixtures/monitoring/constants";
import { clickIfExist } from "./utils";

export const legacyDashboardsPage = {

  shouldBeLoaded: () => {
    cy.log('legacyDashboardsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.get('#' + LegacyDashboardPageTestIDs.TimeRangeDropdown).contains(LegacyDashboardsTimeRange.LAST_30_MINUTES).should('be.visible');
    cy.get('#' + LegacyDashboardPageTestIDs.PollIntervalDropdown).contains(MonitoringRefreshInterval.THIRTY_SECONDS).should('be.visible');
    
    cy.get(Classes.DashboardDropdown).find(Classes.DashboardDropdownField).contains(LegacyDashboardsDashboardDropdown.API_PERFORMANCE[0]).and('be.visible');
  },

  clickTimeRangeDropdown: (timeRange: LegacyDashboardsTimeRange) => {
    cy.log('legacyDashboardsPage.clickTimeRangeDropdown');
    cy.get('#' + LegacyDashboardPageTestIDs.TimeRangeDropdown).should('be.visible').click();
    cy.get('#'+LegacyDashboardPageTestIDs.DashboardTimeRangeDropdownMenu).find(Classes.MenuItem).contains(timeRange).should('be.visible').click();
  },

  timeRangeDropdownAssertion: () => {
    cy.log('legacyDashboardsPage.timeRangeDropdownAssertion');
    cy.get('#' + LegacyDashboardPageTestIDs.TimeRangeDropdown).should('be.visible').click();
    const timeRanges = Object.values(LegacyDashboardsTimeRange);
    timeRanges.forEach((timeRange) => {
      cy.log('Time range: ' + timeRange);
      cy.get(Classes.DashboardHeaderDropdownMenu).find(Classes.MenuItem).contains(timeRange).should('be.visible');
    });
    cy.get('#' + LegacyDashboardPageTestIDs.TimeRangeDropdown).should('be.visible').click();
  },

  clickRefreshIntervalDropdown: (interval: MonitoringRefreshInterval) => {
    cy.log('legacyDashboardsPage.clickRefreshIntervalDropdown');
    cy.get('#' + LegacyDashboardPageTestIDs.PollIntervalDropdown).should('be.visible').click();
    cy.get(Classes.DashboardHeaderDropdownMenu).find(Classes.MenuItem).contains(interval).should('be.visible').click();
  },

  refreshIntervalDropdownAssertion: () => {
    cy.log('legacyDashboardsPage.refreshIntervalDropdownAssertion');
    cy.get('#' + LegacyDashboardPageTestIDs.PollIntervalDropdown).should('be.visible').click();

    const intervals = Object.values(MonitoringRefreshInterval);
    intervals.forEach((interval) => {
      cy.log('Refresh interval: ' + interval);
      cy.get(Classes.DashboardHeaderDropdownMenu).find(Classes.MenuItem).contains(interval).should('be.visible');
    });

    cy.get('#' + LegacyDashboardPageTestIDs.PollIntervalDropdown).should('be.visible').click();
  },

  clickDashboardDropdown: (dashboard: keyof typeof LegacyDashboardsDashboardDropdown) => {
    cy.log('legacyDashboardsPage.clickDashboardDropdown');
    cy.byTestID(DataTestIDs.DashboardDropdown).scrollIntoView().should('be.visible').click();
    cy.wait(2000);
    cy.get('input[type="search"]').type(LegacyDashboardsDashboardDropdown[dashboard][0]);
    cy.wait(2000);
    cy.byPFRole('option').contains(dashboard[0]).should('be.visible').click();
  },

  dashboardDropdownAssertion: (constants: typeof LegacyDashboardsDashboardDropdown | typeof LegacyDashboardsDashboardDropdownNamespace) => {
    cy.log('legacyDashboardsPage.dashboardDropdownAssertion');
    cy.byTestID(DataTestIDs.DashboardDropdown).find(Classes.DashboardDropdown).should('be.visible').click();
    const dashboards = Object.values(constants);
    dashboards.forEach((dashboard) => {
      cy.log('Dashboard: ' + dashboard[0]);
      cy.byPFRole('option').contains(dashboard[0]).scrollIntoView().should('be.visible');
      if (dashboard[1] !== '') {
        cy.byPFRole('option').should('contain', dashboard[0]).and('contain', dashboard[1]);
      }
    });
    cy.byTestID(DataTestIDs.DashboardDropdown).should('be.visible').click();
  },

  dashboardAPIPerformancePanelAssertion: () => {
    cy.log('legacyDashboardsPage.dashboardAPIPerformancePanelAssertion');
    function formatDataTestID(panel: API_PERFORMANCE_DASHBOARD_PANELS): string {
      return panel.toLowerCase().replace(/\s+/g, '-').concat('-chart');
    }
    const dataTestIDs = Object.values(API_PERFORMANCE_DASHBOARD_PANELS).map(formatDataTestID);
    dataTestIDs.forEach((dataTestID) => {
      cy.log('Data test ID: ' + dataTestID);
      cy.byTestID(dataTestID).scrollIntoView().should('be.visible');
    });
  },

  dashboardKubernetesComputeResourcesNamespacePodsPanelAssertion: () => {
    cy.log('legacyDashboardsPage.dashboardKubernetesComputeResourcesNamespacePodsPanelAssertion');
    function formatDataTestID(panel: KUBERNETES_COMPUTE_RESOURCES_NAMESPACE_PODS_PANELS): string {
      return panel.toLowerCase().replace(/\s+/g, '-').concat('-chart');
    }
    const dataTestIDs = Object.values(KUBERNETES_COMPUTE_RESOURCES_NAMESPACE_PODS_PANELS).map(formatDataTestID);
    dataTestIDs.forEach((dataTestID) => {
      cy.log('Data test ID: ' + dataTestID);
      cy.byTestID(dataTestID).scrollIntoView().should('be.visible');
    });
  },

  clickKebabDropdown: (index: number) => {
    cy.log('legacyDashboardsPage.clickKebabDropdown');
    cy.byLegacyTestID(LegacyTestIDs.KebabButton).eq(index).scrollIntoView().should('be.visible').click();
  },
  
  exportAsCSV: (clearFolder: boolean, fileNameExp: string) => {
    cy.log('metricsPage.exportAsCSV');
    let downloadedFileName: string | null = null;
    const downloadsFolder = Cypress.config('downloadsFolder');
    const expectedFileNamePattern = fileNameExp;
    if (clearFolder) {
      cy.task('clearDownloads');
    }
    cy.byPFRole('menuitem').contains('Export as CSV').scrollIntoView().should('be.visible').click();

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
