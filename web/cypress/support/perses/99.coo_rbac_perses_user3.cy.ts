import { persesDashboardsPage } from '../../views/perses-dashboards';
import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesDashboardsAddListVariableSource, persesDashboardSampleQueries, persesDashboardsEmptyDashboard, persesDashboardsTimeRange } from '../../fixtures/perses/constants';
import { persesDashboardsEditVariables } from '../../views/perses-dashboards-edit-variables';
import { persesDashboardsPanelGroup } from '../../views/perses-dashboards-panelgroup';
import { persesDashboardsPanel } from '../../views/perses-dashboards-panel';
import { persesDashboardsAddListPanelType } from '../../fixtures/perses/constants';
import { persesImportDashboardsPage } from '../../views/perses-dashboards-import-dashboard';
import { nav } from '../../views/nav';
import { persesAriaLabels } from '../../../src/components/data-test';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOORBACPersesTestsDevUser3(perspective: PerspectiveConfig) {
  testCOORBACPersesTestsDevUser3(perspective);
}

let dashboardName = 'Testing Dashboard - UP ';
let randomSuffix = Math.random().toString(5);
dashboardName += randomSuffix;

/**
 * User3 has access to:
 * - empty-namespace3 namespace as persesdashboard-editor-role and persesdatasource-editor-role
 * - no access to openshift-cluster-observability-operator, observ-test, perses-dev namespaces, empty-namespace4 namespaces
 * - openshift-monitoring namespace as view role
 */
export function testCOORBACPersesTestsDevUser3(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - List Dashboards - Namespace validation and Dashboard search`, () => {
    cy.log(`1.1. Namespace validation`);
    listPersesDashboardsPage.noDashboardsFoundState();
    cy.assertNamespace('All Projects', true);
    cy.assertNamespace('openshift-cluster-observability-operator', false);
    cy.assertNamespace('observ-test', false);
    cy.assertNamespace('perses-dev', false);
    cy.assertNamespace('empty-namespace3', true);
    cy.assertNamespace('empty-namespace4', false);
    cy.assertNamespace('openshift-monitoring', true);

    cy.log(`1.2. All Projects validation - Dashboard search - empty state`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.noDashboardsFoundState();
    listPersesDashboardsPage.assertCreateButtonIsEnabled();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.assertProjectDropdown('empty-namespace3');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('observ-test');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('perses-dev');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-monitoring');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace4');
    persesCreateDashboardsPage.createDashboardDialogCancelButton();

    cy.log(`1.3. empty-namespace3 validation - Dashboard search - empty state`);
    cy.changeNamespace('empty-namespace3');
    listPersesDashboardsPage.noDashboardsFoundState();
    listPersesDashboardsPage.assertCreateButtonIsEnabled();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.assertProjectDropdown('empty-namespace3');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('observ-test');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('perses-dev');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-monitoring');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace4');
    persesCreateDashboardsPage.createDashboardDialogCancelButton();

    cy.log(`1.4. openshift-monitoring validation - Dashboard search - empty state`);
    cy.changeNamespace('openshift-monitoring');
    listPersesDashboardsPage.noDashboardsFoundState();
    listPersesDashboardsPage.assertCreateButtonIsEnabled();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.assertProjectDropdown('empty-namespace3');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('observ-test');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('perses-dev');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-monitoring');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace4');
    persesCreateDashboardsPage.createDashboardDialogCancelButton();

  });

  /**
   * When we have admin permission or editor permission to at least one namespace, 
   * the Create button is always enabled and Select project dropdown is filtering out namespaces that we do not have access to
   */
  it(`2.${perspective.name} perspective - Create button validation - Disabled / Enabled`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`2.2 change namespace to empty-namespace3`);
    cy.changeNamespace('empty-namespace3');

    cy.log(`2.3. Verify Create button is still enabled`);
    listPersesDashboardsPage.assertCreateButtonIsEnabled();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.assertProjectDropdown('empty-namespace3');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('observ-test');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('perses-dev');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('openshift-monitoring');
    persesCreateDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace4');
    persesCreateDashboardsPage.createDashboardDialogCancelButton();

    cy.log(`2.4 change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');

    cy.log(`2.5. Verify Create button is enabled`);
    listPersesDashboardsPage.assertCreateButtonIsEnabled();

    cy.log(`2.6 change namespace to All Projects`);
    cy.changeNamespace('All Projects');

    cy.log(`2.7. Verify Create button is enabled`);
    listPersesDashboardsPage.assertCreateButtonIsEnabled();

  });

  it(`3.${perspective.name} perspective - Create Dashboard with panel groups, panels and variables`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.changeNamespace('openshift-monitoring');

    cy.log(`3.2. Click on Create button`);
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();

    cy.log(`3.3. Create Dashboard`);
    persesCreateDashboardsPage.selectProject('empty-namespace3');
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
    cy.changeNamespace('empty-namespace3');
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
   
  it(`4.${perspective.name} perspective - Kebab icon - Enabled / Disabled`, () => {
    cy.log(`4.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`4.2. Change namespace to empty-namespace3`);
    cy.changeNamespace('empty-namespace3');

    cy.log(`4.3. Assert Kebab icon is enabled `);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.assertKebabIconOptions();
    listPersesDashboardsPage.clickKebabIcon();

    cy.log(`4.4. Change namespace to All Projects`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`4.5. Filter by Project and Name`);
    listPersesDashboardsPage.filter.byProject('empty-namespace3');
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.assertKebabIconOptions();
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clearAllFilters();

  });


  it(`5.${perspective.name} perspective - Rename to a new dashboard name`, () => {
    let renamedDashboardName = 'Renamed dashboard ';
    let randomSuffix = Math.random().toString(5);
    renamedDashboardName += randomSuffix;

    cy.log(`5.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`5.2. Change namespace to empty-namespace3`);
    cy.changeNamespace('empty-namespace3');

    cy.log(`5.3. Filter by Name`);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');
    
    cy.log(`5.4. Click on the Kebab icon - Rename`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(renamedDashboardName);
    listPersesDashboardsPage.renameDashboardRenameButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`5.5. Filter by Name`);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    listPersesDashboardsPage.filter.byName(renamedDashboardName);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickDashboard(renamedDashboardName);
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.shouldBeLoadedAfterRename(renamedDashboardName);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`5.6. Rename back to the original name`);
    cy.changeNamespace('empty-namespace3');
    listPersesDashboardsPage.filter.byName(renamedDashboardName);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(dashboardName);
    listPersesDashboardsPage.renameDashboardRenameButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');
    
    cy.log(`5.7. Filter by Name`);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickDashboard(dashboardName);
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.shouldBeLoadedAfterRename(dashboardName);
    persesDashboardsPage.backToListPersesDashboardsPage();
    
  });

  it(`6.${perspective.name} perspective - Duplicate and verify project dropdown and Delete`, () => {
    let duplicatedDashboardName = 'Duplicate dashboard ';
    let randomSuffix = Math.random().toString(5);
    duplicatedDashboardName += randomSuffix;

    cy.log(`6.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`6.2. Change namespace to empty-namespace3`);
    cy.changeNamespace('empty-namespace3');

    cy.log(`6.3. Filter by Name`);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');
    
    cy.log(`6.4. Click on the Kebab icon - Duplicate`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDuplicateOption();

    cy.log(`6.5. Assert project dropdown options`);
    listPersesDashboardsPage.assertDuplicateProjectDropdownExists('empty-namespace3');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('openshift-cluster-observability-operator');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('openshift-monitoring');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('observ-test');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('perses-dev');
    listPersesDashboardsPage.assertDuplicateProjectDropdownNotExists('empty-namespace4');

    cy.log(`6.6. Enter new dashboard name`);
    listPersesDashboardsPage.duplicateDashboardEnterName(duplicatedDashboardName);
    listPersesDashboardsPage.duplicateDashboardSelectProjectDropdown('empty-namespace3');
    listPersesDashboardsPage.duplicateDashboardDuplicateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(duplicatedDashboardName);
    persesDashboardsPage.shouldBeLoadedAfterDuplicate(duplicatedDashboardName);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`6.7. Filter by Name`);
    listPersesDashboardsPage.filter.byName(duplicatedDashboardName);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`6.8. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    persesDashboardsPage.closeSuccessAlert();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`6.9. Filter by Name`);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    listPersesDashboardsPage.filter.byName(duplicatedDashboardName);
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);

  });

  it(`7.${perspective.name} perspective - Delete dashboard`, () => {
    cy.log(`7.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`7.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`7.3. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`7.4. Filter by Name`);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
  });

  it(`8.${perspective.name} perspective - Import button validation - Enabled / Disabled`, () => {
    cy.log(`8.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`8.2 change namespace to empty-namespace3`);
    cy.changeNamespace('empty-namespace3');

    cy.log(`8.3. Verify Import button is still enabled`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.json');
    persesImportDashboardsPage.assertPersesDashboardDetected();

    cy.log(`8.4. Verify project dropdown options`);
    persesImportDashboardsPage.assertProjectDropdown('empty-namespace3');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('openshift-cluster-observability-operator');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('observ-test');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('perses-dev');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('openshift-monitoring');
    persesImportDashboardsPage.assertProjectNotExistsInDropdown('empty-namespace4');
    persesImportDashboardsPage.clickCancelButton();
  
    cy.log(`8.5 change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');

    cy.log(`8.6. Verify Import button is enabled`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();

    cy.log(`8.7 change namespace to All Projects`);
    cy.changeNamespace('All Projects');

    cy.log(`8.8. Verify Import button is enabled`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
  });

  it(`9.${perspective.name} perspective - Import button validation - YAML`, () => {
    cy.log(`9.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`9.2 change namespace to empty-namespace3`);
    cy.changeNamespace('empty-namespace3');

    cy.log(`9.3. Verify Import button is still enabled`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.yaml');
    persesImportDashboardsPage.assertPersesDashboardDetected();

    cy.log(`9.4. Select a project`);
    persesImportDashboardsPage.selectProject('empty-namespace3');

    cy.log(`9.5. Import dashboard`);
    persesImportDashboardsPage.clickImportFileButton();
    persesDashboardsPage.closeSuccessAlert();

    cy.log(`9.6. Assert dashboard is imported`);
    persesDashboardsPage.shouldBeLoadedEditionMode('Testing Perses dashboard - YAML');
    cy.byAriaLabel(persesAriaLabels.TimeRangeDropdown).contains(persesDashboardsTimeRange.LAST_30_MINUTES).scrollIntoView().should('be.visible');

    cy.log(`9.7. Back to list of dashboards`);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`9.8. Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Perses dashboard - YAML');
    listPersesDashboardsPage.countDashboards('1');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);

    cy.log(`9.9. Import the same dashboard - Duplicated error`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.yaml');
    persesImportDashboardsPage.assertPersesDashboardDetected();
    persesImportDashboardsPage.selectProject('empty-namespace3');
    persesImportDashboardsPage.clickImportFileButton();
    persesImportDashboardsPage.assertDuplicatedDashboardError();
    persesImportDashboardsPage.clickCancelButton();

    cy.log(`9.10. Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Perses dashboard - YAML');
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);

    cy.log(`9.11. Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Perses dashboard - YAML');
    listPersesDashboardsPage.countDashboards('0');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
  });


}
