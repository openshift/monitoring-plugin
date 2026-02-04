import { commonPages } from "./common";
import { DataTestIDs, Classes, LegacyTestIDs, persesAriaLabels, persesMUIDataTestIDs, listPersesDashboardsOUIAIDs, IDs, persesDashboardDataTestIDs, listPersesDashboardsDataTestIDs } from "../../src/components/data-test";
import { MonitoringPageTitles } from "../fixtures/monitoring/constants";
import { listPersesDashboardsPageSubtitle, persesDashboardsEmptyDashboard, persesDashboardsModalTitles } from "../fixtures/perses/constants";
import { persesDashboardsTimeRange, persesDashboardsRefreshInterval, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev, persesDashboardsAcceleratorsCommonMetricsPanels } from "../fixtures/perses/constants";

export const persesDashboardsPage = {

  shouldBeLoaded: () => {
    cy.log('persesDashboardsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).contains(persesDashboardsTimeRange.LAST_30_MINUTES).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomInButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomOutButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).contains(persesDashboardsRefreshInterval.OFF).scrollIntoView().should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('input').scrollIntoView().should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').scrollIntoView().should('be.visible');
    cy.byLegacyTestID(LegacyTestIDs.PersesDashboardSection).scrollIntoView().should('be.visible');

  },

  //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
  shouldBeLoaded1: () => {
    cy.log('persesDashboardsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.byOUIAID(listPersesDashboardsOUIAIDs.PageHeaderSubtitle).scrollIntoView().should('contain', listPersesDashboardsPageSubtitle).should('be.visible');

    cy.byTestID(persesDashboardDataTestIDs.editDashboardButtonToolbar).scrollIntoView().should('be.visible');

    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).contains(persesDashboardsTimeRange.LAST_30_MINUTES).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomInButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomOutButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).contains(persesDashboardsRefreshInterval.OFF).scrollIntoView().should('be.visible');

    cy.get('#' + IDs.persesDashboardDownloadButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ViewJSONButton).scrollIntoView().should('be.visible');

    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('input').scrollIntoView().should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').scrollIntoView().should('be.visible');
  },

  shouldBeLoadedEditionMode: (dashboardName: string) => {
    cy.log('persesDashboardsPage.shouldBeLoadedEditionMode');
    cy.wait(10000);
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.byOUIAID(listPersesDashboardsOUIAIDs.PageHeaderSubtitle).scrollIntoView().should('contain', listPersesDashboardsPageSubtitle).should('be.visible');
    // cy.byTestID(listPersesDashboardsDataTestIDs.PersesBreadcrumbDashboardNameItem).scrollIntoView().should('contain', dashboardName.toLowerCase().replace(/ /g, '_')).should('be.visible');
    cy.byTestID(listPersesDashboardsDataTestIDs.PersesBreadcrumbDashboardNameItem).scrollIntoView().should('contain', dashboardName).should('be.visible');
    persesDashboardsPage.assertEditModeButtons();

    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).contains(persesDashboardsTimeRange.LAST_30_MINUTES).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomInButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomOutButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).contains(persesDashboardsRefreshInterval.OFF).scrollIntoView().should('be.visible');

    cy.get('#' + IDs.persesDashboardDownloadButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.EditJSONButton).scrollIntoView().should('be.visible');

    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('input').scrollIntoView().should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('input').should('have.value', dashboardName);
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').scrollIntoView().should('be.visible');

  },

  shouldBeLoadedEditionModeFromCreateDashboard: () => {
    cy.log('persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard');
    cy.wait(10000);
    cy.get('h2').contains(persesDashboardsEmptyDashboard.TITLE).scrollIntoView().should('be.visible');
    cy.get('p').contains(persesDashboardsEmptyDashboard.DESCRIPTION).scrollIntoView().should('be.visible');

    cy.get('h2').siblings('div').find('[aria-label="Add panel"]').scrollIntoView().should('be.visible');
    cy.get('h2').siblings('div').find('[aria-label="Edit variables"]').scrollIntoView().should('be.visible');
  },

  shouldBeLoadedAfterRename: (dashboardName: string) => {
    cy.log('persesDashboardsPage.shouldBeLoadedAfterRename');
    persesDashboardsPage.shouldBeLoadedAfter(dashboardName);
  },

  shouldBeLoadedAfterDuplicate: (dashboardName: string) => {
    cy.log('persesDashboardsPage.shouldBeLoadedAfterDuplicate');
    persesDashboardsPage.shouldBeLoadedAfter(dashboardName);
  },

  shouldBeLoadedAfter: (dashboardName: string) => {
    cy.log('persesDashboardsPage.shouldBeLoadedAfter');
    cy.byTestID(listPersesDashboardsDataTestIDs.PersesBreadcrumbDashboardNameItem).scrollIntoView().should('contain', dashboardName).should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('input').should('have.value', dashboardName);
  },

  clickTimeRangeDropdown: (timeRange: persesDashboardsTimeRange) => {
    cy.log('persesDashboardsPage.clickTimeRangeDropdown');
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).scrollIntoView().should('be.visible').click({ force: true });
    cy.byPFRole('option').contains(timeRange).scrollIntoView().should('be.visible').click({ force: true });
  },

  timeRangeDropdownAssertion: () => {
    cy.log('persesDashboardsPage.timeRangeDropdownAssertion');
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).scrollIntoView().should('be.visible').click({ force: true });
    const timeRanges = Object.values(persesDashboardsTimeRange);
    timeRanges.forEach((timeRange) => {
      cy.log('Time range: ' + timeRange);
      cy.byPFRole('option').contains(timeRange).scrollIntoView().should('be.visible');
    });
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).scrollIntoView().should('be.visible').click({ force: true });
  },

  clickRefreshButton: () => {
    cy.log('persesDashboardsPage.clickRefreshButton');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).scrollIntoView().should('be.visible').click();
  },

  clickRefreshIntervalDropdown: (interval: persesDashboardsRefreshInterval) => {
    cy.log('persesDashboardsPage.clickRefreshIntervalDropdown');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).scrollIntoView().should('be.visible').click({ force: true });
    cy.byPFRole('option').contains(interval).scrollIntoView().should('be.visible').click({ force: true });
  },

  refreshIntervalDropdownAssertion: () => {
    cy.log('persesDashboardsPage.refreshIntervalDropdownAssertion');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).scrollIntoView().should('be.visible').click({ force: true });

    const intervals = Object.values(persesDashboardsRefreshInterval);
    intervals.forEach((interval) => {
      cy.log('Refresh interval: ' + interval);
      cy.byPFRole('option').contains(interval).scrollIntoView().should('be.visible');
    });
    //Closing the dropdown by clicking on the OFF option, because the dropdown is not accessible while the menu is open, even forcing it
    cy.byPFRole('option').contains(persesDashboardsRefreshInterval.OFF).scrollIntoView().should('be.visible').click({ force: true });

  },

  clickDashboardDropdown: (dashboard: keyof typeof persesDashboardsDashboardDropdownCOO | keyof typeof persesDashboardsDashboardDropdownPersesDev) => {
    cy.log('persesDashboardsPage.clickDashboardDropdown');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').scrollIntoView().should('be.visible').click({ force: true });
    cy.byPFRole('option').contains(dashboard).should('be.visible').click({ force: true });
  },

  dashboardDropdownAssertion: (constants: typeof persesDashboardsDashboardDropdownCOO | typeof persesDashboardsDashboardDropdownPersesDev) => {
    cy.log('persesDashboardsPage.dashboardDropdownAssertion');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').scrollIntoView().should('be.visible').click({ force: true });
    const dashboards = Object.values(constants);
    dashboards.forEach((dashboard) => {
      cy.log('Dashboard: ' + dashboard[0]);
      cy.get(Classes.MenuItem).contains(dashboard[0]).scrollIntoView().should('be.visible');
      if (dashboard[1] !== '') {
        cy.get(Classes.MenuItem).scrollIntoView().should('contain', dashboard[0]).and('contain', dashboard[1]);
      }
    });
    cy.wait(1000);
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').scrollIntoView().should('be.visible').click({ force: true });
  },

  panelGroupHeaderAssertion: (panelGroupHeader: string, collapse_state: 'Open' | 'Closed') => {
    cy.log('persesDashboardsPage.panelGroupHeaderAssertion');
    cy.byDataTestID(persesMUIDataTestIDs.panelGroupHeader).contains(panelGroupHeader).scrollIntoView().should('be.visible');
    if (collapse_state === 'Open') {
      cy.byAriaLabel(persesAriaLabels.CollapseGroupButtonPrefix + panelGroupHeader).scrollIntoView().should('be.visible');
    } else {
      cy.byAriaLabel(persesAriaLabels.OpenGroupButtonPrefix + panelGroupHeader).scrollIntoView().should('be.visible');
    }
  },

  assertPanelGroupNotExist: (panelGroup: string) => {
    cy.log('persesDashboardsPage.assertPanelGroupNotExist');
    cy.byAriaLabel(persesAriaLabels.OpenGroupButtonPrefix + panelGroup).should('not.exist');
    cy.byAriaLabel(persesAriaLabels.CollapseGroupButtonPrefix + panelGroup).should('not.exist');
  },

  assertPanelGroupOrder: (panelGroup: string, order: number) => {
    cy.log('persesDashboardsPage.assertPanelGroupOrder');
    cy.byDataTestID(persesMUIDataTestIDs.panelGroupHeader).eq(order).find('h2').contains(panelGroup).scrollIntoView().should('be.visible');
  },

  panelHeadersAcceleratorsCommonMetricsAssertion: () => {
    cy.log('persesDashboardsPage.panelHeadersAcceleratorsCommonMetricsAssertion');

    const panels = Object.values(persesDashboardsAcceleratorsCommonMetricsPanels);
    panels.forEach((panel) => {
      cy.log('Panel: ' + panel);
      cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().should('be.visible');
    });
  },

  expandPanel: (panel: string) => {
    cy.log('persesDashboardsPage.expandPanel');
    persesDashboardsPage.clickPanelAction(panel, 'expand');
  },

  collapsePanel: (panel: string) => {
    cy.log('persesDashboardsPage.collapsePanel');
    persesDashboardsPage.clickPanelAction(panel, 'collapse');
  },

  expandPanelGroup: (panelGroup: string) => {
    cy.log('persesDashboardsPage.expandPanelGroup');
    cy.byAriaLabel(persesAriaLabels.OpenGroupButtonPrefix + panelGroup).scrollIntoView().should('be.visible').click({ force: true });
  },

  collapsePanelGroup: (panelGroup: string) => {
    cy.log('persesDashboardsPage.collapsePanelGroup');
    cy.byAriaLabel(persesAriaLabels.CollapseGroupButtonPrefix + panelGroup).scrollIntoView().should('be.visible').click({ force: true });
  },

  statChartValueAssertion: (panel: keyof typeof persesDashboardsAcceleratorsCommonMetricsPanels | string, noData: boolean) => {
    cy.log('persesDashboardsPage.statChartValueAssertion');
    cy.wait(2000);
    if (noData) {
      cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().parents('header').siblings('figure').find('p').should('contain', 'No data').should('be.visible');
    } else {
      cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().parents('header').siblings('figure').find('h3').should('not.contain', 'No data').should('be.visible');
    }
  },

  searchAndSelectVariable: (variable: string, value: string) => {
    cy.log('persesDashboardsPage.searchAndSelectVariable');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown + '-' + variable).find('input').type(value);
    cy.byPFRole('option').contains(value).click({ force: true });
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown + '-' + variable).find('button').click({ force: true });
    cy.wait(1000);
  },

  searchAndTypeVariable: (variable: string, value: string) => {
    cy.log('persesDashboardsPage.searchAndTypeVariable');
    if (value !== undefined && value !== '') {
      cy.byDataTestID(persesMUIDataTestIDs.variableDropdown + '-' + variable).find('input').type(value);
    }
    cy.wait(1000);
  },

  assertVariableBeVisible: (variable: string) => {
    cy.log('persesDashboardsPage.assertVariableBeVisible');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown + '-' + variable).should('be.visible');
  },

  assertVariableNotExist: (variable: string) => {
    cy.log('persesDashboardsPage.assertVariableNotExist');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown + '-' + variable).should('not.exist');
  },

  assertVariableNotBeVisible: (variable: string) => {
    cy.log('persesDashboardsPage.assertVariableNotBeVisible');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown + '-' + variable).should('not.be.visible');
  },

  clickEditButton: () => {
    cy.log('persesDashboardsPage.clickEditButton');
    cy.byTestID(persesDashboardDataTestIDs.editDashboardButtonToolbar).scrollIntoView().should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  assertEditButtonIsDisabled: () => {
    cy.log('persesDashboardsPage.assertEditButtonIsDisabled');
    cy.byTestID(persesDashboardDataTestIDs.editDashboardButtonToolbar).scrollIntoView().should('be.visible').should('have.attr', 'disabled');
  },

  assertEditModeButtons: () => {
    cy.log('persesDashboardsPage.assertEditModeButtons');
    cy.byTestID(persesDashboardDataTestIDs.editDashboardButtonToolbar).should('not.exist');
    cy.byAriaLabel(persesAriaLabels.EditVariablesButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.EditDatasourcesButton).should('not.exist');
    cy.byAriaLabel(persesAriaLabels.AddPanelButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.AddGroupButton).should('be.visible');
    cy.bySemanticElement('button', 'Save').should('be.visible');
    cy.byTestID(persesDashboardDataTestIDs.cancelButtonToolbar).should('be.visible');
  },

  clickEditActionButton: (button: 'EditVariables' | 'AddPanel' | 'AddGroup' | 'Save' | 'Cancel') => {
    cy.log('persesDashboardsPage.clickEditActionButton');
    cy.wait(2000);
    switch (button) {
      case 'EditVariables':
        cy.byAriaLabel(persesAriaLabels.EditVariablesButton).eq(0).scrollIntoView().should('be.visible').click({ force: true });
        break;
      //TODO: OU-1054 target for COO1.5.0, so, commenting out for now
      // case 'EditDatasources':
      //   cy.byAriaLabel(persesAriaLabels.EditDatasourcesButton).scrollIntoView().should('be.visible').click({ force: true });
      //   break;
      case 'AddPanel':
        cy.byAriaLabel(persesAriaLabels.AddPanelButton).eq(0).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'AddGroup':
        cy.byAriaLabel(persesAriaLabels.AddGroupButton).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'Save':
        cy.bySemanticElement('button', 'Save').scrollIntoView().should('be.visible').click({ force: true });
        persesDashboardsPage.clickSaveDashboardButton();
        persesDashboardsPage.closeSuccessAlert();
        break;
      case 'Cancel':
        cy.byTestID(persesDashboardDataTestIDs.cancelButtonToolbar).scrollIntoView().should('be.visible').click({ force: true });
        cy.wait(1000);
        persesDashboardsPage.clickDiscardChangesButton();
        break;
    }
  },

  assertEditModePanelGroupButtons: (panelGroup: string) => {
    cy.log('persesDashboardsPage.assertEditModePanelGroupButtons');
    cy.byAriaLabel(persesAriaLabels.AddPanelToGroupPrefix + panelGroup).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.EditPanelGroupPrefix + panelGroup).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.DeletePanelGroupPrefix + panelGroup).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.MovePanelGroupPrefix + panelGroup + persesAriaLabels.MovePanelGroupDownSuffix).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.MovePanelGroupPrefix + panelGroup + persesAriaLabels.MovePanelGroupUpSuffix).scrollIntoView().should('be.visible');
  },

  clickPanelAction: (panel: string, button: 'expand' | 'collapse' | 'edit' | 'duplicate' | 'delete') => {
    cy.log('persesDashboardsPage.clickPanelActions');
    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).siblings('div').eq(0).then((element1) => {
      if (element1.find('[data-testid="MenuIcon"]').length > 0 && element1.find('[data-testid="MenuIcon"]').is(':visible')) {
        cy.byAriaLabel(persesAriaLabels.EditPanelActionMenuButtonPrefix + panel).should('be.visible').click({ force: true });
      }
    });

    switch (button) {
      case 'expand':
        cy.byAriaLabel(persesAriaLabels.EditPanelExpandCollapseButtonPrefix + panel + persesAriaLabels.EditPanelExpandCollapseButtonSuffix).find('[data-testid="ArrowExpandIcon"]').eq(0).invoke('show').click({ force: true });
        break;
      case 'collapse':
        cy.byAriaLabel(persesAriaLabels.EditPanelExpandCollapseButtonPrefix + panel + persesAriaLabels.EditPanelExpandCollapseButtonSuffix).find('[data-testid="ArrowCollapseIcon"]').eq(1).should('be.visible').click({ force: true });
        break;
      case 'edit':
        cy.byAriaLabel(persesAriaLabels.EditPanelPrefix + panel).should('be.visible').click({ force: true });
        break;
      case 'duplicate':
        cy.byAriaLabel(persesAriaLabels.EditPanelDuplicateButtonPrefix + panel).should('be.visible').click({ force: true });
        break;
      case 'delete':
        cy.byAriaLabel(persesAriaLabels.EditPanelDeleteButtonPrefix + panel).should('be.visible').click({ force: true });
        break;
    }
  },

  assertPanelActionButtons: (panel: string) => {
    cy.log('persesDashboardsPage.assertPanelActionButtons');

    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).siblings('div').eq(1).then((element1) => {
      if (element1.find('[data-testid="MenuIcon"]').length > 0 && element1.find('[data-testid="MenuIcon"]').is(':visible')) {
        cy.byAriaLabel(persesAriaLabels.EditPanelExpandCollapseButtonPrefix + panel + persesAriaLabels.EditPanelExpandCollapseButtonSuffix).find('[data-testid="ArrowExpandIcon"]').eq(0).should('be.visible').click();
      }
      cy.byAriaLabel(persesAriaLabels.EditPanelExpandCollapseButtonPrefix + panel + persesAriaLabels.EditPanelExpandCollapseButtonSuffix).should('be.visible');
      cy.byAriaLabel(persesAriaLabels.EditPanelPrefix + panel).should('be.visible');
      cy.byAriaLabel(persesAriaLabels.EditPanelDuplicateButtonPrefix + panel).should('be.visible');
      cy.byAriaLabel(persesAriaLabels.EditPanelDeleteButtonPrefix + panel).should('be.visible');
    });

    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).siblings('div').eq(2).then((element1) => {
      if (element1.find('[data-testid="ArrowCollapseIcon"]').length > 0 && element1.find('[data-testid="ArrowCollapseIcon"]').is(':visible')) {
        cy.byAriaLabel(persesAriaLabels.EditPanelExpandCollapseButtonPrefix + panel + persesAriaLabels.EditPanelExpandCollapseButtonSuffix).find('[data-testid="ArrowCollapseIcon"]').eq(0).click({ force: true });
      }
    });
  },

  clickSaveDashboardButton: () => {
    cy.log('persesDashboardsPage.clickSaveDashboardButton');
    cy.wait(2000);
    cy.get('body').then((body) => {
      if (body.find('[data-testid="CloseIcon"]').length > 0 && body.find('[data-testid="CloseIcon"]').is(':visible')) {
        cy.bySemanticElement('button', 'Save Changes').scrollIntoView().should('be.visible').click({ force: true });
      }
    });
    cy.wait(2000);
  },

  backToListPersesDashboardsPage: () => {
    cy.log('persesDashboardsPage.backToListPersesDashboardsPage');
    cy.byTestID(listPersesDashboardsDataTestIDs.PersesBreadcrumbDashboardItem).scrollIntoView().should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  clickDiscardChangesButton: () => {
    cy.log('persesDashboardsPage.clickDiscardChangesButton');
    cy.get('body').then((body) => {
      if (body.find('#'+IDs.persesDashboardDiscardChangesDialog).length > 0 && body.find('#'+IDs.persesDashboardDiscardChangesDialog).is(':visible')) {
        cy.bySemanticElement('button', 'Discard Changes').scrollIntoView().should('be.visible').click({ force: true });
      }
    });
  },

  assertPanel: (name: string, group: string, collapse_state: 'Open' | 'Closed') => {
    cy.log('persesDashboardsPage.assertPanel');
    persesDashboardsPage.panelGroupHeaderAssertion(group, collapse_state);
    if (collapse_state === 'Open') {
      cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(name).should('be.visible');
    } else {
      cy.byAriaLabel(persesAriaLabels.OpenGroupButtonPrefix + group).scrollIntoView().should('be.visible').click({ force: true });
      cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(name).should('be.visible');
      cy.byAriaLabel(persesAriaLabels.CollapseGroupButtonPrefix + group).should('be.visible').click({ force: true });
    }
  },

  assertPanelNotExist: (name: string) => {
    cy.log('persesDashboardsPage.assertPanelNotExist');
    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(name).should('not.exist');
  },

  downloadDashboard: (clearFolder: boolean, dashboardName: string, format: 'JSON' | 'YAML' | 'YAML (CR)') => {
    cy.log('persesDashboardsPage.downloadDashboard');

    if (clearFolder) {
      cy.task('clearDownloads');
    }

    cy.get('#'+ IDs.persesDashboardDownloadButton).scrollIntoView().should('be.visible').click({ force: true });
    cy.byPFRole('menuitem').contains(format).should('be.visible').click({ force: true });
    cy.wait(1000);
    let filename: string;
    if (format === 'YAML (CR)') {
      filename = dashboardName + '-cr' + '.yaml';
    } else {
      filename = dashboardName + '.' + format.toLowerCase();
    }
    persesDashboardsPage.assertFilename(filename);
  },

  assertFilename: (fileNameExp: string) => {
    cy.log('persesDashboardsPage.assertFilename');
    let downloadedFileName: string | null = null;
    const downloadsFolder = Cypress.config('downloadsFolder');
    const expectedFileNamePattern = fileNameExp;
   
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
      errorMsg: `File matching "${expectedFileNamePattern}" was not downloaded within timeout.`
    });

    cy.then(() => {
      expect(downloadedFileName).to.not.be.null;
      cy.task('doesFileExist', { fileName: downloadedFileName }).should('be.true');
    });
  },

  viewJSON: (dashboardName: string, namespace: string) => {
    cy.log('persesDashboardsPage.viewJSON');
    cy.byAriaLabel(persesAriaLabels.ViewJSONButton).scrollIntoView().should('be.visible').click({ force: true });
    cy.byPFRole('dialog').find('h2').contains(persesDashboardsModalTitles.VIEW_JSON_DIALOG).scrollIntoView().should('be.visible');
    cy.byAriaLabel('Close').should('be.visible').click({ force: true });
  },
  
  assertDuplicatedPanel: (panel: string, amount: number) => {
    cy.log('persesDashboardsPage.assertDuplicatedPanel');
    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').filter(`:contains("${panel}")`).should('have.length', amount);
  },

  closeSuccessAlert: () => {
    cy.log('persesDashboardsPage.closeSuccessAlert');
    cy.wait(2000);
    cy.get('body').then((body) => {
      if (body.find('h4').length > 0 && body.find('h4').is(':visible')) {
        cy.get('h4').siblings('div').find('button').scrollIntoView().should('be.visible').click({ force: true });
      }
    });
  },
}
