import { commonPages } from "./common";
import { DataTestIDs, Classes, LegacyTestIDs, persesAriaLabels, persesMUIDataTestIDs, listPersesDashboardsOUIAIDs, IDs, persesDashboardDataTestIDs, listPersesDashboardsDataTestIDs } from "../../src/components/data-test";
import { MonitoringPageTitles } from "../fixtures/monitoring/constants";
import { listPersesDashboardsPageSubtitle } from "../fixtures/perses/constants";
import { persesDashboardsTimeRange, persesDashboardsRefreshInterval, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev, persesDashboardsAcceleratorsCommonMetricsPanels } from "../fixtures/perses/constants";

export const persesDashboardsPage = {

  shouldBeLoaded: () => {
    cy.log('persesDashboardsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).contains(persesDashboardsTimeRange.LAST_30_MINUTES).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomInButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomOutButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).contains(persesDashboardsRefreshInterval.OFF).should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('input').should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible');
    cy.byLegacyTestID(LegacyTestIDs.PersesDashboardSection).should('be.visible');

  },

  //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
  shouldBeLoaded1: () => {
    cy.log('persesDashboardsPage.shouldBeLoaded');
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.byOUIAID(listPersesDashboardsOUIAIDs.PageHeaderSubtitle).should('contain', listPersesDashboardsPageSubtitle).should('be.visible');

    cy.byTestID(persesDashboardDataTestIDs.editDashboardButtonToolbar).should('be.visible');

    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).contains(persesDashboardsTimeRange.LAST_30_MINUTES).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomInButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ZoomOutButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).contains(persesDashboardsRefreshInterval.OFF).should('be.visible');

    cy.get('#' + IDs.persesDashboardDownloadButton).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.ViewJSONButton).should('be.visible');

    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('input').should('be.visible');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible');
    cy.byLegacyTestID(LegacyTestIDs.PersesDashboardSection).should('be.visible');

  },

  clickTimeRangeDropdown: (timeRange: persesDashboardsTimeRange) => {
    cy.log('persesDashboardsPage.clickTimeRangeDropdown');
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).should('be.visible').click({ force: true });
    cy.byPFRole('option').contains(timeRange).should('be.visible').click({ force: true });
  },

  timeRangeDropdownAssertion: () => {
    cy.log('persesDashboardsPage.timeRangeDropdownAssertion');
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).should('be.visible').click({ force: true });
    const timeRanges = Object.values(persesDashboardsTimeRange);
    timeRanges.forEach((timeRange) => {
      cy.log('Time range: ' + timeRange);
      cy.byPFRole('option').contains(timeRange).should('be.visible');
    });
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).should('be.visible').click({ force: true });
  },

  clickRefreshButton: () => {
    cy.log('persesDashboardsPage.clickRefreshButton');
    cy.byAriaLabel(persesAriaLabels.RefreshButton).should('be.visible').click();
  },

  clickRefreshIntervalDropdown: (interval: persesDashboardsRefreshInterval) => {
    cy.log('persesDashboardsPage.clickRefreshIntervalDropdown');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).should('be.visible').click({ force: true });
    cy.byPFRole('option').contains(interval).should('be.visible').click({ force: true });
  },

  refreshIntervalDropdownAssertion: () => {
    cy.log('persesDashboardsPage.refreshIntervalDropdownAssertion');
    cy.byAriaLabel(persesAriaLabels.RefreshIntervalDropdown).should('be.visible').click({ force: true });

    const intervals = Object.values(persesDashboardsRefreshInterval);
    intervals.forEach((interval) => {
      cy.log('Refresh interval: ' + interval);
      cy.byPFRole('option').contains(interval).should('be.visible');
    });
    //Closing the dropdown by clicking on the OFF option, because the dropdown is not accessible while the menu is open, even forcing it
    cy.byPFRole('option').contains(persesDashboardsRefreshInterval.OFF).should('be.visible').click({ force: true });

  },

  clickDashboardDropdown: (dashboard: keyof typeof persesDashboardsDashboardDropdownCOO | keyof typeof persesDashboardsDashboardDropdownPersesDev) => {
    cy.log('persesDashboardsPage.clickDashboardDropdown');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible').click({ force: true });
    cy.byPFRole('option').contains(dashboard).should('be.visible').click({ force: true });
  },

  dashboardDropdownAssertion: (constants: typeof persesDashboardsDashboardDropdownCOO | typeof persesDashboardsDashboardDropdownPersesDev) => {
    cy.log('persesDashboardsPage.dashboardDropdownAssertion');
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible').click({ force: true });
    const dashboards = Object.values(constants);
    dashboards.forEach((dashboard) => {
      cy.log('Dashboard: ' + dashboard[0]);
      cy.get(Classes.MenuItem).contains(dashboard[0]).should('be.visible');
      if (dashboard[1] !== '') {
        cy.get(Classes.MenuItem).should('contain', dashboard[0]).and('contain', dashboard[1]);
      }
    });
    cy.wait(1000);
    cy.byTestID(DataTestIDs.PersesDashboardDropdown).find('button').should('be.visible').click({ force: true });
  },

  panelGroupHeaderAssertion: (panelGroupHeader: string) => {
    cy.log('persesDashboardsPage.panelGroupHeaderAssertion');
    cy.byDataTestID(persesMUIDataTestIDs.panelGroupHeader).contains(panelGroupHeader).should('be.visible');
  },

  panelHeadersAcceleratorsCommonMetricsAssertion: () => {
    cy.log('persesDashboardsPage.panelHeadersAcceleratorsCommonMetricsAssertion');

    const panels = Object.values(persesDashboardsAcceleratorsCommonMetricsPanels);
    panels.forEach((panel) => {
      cy.log('Panel: ' + panel);
      cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().should('be.visible');
    });
  },

  expandPanel: (panel: keyof typeof persesDashboardsAcceleratorsCommonMetricsPanels | string) => {
    cy.log('persesDashboardsPage.expandPanel');
    persesDashboardsPage.clickPanelAction(panel, 'expand');
  },

  collapsePanel: (panel: keyof typeof persesDashboardsAcceleratorsCommonMetricsPanels | string) => {
    cy.log('persesDashboardsPage.collapsePanel');
    persesDashboardsPage.clickPanelAction(panel, 'collapse');
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
    cy.wait(1000);
  },

  searchAndTypeVariable: (variable: string, value: string) => {
    cy.log('persesDashboardsPage.searchAndTypeVariable');
    if (value !== undefined) {
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
  },

  assertEditModeButtons: () => {
    cy.log('persesDashboardsPage.assertEditModeButtons');
    cy.byTestID(persesDashboardDataTestIDs.editDashboardButtonToolbar).should('not.exist');
    cy.byAriaLabel(persesAriaLabels.EditVariablesButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.EditDatasourcesButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.AddPanelButton).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.AddGroupButton).scrollIntoView().should('be.visible');
    cy.bySemanticElement('button', 'Save').scrollIntoView().should('be.visible');
    cy.byTestID(persesDashboardDataTestIDs.cancelButtonToolbar).scrollIntoView().should('be.visible');
  },

  clickEditActionButton: (button: 'EditVariables' | 'EditDatasources'| 'AddPanel' | 'AddGroup' | 'Save' | 'Cancel') => {
    cy.log('persesDashboardsPage.clickEditActionButton');
    switch (button) {
      case 'EditVariables':
        cy.byAriaLabel(persesAriaLabels.EditVariablesButton).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'EditDatasources':
        cy.byAriaLabel(persesAriaLabels.EditDatasourcesButton).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'AddPanel':
        cy.byAriaLabel(persesAriaLabels.AddPanelButton).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'AddGroup':
        cy.byAriaLabel(persesAriaLabels.AddGroupButton).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'Save':
        cy.bySemanticElement('button', 'Save').scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'Cancel':
        cy.byTestID(persesDashboardDataTestIDs.cancelButtonToolbar).scrollIntoView().should('be.visible').click({ force: true });
        break;
    }
  },

  assertEditModePanelGroupButtons: (panelGroup: string) => {
    cy.log('persesDashboardsPage.assertEditModePanelGroupButtons');
    cy.byAriaLabel(persesAriaLabels.AddPanelToGroupPrefix + panelGroup).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.EditPanelGroupPrefix + panelGroup).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.DeletePanelGroupPrefix + panelGroup).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.MovePanelGroupDownPrefix + panelGroup + persesAriaLabels.MovePanelGroupDownSuffix).scrollIntoView().should('be.visible');
    cy.byAriaLabel(persesAriaLabels.MovePanelGroupUpPrefix + panelGroup + persesAriaLabels.MovePanelGroupUpSuffix).scrollIntoView().should('be.visible');
  },

  clickPanelAction: (panel: string, button: 'expand' | 'collapse' | 'edit' | 'duplicate' | 'delete') => {
    cy.log('persesDashboardsPage.clickPanelActions');

    let element = cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2);

    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(0).then((element1) => {
      if (element1.find('[data-testid="MenuIcon"]').length > 0 && element1.find('[data-testid="MenuIcon"]').is(':visible')) {
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(0).find('[data-testid="MenuIcon"]').click({ force: true });
        element = cy.get('#' + IDs.persesDashboardActionMenuModal).scrollIntoView();
      }
    });

    switch (button) {
      case 'expand':
        element.find('[data-testid="ArrowExpandIcon"]').click({ force: true });
        break;
      case 'collapse':
        element.find('[data-testid="ArrowCollapseIcon"]').click({ force: true });
        break;
      case 'edit':
        element.find('[data-testid="PencilOutlineIcon"]').click({ force: true });
        break;
      case 'duplicate':
        element.find('[data-testid="ContentCopyIcon"]').click({ force: true });
        break;
      case 'delete':
        element.find('[data-testid="DeleteOutlineIcon"]').click({ force: true });
        break;
    }

  },

  assertPanelActionButtons: (panel: string) => {
    cy.log('persesDashboardsPage.assertPanelActionButtons');

    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(1).then((element1) => {
      if (element1.find('[data-testid="MenuIcon"]').length > 0 && element1.find('[data-testid="MenuIcon"]').is(':visible')) {
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(1).find('[data-testid="ArrowExpandIcon"]').click({ force: true });
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2).find('[data-testid="PencilOutlineIcon"]').should('be.visible');
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2).find('[data-testid="ContentCopyIcon"]').should('be.visible');
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2).find('[data-testid="DeleteOutlineIcon"]').should('be.visible');
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2).find('[data-testid="ArrowCollapseIcon"]').should('be.visible').click({ force: true });
      } else {
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2).find('[data-testid="ArrowExpandIcon"]').should('be.visible');
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2).find('[data-testid="PencilOutlineIcon"]').should('be.visible');
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2).find('[data-testid="ContentCopyIcon"]').should('be.visible');
        cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').contains(panel).scrollIntoView().siblings('div').eq(2).find('[data-testid="DeleteOutlineIcon"]').should('be.visible');
      }
    });
  },

  clickSaveDashboardButton: (currentTimeRange: boolean, currentRefreshInterval: boolean, currentVariables: boolean) => {
    cy.log('persesDashboardsPage.clickSaveDashboardButton');
    // if (!currentTimeRange) {
    //   cy.get('input').eq(0).click({ force: true });
    // }
    // if (currentRefreshInterval) {
    //   cy.get('input').eq(1).click({ force: true });
    // }
    // if (currentVariables) {
    //   cy.get('input').eq(2).click({ force: true });
    // }
    cy.bySemanticElement('button', 'Save Changes').scrollIntoView().should('be.visible').click({ force: true });
  },

  backToListPersesDashboardsPage: () => {
    cy.log('persesDashboardsPage.backToListPersesDashboardsPage');
    cy.byTestID(listPersesDashboardsDataTestIDs.PersesBreadcrumbDashboardItem).scrollIntoView().should('be.visible').click({ force: true });
  },
}
