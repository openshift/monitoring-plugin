import { listPersesDashboardsPage } from "../../views/perses-dashboards-list-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesDashboardsAddListPanelType, persesDashboardSampleQueries, persesDashboardsEmptyDashboard } from '../../fixtures/perses/constants';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesDashboardsPanelGroup } from "../../views/perses-dashboards-panelgroup";
import { persesDashboardsPanel } from "../../views/perses-dashboards-panel";
import { persesDashboardsEditVariables } from "../../views/perses-dashboards-edit-variables";
import { persesDashboardsAddListVariableSource } from "../../fixtures/perses/constants";

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOOCreatePersesTests(perspective: PerspectiveConfig) {
  testCOOCreatePerses(perspective);
}

export function testCOOCreatePerses(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - Create Dashboard validation with max length`, () => {
    let dashboardName = 'Test Dashboard';
    let randomSuffix = Math.random().toString(5);
    dashboardName += randomSuffix;
    cy.log(`1.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`1.2. Click on Create button`);
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();

    cy.log(`1.3. Verify Project dropdown`);
    persesCreateDashboardsPage.assertProjectDropdown('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.assertProjectDropdown('observ-test');
    persesCreateDashboardsPage.assertProjectDropdown('perses-dev');

    cy.log(`1.4. Verify Max Length Validation`);
    persesCreateDashboardsPage.selectProject('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.enterDashboardName('1234567890123456789012345678901234567890123456789012345678901234567890123456');
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesCreateDashboardsPage.assertMaxLengthValidation();

    cy.log(`1.5. Verify Name input`);
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);
    persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();
    
  });

  it(`2.${perspective.name} perspective - Create Dashboard with duplicated name in the same project`, () => {
    //dashboard name with spaces
    let dashboardName = 'Dashboard to test duplication';
    let randomSuffix = Math.random().toString(5);
    dashboardName += randomSuffix;
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.2. Click on Create button`);
    listPersesDashboardsPage.clickCreateButton();
    
    cy.log(`2.3. Verify Project dropdown`);
    persesCreateDashboardsPage.selectProject('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);
    persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();

    cy.log(`2.4. Create another dashboard with the same name`);
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.selectProject('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesCreateDashboardsPage.assertDuplicatedNameValidation(dashboardName);

    //dashboard name without spaces
    cy.log(`2.5. Create another dashboard with the same name without spaces`);
    dashboardName = 'DashboardToTestDuplication';
    dashboardName += randomSuffix;
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);
    persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();

    cy.log(`2.6. Create another dashboard with the same name without spaces`);
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.selectProject('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesCreateDashboardsPage.assertDuplicatedNameValidation(dashboardName);
    
    cy.log(`2.7. Create another dashboard with the same name in other project`);
    persesCreateDashboardsPage.selectProject('perses-dev');
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);
    persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();

  });

  it(`3.${perspective.name} perspective - Create Dashboard with panel groups, panels and variables`, () => {
    let dashboardName = 'Testing Dashboard - UP ';
    let randomSuffix = Math.random().toString(5);
    dashboardName += randomSuffix;
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`3.2. Click on Create button`);
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();

    cy.log(`3.3. Create Dashboard`);
    persesCreateDashboardsPage.selectProject('perses-dev');
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);
    persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();

    cy.log(`3.4. Add Variable`);
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

    cy.log(`3.5. Add Panel Group`);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('AddGroup');
    persesDashboardsPanelGroup.addPanelGroup('Panel Group Up', 'Open', '');

    cy.log(`3.6. Add Panel`);
    persesDashboardsPage.clickEditActionButton('AddPanel');
    persesDashboardsPanel.addPanelShouldBeLoaded();
    persesDashboardsPanel.addPanel('Up', 'Panel Group Up', persesDashboardsAddListPanelType.TIME_SERIES_CHART, 'This is a line chart test', 'up');
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`3.7. Back and check panel`);
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.clickDashboard(dashboardName);
    persesDashboardsPage.panelGroupHeaderAssertion('Panel Group Up', 'Open');
    persesDashboardsPage.assertPanel('Up', 'Panel Group Up', 'Open');
    persesDashboardsPage.assertVariableBeVisible('interval');
    persesDashboardsPage.assertVariableBeVisible('job');
    persesDashboardsPage.assertVariableBeVisible('instance');
    
    cy.log(`3.8. Click on Edit button`);
    persesDashboardsPage.clickEditButton();

    cy.log(`3.9. Click on Edit Variables button and Delete all variables`);
    persesDashboardsPage.clickEditActionButton('EditVariables');
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`3.10. Assert variables not exist`);
    persesDashboardsPage.assertVariableNotExist('interval');
    persesDashboardsPage.assertVariableNotExist('job');
    persesDashboardsPage.assertVariableNotExist('instance');

    cy.log(`3.11. Delete Panel`);
    persesDashboardsPanel.deletePanel('Up');
    persesDashboardsPanel.clickDeletePanelButton();

    cy.log(`3.12. Delete Panel Group`);
    persesDashboardsPanelGroup.clickPanelGroupAction('Panel Group Up', 'delete');
    persesDashboardsPanelGroup.clickDeletePanelGroupButton();
    persesDashboardsPage.clickEditActionButton('Save');

    cy.get('h2').contains(persesDashboardsEmptyDashboard.TITLE).scrollIntoView().should('be.visible');
    cy.get('p').contains(persesDashboardsEmptyDashboard.DESCRIPTION).scrollIntoView().should('be.visible');

  });

  //TODO: Verify Create project dropdown not only showing perses projects, but all namespaces you have access to, independently of having perses object (that creates a perses project)
  // it(`4.${perspective.name} perspective - Verify Create project dropdown not only showing perses projects, but all namespaces you have access to, independently of having perses object (that creates a perses project)`, () => {
    // cy.log(`4.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    // listPersesDashboardsPage.shouldBeLoaded();

    // cy.log(`4.2. Click on Create button`);
    // listPersesDashboardsPage.clickCreateButton();
    // persesCreateDashboardsPage.createDashboardShouldBeLoaded();

    // cy.log(`4.3. Verify Project dropdown`);
    // persesCreateDashboardsPage.assertProjectDropdown('openshift-cluster-observability-operator');
    // openshift-monitoringas an example of a namespace that you have access to and does not have any perses object created yet, but you are able to create a dashboard
    // persesCreateDashboardsPage.assertProjectDropdown('openshift-monitoring);

  // });

}