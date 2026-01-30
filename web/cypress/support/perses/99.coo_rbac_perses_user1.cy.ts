import { persesDashboardsPage } from '../../views/perses-dashboards';
import { listPersesDashboardsPage } from '../../views/list-perses-dashboards';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesDashboardsAddListVariableSource, persesDashboardSampleQueries, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev, persesDashboardsEmptyDashboard } from '../../fixtures/perses/constants';
import { persesDashboardsEditVariables } from '../../views/perses-dashboards-edit-variables';
import { persesDashboardsPanelGroup } from '../../views/perses-dashboards-panelgroup';
import { persesAriaLabels } from '../../../src/components/data-test';
import { persesDashboardsPanel } from '../../views/perses-dashboards-panel';
import { persesDashboardsAddListPanelType } from '../../fixtures/perses/constants';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOORBACPersesTestsDevUser1(perspective: PerspectiveConfig) {
  testCOORBACPersesTestsDevUser1(perspective);
}

/**
 * User1 has access to:
 * - openshift-cluster-observability-operator namespace as persesdashboard-editor-role and persesdatasource-editor-role
 * - observ-test namespace as persesdashboard-viewer-role and persesdatasource-viewer-role
 * - no access to perses-dev namespace
 */
export function testCOORBACPersesTestsDevUser1(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - List Dashboards - Namespace validation and Dashboard search`, () => {
    cy.log(`1.1. Namespace validation`);
    listPersesDashboardsPage.shouldBeLoaded();
    cy.assertNamespace('All Projects', true);
    cy.assertNamespace('openshift-cluster-observability-operator', true);
    cy.assertNamespace('observ-test', true);
    cy.assertNamespace('perses-dev', false);

    cy.log(`1.2. All Projects validation - Dashboard search - ${persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2]} dashboard`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2]);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.removeTag(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2]);

    cy.log(`1.3. All Projects validation - Dashboard search - ${persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]} dashboard`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.countDashboards('2');
    listPersesDashboardsPage.removeTag(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);

    cy.log(`1.4. All Projects validation - Dashboard search - ${persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]} dashboard`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.removeTag(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.removeTag('perses-dev');

  });

  it(`2.${perspective.name} perspective - Edit button validation - Editable dashboard`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.2 change namespace to openshift-cluster-observability-operator`);
    cy.changeNamespace('openshift-cluster-observability-operator');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.3. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`2.4. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    persesDashboardsPage.shouldBeLoaded1();

    cy.log(`2.5. Click on Edit button`);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.assertEditModeButtons();
    persesDashboardsPage.assertEditModePanelGroupButtons('Headlines');
    //already expanded
    persesDashboardsPage.assertPanelActionButtons('CPU Usage');
    // tiny panel and modal is opened. So, expand first and then assert the buttons and finally collapse
    // due to modal is opened and page is refreshed, it is not easy to assert buttons in the modal
    persesDashboardsPage.assertPanelActionButtons('CPU Utilisation');

    cy.log(`2.6. Click on Edit Variables button - Add components`);
    persesDashboardsPage.clickEditActionButton('EditVariables');
    persesDashboardsEditVariables.clickButton('Add Variable');
    //https://issues.redhat.com/browse/OU-1159 - Custom All Value is not working
    persesDashboardsEditVariables.addListVariable('ListVariable', true, true, 'AAA', 'Test', 'Test', undefined, undefined);

    cy.log(`2.7. Add variable`);
    persesDashboardsEditVariables.clickButton('Add');

    cy.log(`2.8. Apply changes`);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`2.9. Assert Variable before saving`);
    persesDashboardsPage.searchAndSelectVariable('ListVariable', 'All');

    cy.log(`2.10. Click on Add Panel Group button`);
    persesDashboardsPage.clickEditActionButton('AddGroup');
    persesDashboardsPanelGroup.addPanelGroup('PanelGroup Perform Changes and Save', 'Open', '');

    cy.log(`2.11. Click on Add Panel button`);
    persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup Perform Changes and Save', 'addPanel');
    persesDashboardsPanel.addPanel('Panel Perform Changes and Save', 'PanelGroup Perform Changes and Save', persesDashboardsAddListPanelType.TIME_SERIES_CHART, undefined, 'up');
    cy.wait(2000);

    cy.log(`2.13. Click on Save button`);
    persesDashboardsPage.clickEditActionButton('Save');
    cy.wait(2000);

    cy.log(`2.14. Assert Panel with Data - Export Time Series Data As CSV button is visible and clickable `);
    cy.wait(2000);
    cy.byAriaLabel(persesAriaLabels.PanelExportTimeSeriesDataAsCSV).eq(0).click({ force: true });
    cy.wait(1000);
    persesDashboardsPage.assertFilename('panelPerformChangesAndSave_data.csv');

    cy.wait(2000);

    cy.log(`2.15. Back and check changes`);
    persesDashboardsPage.backToListPersesDashboardsPage();
    cy.changeNamespace('openshift-cluster-observability-operator');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.searchAndSelectVariable('ListVariable', 'All');
    persesDashboardsPage.panelGroupHeaderAssertion('PanelGroup Perform Changes and Save', 'Open');
    persesDashboardsPage.assertPanel('Panel Perform Changes and Save', 'PanelGroup Perform Changes and Save', 'Open');

    cy.log(`2.16. Click on Edit Variables button - Delete components`);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('EditVariables');
    persesDashboardsEditVariables.clickDeleteVariableButton(1);
    persesDashboardsEditVariables.clickButton('Apply');
    persesDashboardsPage.assertVariableNotExist('ListVariable');

    cy.log(`2.17. Click on Delete Panel button`);
    persesDashboardsPanel.deletePanel('Panel Perform Changes and Save');
    persesDashboardsPanel.clickDeletePanelButton();

    cy.log(`2.18. Click on Delete Panel Group button`);
    persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup Perform Changes and Save', 'delete');
    persesDashboardsPanelGroup.clickDeletePanelGroupButton();
    persesDashboardsPage.clickEditActionButton('Save');
    persesDashboardsPage.assertPanelGroupNotExist('PanelGroup Perform Changes and Save');
    persesDashboardsPage.assertPanelNotExist('Panel Perform Changes and Save'); 
    persesDashboardsPage.assertVariableNotExist('ListVariable');

  });

  it(`3.${perspective.name} perspective - Edit button validation - Not editable dashboard`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`3.2 change namespace to observ-test`);
    cy.changeNamespace('observ-test');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`3.3. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`3.4. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    persesDashboardsPage.shouldBeLoaded1();

    cy.log(`3.5. Verify Edit button is not editable`);
    persesDashboardsPage.assertEditButtonIsDisabled();

  });

  it(`4.${perspective.name} perspective - Create button validation - Disabled / Enabled`, () => {
    cy.log(`4.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`4.2 change namespace to observ-test`);
    cy.changeNamespace('observ-test');

    cy.log(`4.3. Verify Create button is disabled`);
    persesDashboardsPage.assertCreateButtonIsDisabled();

    cy.log(`4.4 change namespace to openshift-cluster-observability-operator`);
    cy.changeNamespace('openshift-cluster-observability-operator');

    cy.log(`4.5. Verify Create button is enabled`);
    persesDashboardsPage.assertCreateButtonIsEnabled();

    cy.log(`4.2 change namespace to All Projects`);
    cy.changeNamespace('All Projects');

    cy.log(`4.3. Verify Create button is enabled`);
    persesDashboardsPage.assertCreateButtonIsEnabled();

  });

  it(`5.${perspective.name} perspective - Create Dashboard with panel groups, panels and variables`, () => {
    let dashboardName = 'Testing Dashboard - UP ';
    let randomSuffix = Math.random().toString(5);
    dashboardName += randomSuffix;
    cy.log(`5.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    //TODO: uncomment when but gets fixed
    cy.changeNamespace('openshift-cluster-observability-operator');

    cy.log(`5.2. Click on Create button`);
    persesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();

    cy.log(`5.3. Create Dashboard`);
    persesCreateDashboardsPage.selectProject('openshift-cluster-observability-operator');
    persesCreateDashboardsPage.enterDashboardName(dashboardName);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);

    cy.log(`5.4. Add Variable`);
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

    cy.log(`5.5. Add Panel Group`);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('AddGroup');
    persesDashboardsPanelGroup.addPanelGroup('Panel Group Up', 'Open', '');

    cy.log(`5.6. Add Panel`);
    persesDashboardsPage.clickEditActionButton('AddPanel');
    persesDashboardsPanel.addPanelShouldBeLoaded();
    persesDashboardsPanel.addPanel('Up', 'Panel Group Up', persesDashboardsAddListPanelType.TIME_SERIES_CHART, 'This is a line chart test', 'up');
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`5.7. Back and check panel`);
    persesDashboardsPage.backToListPersesDashboardsPage();
    cy.changeNamespace('openshift-cluster-observability-operator');
    listPersesDashboardsPage.filter.byName(dashboardName.toLowerCase().replace(/ /g, '_'));
    listPersesDashboardsPage.clickDashboard(dashboardName.toLowerCase().replace(/ /g, '_'));
    persesDashboardsPage.panelGroupHeaderAssertion('Panel Group Up', 'Open');
    persesDashboardsPage.assertPanel('Up', 'Panel Group Up', 'Open');
    persesDashboardsPage.assertVariableBeVisible('interval');
    persesDashboardsPage.assertVariableBeVisible('job');
    persesDashboardsPage.assertVariableBeVisible('instance');
    
    cy.log(`5.8. Click on Edit button`);
    persesDashboardsPage.clickEditButton();

    cy.log(`5.9. Click on Edit Variables button and Delete all variables`);
    persesDashboardsPage.clickEditActionButton('EditVariables');
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`5.10. Assert variables not exist`);
    persesDashboardsPage.assertVariableNotExist('interval');
    persesDashboardsPage.assertVariableNotExist('job');
    persesDashboardsPage.assertVariableNotExist('instance');

    cy.log(`5.11. Delete Panel`);
    persesDashboardsPanel.deletePanel('Up');
    persesDashboardsPanel.clickDeletePanelButton();

    cy.log(`5.12. Delete Panel Group`);
    persesDashboardsPanelGroup.clickPanelGroupAction('Panel Group Up', 'delete');
    persesDashboardsPanelGroup.clickDeletePanelGroupButton();
    persesDashboardsPage.clickEditActionButton('Save');

    cy.get('h2').contains(persesDashboardsEmptyDashboard.TITLE).scrollIntoView().should('be.visible');
    cy.get('p').contains(persesDashboardsEmptyDashboard.DESCRIPTION).scrollIntoView().should('be.visible');

  });

  // it(`6.${perspective.name} perspective - Kebab icon - Enabled / Disabled`, () => {
  //   // Enabled for openshift-cluster-observability-operator namespace
  //     // Rename
  //     // Duplicate
  //     // Delete
  //   // Disabled for observ-test namespace or enabled but with options disabled
  //     // Rename
  //     // Duplicate
  //     // Delete
  // });

  // it(`7.${perspective.name} perspective - Rename to an existing dashboard name with spaces`, () => {
  //  
  // });

  // it(`8.${perspective.name} perspective - Rename to an existing dashboard name without spaces`, () => {
  //   
  // });

  // it(`8.${perspective.name} perspective - Rename to a new dashboard name`, () => {
  //   
  // });

  // it(`9.${perspective.name} perspective - Duplicate and verify project dropdown`, () => {
  //   // openshift-cluster-observability-operator namespace
  //   // observ-test namespace not available
  //   // perses-dev namespace not available
  // });

  // it(`10.${perspective.name} perspective - Duplicate to an existing dashboard name with spaces`, () => {
  //  
  // });

  // it(`11.${perspective.name} perspective - Duplicate to an existing dashboard name without spaces`, () => {
  //   
  // });

  // it(`12.${perspective.name} perspective - Duplicate to a new dashboard name in the same project`, () => {
  //  
  // });

  // it(`13.${perspective.name} perspective - Delete and Cancel - Enabled`, () => {
  //  
  // });

  // it(`14.${perspective.name} perspective - Delete and Confirm`, () => {
  //  
  // });

  // it(`15.${perspective.name} perspective - Delete all dashboard from a project to check empty state`, () => {
  //  
  // });

  // it(`16.${perspective.name} perspective - Delete namespace and check project dropdown does not load this namespace`, () => {
  // OU-1192 - [Perses operator] - Delete namespace is not deleting perses project
  //  
  // });

  // it(`17.${perspective.name} perspective - Import button validation - Enabled / Disabled`, () => {
  //   // Enabled for openshift-cluster-observability-operator namespace
  //   // Disabled for observ-test namespace
  // });

  // it(`18.${perspective.name} perspective - Import button validation - Enabled - YAML - project and namespace in the file mismatches`, () => {
  //   // Enabled for openshift-cluster-observability-operator namespace
  // });

  // it(`19.${perspective.name} perspective - Import button validation - Enabled - YAML project and namespace in the file matches`, () => {
  //   // Enabled for openshift-cluster-observability-operator namespace
  // });

  // it(`20.${perspective.name} perspective - Import button validation - Enabled - JSON - project and namespace in the file mismatches`, () => {
  //   // Enabled for openshift-cluster-observability-operator namespace
  // });

  // it(`21.${perspective.name} perspective - Import button validation - Enabled - JSON project and namespace in the file matches`, () => {
  //   // Enabled for openshift-cluster-observability-operator namespace
  // });


}
