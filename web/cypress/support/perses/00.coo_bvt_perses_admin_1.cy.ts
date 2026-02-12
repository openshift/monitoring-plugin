import { persesDashboardsAcceleratorsCommonMetricsPanels, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev, persesDashboardsEmptyDashboard } from '../../fixtures/perses/constants';
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesMUIDataTestIDs } from '../../../src/components/data-test';
import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import { persesDashboardsPanelGroup } from '../../views/perses-dashboards-panelgroup';
import { persesDashboardsPanel } from '../../views/perses-dashboards-panel';
import { persesDashboardsEditVariables } from '../../views/perses-dashboards-edit-variables';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesDashboardsAddListVariableSource } from '../../fixtures/perses/constants';
import { persesDashboardSampleQueries } from '../../fixtures/perses/constants';
import { persesDashboardsAddListPanelType } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runBVTCOOPersesTests1(perspective: PerspectiveConfig) {
  testBVTCOOPerses1(perspective);
}

export function testBVTCOOPerses1(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - Dashboards (Perses) page`, () => {
    cy.log(`1.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
    persesDashboardsPage.shouldBeLoaded1();
  });

  it(`2.${perspective.name} perspective - Accelerators common metrics dashboard `, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses) > Accelerators common metrics dashboard`);
    cy.changeNamespace('openshift-cluster-observability-operator');
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
    cy.wait(2000);

    cy.log(`2.2. Select dashboard`);
    persesDashboardsPage.clickDashboardDropdown(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0] as keyof typeof persesDashboardsDashboardDropdownCOO);
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-cluster').should('be.visible');
    persesDashboardsPage.panelGroupHeaderAssertion('Accelerators', 'Open');
    persesDashboardsPage.panelHeadersAcceleratorsCommonMetricsAssertion();
    persesDashboardsPage.expandPanel(persesDashboardsAcceleratorsCommonMetricsPanels.GPU_UTILIZATION);
    persesDashboardsPage.collapsePanel(persesDashboardsAcceleratorsCommonMetricsPanels.GPU_UTILIZATION);
  });

  it(`3.${perspective.name} perspective - Perses Dashboard Sample dashboard`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses) > Perses Dashboard Sample dashboard`);
    cy.changeNamespace('perses-dev');
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    cy.wait(2000);
    persesDashboardsPage.clickDashboardDropdown(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] as keyof typeof persesDashboardsDashboardDropdownPersesDev);
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-job').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-instance').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-interval').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-text').should('be.visible');
    persesDashboardsPage.panelGroupHeaderAssertion('Row 1', 'Open');
    persesDashboardsPage.expandPanel('RAM Total');
    persesDashboardsPage.collapsePanel('RAM Total');
    persesDashboardsPage.statChartValueAssertion('RAM Total', true);
    persesDashboardsPage.searchAndSelectVariable('job', 'node-exporter');
    persesDashboardsPage.statChartValueAssertion('RAM Total', false);
  });

  it(`4.${perspective.name} perspective - Download and View JSON`, () => {
    cy.log(`4.1. use sidebar nav to go to Observe > Dashboards (Perses) > Download and View JSON`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
    persesDashboardsPage.downloadDashboard(true, persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2], 'JSON');
    persesDashboardsPage.downloadDashboard(true, persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2], 'YAML');
    persesDashboardsPage.downloadDashboard(true, persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2], 'YAML (CR)');
    persesDashboardsPage.viewJSON(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2], 'openshift-cluster-observability-operator');

  });

  it(`5.${perspective.name} perspective - Duplicate from a project to another, Rename and Delete`, () => {
    cy.log(`5.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`5.2. Change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');
    listPersesDashboardsPage.countDashboards('3');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`5.3. Click on the Kebab icon - Duplicate to another project`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDuplicateOption();
    listPersesDashboardsPage.duplicateDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.duplicateDashboardSelectProjectDropdown('openshift-cluster-observability-operator');
    listPersesDashboardsPage.duplicateDashboardDuplicateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    persesDashboardsPage.shouldBeLoadedAfterDuplicate(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`5.4. Click on the Kebab icon - Rename`);
    cy.changeNamespace('openshift-cluster-observability-operator');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] + ' - Renamed');
    listPersesDashboardsPage.renameDashboardRenameButton();

    cy.log(`5.5. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clearAllFilters();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] + ' - Renamed');
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`5.6. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`5.7. Search for the renamed dashboard`);
    listPersesDashboardsPage.clearAllFilters();
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] + ' - Renamed');
    listPersesDashboardsPage.countDashboards('0');
    listPersesDashboardsPage.clearAllFilters();
    
  });

  it(`6.${perspective.name} perspective - Create Dashboard with panel groups, panels and variables`, () => {
    let dashboardName = 'Testing Dashboard - UP ';
    let randomSuffix = Math.random().toString(5);
    dashboardName += randomSuffix;
    cy.log(`6.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`6.2. Click on Create button`);
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();

    cy.log(`6.3. Create Dashboard`);
    persesCreateDashboardsPage.selectProject('perses-dev');
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);
    persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();

    cy.log(`6.4. Add Variable`);
    persesDashboardsPage.clickEditActionButton('EditVariables');
    persesDashboardsEditVariables.clickButton('Add Variable');
    persesDashboardsEditVariables.addListVariable('interval', false, false, '', '', '', undefined, undefined);
    persesDashboardsEditVariables.addListVariable_staticListVariable_enterValue('1m');
    persesDashboardsEditVariables.addListVariable_staticListVariable_enterValue('5m');
    persesDashboardsEditVariables.clickButton('Add');

    persesDashboardsEditVariables.clickButton('Add Variable');
    persesDashboardsEditVariables.addListVariable('job', false, false, '', '', '', persesDashboardsAddListVariableSource.PROMETHEUS_LABEL_VARIABLE, undefined);
    persesDashboardsEditVariables.addListVariable_promLabelValuesVariable_enterLabelName('job');
    persesDashboardsEditVariables.clickButton('Add');

    persesDashboardsEditVariables.clickButton('Add Variable');
    persesDashboardsEditVariables.addListVariable('instance', false, false, '', '', '', persesDashboardsAddListVariableSource.PROMETHEUS_LABEL_VARIABLE, undefined);
    persesDashboardsEditVariables.addListVariable_promLabelValuesVariable_enterLabelName('instance');
    persesDashboardsEditVariables.addListVariable_promLabelValuesVariable_addSeriesSelector(persesDashboardSampleQueries.CPU_LINE_MULTI_SERIES_SERIES_SELECTOR);
    persesDashboardsEditVariables.clickButton('Add');
    
    persesDashboardsEditVariables.clickButton('Apply');
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`6.5. Add Panel Group`);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('AddGroup');
    persesDashboardsPanelGroup.addPanelGroup('Panel Group Up', 'Open', '');

    cy.log(`6.6. Add Panel`);
    persesDashboardsPage.clickEditActionButton('AddPanel');
    persesDashboardsPanel.addPanelShouldBeLoaded();
    persesDashboardsPanel.addPanel('Up', 'Panel Group Up', persesDashboardsAddListPanelType.TIME_SERIES_CHART, 'This is a line chart test', 'up');
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`6.7. Back and check panel`);
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.clickDashboard(dashboardName);
    persesDashboardsPage.panelGroupHeaderAssertion('Panel Group Up', 'Open');
    persesDashboardsPage.assertPanel('Up', 'Panel Group Up', 'Open');
    persesDashboardsPage.assertVariableBeVisible('interval');
    persesDashboardsPage.assertVariableBeVisible('job');
    persesDashboardsPage.assertVariableBeVisible('instance');
    
    cy.log(`6.8. Click on Edit button`);
    persesDashboardsPage.clickEditButton();

    cy.log(`6.9. Click on Edit Variables button and Delete all variables`);
    persesDashboardsPage.clickEditActionButton('EditVariables');
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`6.10. Assert variables not exist`);
    persesDashboardsPage.assertVariableNotExist('interval');
    persesDashboardsPage.assertVariableNotExist('job');
    persesDashboardsPage.assertVariableNotExist('instance');

    cy.log(`6.11. Delete Panel`);
    persesDashboardsPanel.deletePanel('Up');
    persesDashboardsPanel.clickDeletePanelButton();

    cy.log(`6.12. Delete Panel Group`);
    persesDashboardsPanelGroup.clickPanelGroupAction('Panel Group Up', 'delete');
    persesDashboardsPanelGroup.clickDeletePanelGroupButton();
    persesDashboardsPage.clickEditActionButton('Save');

    cy.get('h2').contains(persesDashboardsEmptyDashboard.TITLE).scrollIntoView().should('be.visible');
    cy.get('p').contains(persesDashboardsEmptyDashboard.DESCRIPTION).scrollIntoView().should('be.visible');

    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`6.13. Filter by Name`);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`6.14. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`6.15. Filter by Name`);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('0');
    listPersesDashboardsPage.clearAllFilters();

  });

}
