import { persesDashboardsPage } from '../../views/perses-dashboards';
import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesDashboardsAddListVariableSource, persesDashboardSampleQueries, persesDashboardsEmptyDashboard } from '../../fixtures/perses/constants';
import { persesDashboardsEditVariables } from '../../views/perses-dashboards-edit-variables';
import { persesDashboardsPanelGroup } from '../../views/perses-dashboards-panelgroup';
import { persesDashboardsPanel } from '../../views/perses-dashboards-panel';
import { persesDashboardsAddListPanelType } from '../../fixtures/perses/constants';
import { persesImportDashboardsPage } from '../../views/perses-dashboards-import-dashboard';
import { nav } from '../../views/nav';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOORBACPersesTestsDevUser5(perspective: PerspectiveConfig) {
  testCOORBACPersesTestsDevUser5(perspective);
}

let dashboardName = 'Testing Dashboard - UP ';
let randomSuffix = Math.random().toString(5);
dashboardName += randomSuffix;

/**
 * User5 has access to:
 * - openshift-monitoring namespace as admin
 * - no access to openshift-cluster-observability-operator, observ-test, perses-dev namespaces, empty-namespace3 namespaces, empty-namespace4 namespaces
 */
export function testCOORBACPersesTestsDevUser5(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - List Dashboards - Namespace validation and Dashboard search`, () => {
    cy.log(`1.1. Namespace validation`);
    listPersesDashboardsPage.noDashboardsFoundState();
    cy.assertNamespace('All Projects', true);
    cy.assertNamespace('openshift-monitoring', true);
    cy.assertNamespace('openshift-cluster-observability-operator', false);
    cy.assertNamespace('observ-test', false);
    cy.assertNamespace('perses-dev', false);
    cy.assertNamespace('empty-namespace3', false);
    cy.assertNamespace('empty-namespace4', false);

    cy.log(`1.2. All Projects validation - Dashboard search - empty state`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.noDashboardsFoundState();
    listPersesDashboardsPage.assertCreateButtonIsEnabled();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.assertProjectDropdown('openshift-monitoring');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('observ-test');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('perses-dev');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace3');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace4');
    persesCreateDashboardsPage.createDashboardDialogCancelButton();

    cy.log(`1.3. openshift-monitoring validation - Dashboard search - empty state`);
    cy.changeNamespace('openshift-monitoring');
    listPersesDashboardsPage.noDashboardsFoundState();
    listPersesDashboardsPage.assertCreateButtonIsEnabled();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.assertProjectDropdown('openshift-monitoring');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('observ-test');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('perses-dev');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace3');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace4');
    persesCreateDashboardsPage.createDashboardDialogCancelButton();

  });

  it(`2.${perspective.name} perspective - Create Dashboard with panel groups, panels and variables`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.changeNamespace('openshift-monitoring');

    cy.log(`2.2. Click on Create button`);
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();

    cy.log(`2.3. Create Dashboard`);
    persesCreateDashboardsPage.selectProject('openshift-monitoring');
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);
    persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();

    cy.log(`2.4. Add Variable`);
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

    cy.log(`2.5. Add Panel Group`);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('AddGroup');
    persesDashboardsPanelGroup.addPanelGroup('Panel Group Up', 'Open', '');

    cy.log(`2.6. Add Panel`);
    persesDashboardsPage.clickEditActionButton('AddPanel');
    persesDashboardsPanel.addPanelShouldBeLoaded();
    persesDashboardsPanel.addPanel('Up', 'Panel Group Up', persesDashboardsAddListPanelType.TIME_SERIES_CHART, 'This is a line chart test', 'up');
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`2.7. Back and check panel`);
    persesDashboardsPage.backToListPersesDashboardsPage();
    cy.changeNamespace('openshift-monitoring');
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.clickDashboard(dashboardName);
    persesDashboardsPage.panelGroupHeaderAssertion('Panel Group Up', 'Open');
    persesDashboardsPage.assertPanel('Up', 'Panel Group Up', 'Open');
    persesDashboardsPage.assertVariableBeVisible('interval');
    persesDashboardsPage.assertVariableBeVisible('job');
    persesDashboardsPage.assertVariableBeVisible('instance');
    
    cy.log(`2.8. Click on Edit button`);
    persesDashboardsPage.clickEditButton();

    cy.log(`2.9. Click on Edit Variables button and Delete all variables`);
    persesDashboardsPage.clickEditActionButton('EditVariables');
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`2.10. Assert variables not exist`);
    persesDashboardsPage.assertVariableNotExist('interval');
    persesDashboardsPage.assertVariableNotExist('job');
    persesDashboardsPage.assertVariableNotExist('instance');

    cy.log(`2.11. Delete Panel`);
    persesDashboardsPanel.deletePanel('Up');
    persesDashboardsPanel.clickDeletePanelButton();

    cy.log(`2.12. Delete Panel Group`);
    persesDashboardsPanelGroup.clickPanelGroupAction('Panel Group Up', 'delete');
    persesDashboardsPanelGroup.clickDeletePanelGroupButton();
    persesDashboardsPage.clickEditActionButton('Save');

    cy.get('h2').contains(persesDashboardsEmptyDashboard.TITLE).scrollIntoView().should('be.visible');
    cy.get('p').contains(persesDashboardsEmptyDashboard.DESCRIPTION).scrollIntoView().should('be.visible');

  });
   
  it(`3.${perspective.name} perspective - Kebab icon - Enabled / Disabled`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`3.2. Change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');

    cy.log(`3.3. Assert Kebab icon is enabled `);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.assertKebabIconOptions();
    listPersesDashboardsPage.clickKebabIcon();

    cy.log(`3.4. Change namespace to All Projects`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`3.5. Filter by Project and Name`);
    listPersesDashboardsPage.filter.byProject('openshift-monitoring');
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.assertKebabIconOptions();
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clearAllFilters();

  });


  it(`4.${perspective.name} perspective - Rename to a new dashboard name`, () => {
    let renamedDashboardName = 'Renamed dashboard ';
    let randomSuffix = Math.random().toString(5);
    renamedDashboardName += randomSuffix;

    cy.log(`4.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`4.2. Change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');

    cy.log(`4.3. Filter by Name`);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');
    
    cy.log(`4.4. Click on the Kebab icon - Rename`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(renamedDashboardName);
    listPersesDashboardsPage.renameDashboardRenameButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.wait(5000);

    cy.log(`4.5. Filter by Name`);
    listPersesDashboardsPage.filter.byName(renamedDashboardName);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickDashboard(renamedDashboardName);
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.shouldBeLoadedAfterRename(renamedDashboardName);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`4.6. Rename back to the original name`);
    cy.changeNamespace('openshift-monitoring');
    listPersesDashboardsPage.filter.byName(renamedDashboardName);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(dashboardName);
    listPersesDashboardsPage.renameDashboardRenameButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.wait(5000);
    
    cy.log(`4.7. Filter by Name`);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickDashboard(dashboardName);
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.shouldBeLoadedAfterRename(dashboardName);
    persesDashboardsPage.backToListPersesDashboardsPage();
    
  });

  it(`5.${perspective.name} perspective - Duplicate and verify project dropdown and Delete`, () => {
    let duplicatedDashboardName = 'Duplicate dashboard ';
    let randomSuffix = Math.random().toString(5);
    duplicatedDashboardName += randomSuffix;

    cy.log(`5.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`5.2. Change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');

    cy.log(`5.3. Filter by Name`);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');
    
    cy.log(`5.4. Click on the Kebab icon - Duplicate`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDuplicateOption();

    cy.log(`5.5. Assert project dropdown options`);
    listPersesDashboardsPage.assertDuplicateProjectDropdownExists('openshift-monitoring');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('openshift-cluster-observability-operator');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('empty-namespace3');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('observ-test');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('perses-dev');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('empty-namespace4');

    cy.log(`5.6. Enter new dashboard name`);
    listPersesDashboardsPage.duplicateDashboardEnterName(duplicatedDashboardName);
    listPersesDashboardsPage.duplicateDashboardSelectProjectDropdown('openshift-monitoring');
    listPersesDashboardsPage.duplicateDashboardDuplicateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(duplicatedDashboardName);
    persesDashboardsPage.shouldBeLoadedAfterDuplicate(duplicatedDashboardName);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`5.7. Filter by Name`);
    listPersesDashboardsPage.filter.byName(duplicatedDashboardName);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`5.8. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);

    cy.log(`5.9. Filter by Name`);
    listPersesDashboardsPage.filter.byName(duplicatedDashboardName);
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);

  });

  it(`6.${perspective.name} perspective - Delete dashboard`, () => {
    cy.log(`6.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`6.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Dashboard - UP');
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`6.3. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);

    cy.log(`6.4. Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Dashboard - UP');
    listPersesDashboardsPage.countDashboards('0');
    listPersesDashboardsPage.clearAllFilters();

  });

  it(`7.${perspective.name} perspective - Import button validation - Enabled / Disabled`, () => {
    cy.log(`7.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`7.2 change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');

    cy.log(`7.3. Verify Import button is still enabled`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.json');
    persesImportDashboardsPage.assertPersesDashboardDetected();
    
    cy.log(`7.4. Verify project dropdown options`);
    persesImportDashboardsPage.assertProjectDropdown('openshift-monitoring');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('openshift-cluster-observability-operator');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace3');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('observ-test');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('perses-dev');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace4');
    persesImportDashboardsPage.clickCancelButton();
    
    cy.log(`7.5. Change namespace to All Projects`);
    cy.changeNamespace('All Projects');

    cy.log(`7.6. Verify Import button is enabled`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
  });

  it(`8.${perspective.name} perspective - Import button validation - JSON`, () => {
    cy.log(`8.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`8.2 change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');

    cy.log(`8.3. Verify Import button is enabled`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.json');
    persesImportDashboardsPage.assertPersesDashboardDetected();

    cy.log(`8.4. Select a project`);
    persesImportDashboardsPage.selectProject('openshift-monitoring');

    cy.log(`8.5. Import dashboard`);
    persesImportDashboardsPage.clickImportFileButton();
    persesDashboardsPage.closeSuccessAlert();

    cy.log(`8.6. Assert dashboard is imported`);
    persesDashboardsPage.shouldBeLoadedEditionMode('Testing Perses dashboard - JSON');

    cy.log(`8.7. Back to list of dashboards`);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`8.8. Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Perses dashboard - JSON');
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clearAllFilters();
    cy.wait(2000);
    
    cy.log(`8.9. Import the same dashboard - Duplicated error`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.json');
    persesImportDashboardsPage.assertPersesDashboardDetected();
    persesImportDashboardsPage.selectProject('openshift-monitoring');
    persesImportDashboardsPage.clickImportFileButton();
    persesImportDashboardsPage.assertDuplicatedDashboardError();
    persesImportDashboardsPage.clickCancelButton();

    cy.log(`8.10. Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Perses dashboard - JSON');
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.wait(2000);

    cy.log(`8.11. Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Perses dashboard - JSON');
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.wait(2000);
  });


}
