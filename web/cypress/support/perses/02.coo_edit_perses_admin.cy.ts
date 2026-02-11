import { editPersesDashboardsAddVariable, persesMUIDataTestIDs, IDs, editPersesDashboardsAddDatasource } from '../../../src/components/data-test';
import { persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from "../../views/list-perses-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesDashboardsPanelGroup } from '../../views/perses-dashboards-panelgroup';
import { persesDashboardsEditDatasources } from '../../views/perses-dashboards-edit-datasources';
import { persesDashboardsEditVariables } from '../../views/perses-dashboards-edit-variables';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOOEditPersesTests(perspective: PerspectiveConfig) {
  testCOOEditPerses(perspective);
}

export function testCOOEditPerses(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - Edit perses dashboard page`, () => {
    cy.log(`1.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`1.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`1.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`1.4. Click on Edit button`);
    cy.wait(15000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.assertEditModeButtons();
    persesDashboardsPage.assertEditModePanelGroupButtons('Headlines');
    //already expanded
    persesDashboardsPage.assertPanelActionButtons('CPU Usage');
    // tiny panel and modal is opened. So, expand first and then assert the buttons and finally collapse
    // due to modal is opened and page is refreshed, it is not easy to assert buttons in the modal
    persesDashboardsPage.assertPanelActionButtons('CPU Utilisation');

    cy.log(`1.5. Click on Cancel button`);
    persesDashboardsPage.clickEditActionButton('Cancel');
    
    cy.log(`1.6. Change namespace to All Projects`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.shouldBeLoaded();

  });

  it(`2.${perspective.name} perspective - Edit Toolbar - Edit Variables - Add List Variable`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`2.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`2.4. Click on Edit button`);
    cy.wait(10000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('EditVariables');
    persesDashboardsEditVariables.clickButton('Add Variable');
    //https://issues.redhat.com/browse/OU-1159 - Custom All Value is not working
    persesDashboardsEditVariables.addListVariable('ListVariable', true, true, 'AAA', 'Test', 'Test', undefined, undefined);

    cy.log(`2.5. Run query`);
    persesDashboardsEditVariables.clickButton('Run Query');
    cy.get('h4').should('contain', 'Preview Values').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardAddVariablePreviewValuesCopy).should('be.visible');

    cy.log(`2.6. Add variable`);
    persesDashboardsEditVariables.clickButton('Add');

    cy.log(`2.7. Apply changes`);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`2.8. Save dashboard`);
    persesDashboardsPage.clickEditActionButton('Save');
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    //https://issues.redhat.com/browse/OU-1159 - Custom All Value is not working, so selecting "All" for now
    persesDashboardsPage.searchAndSelectVariable('ListVariable', 'All');
    //TODO: END testing more to check if it is time constraint or cache issue

  });

  it(`3.${perspective.name} perspective - Edit Toolbar - Edit Variables - Add Text Variable`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`3.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`3.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`3.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('EditVariables');

    cy.log(`3.5. Click on Dashboard Built-in Variables button`);
    cy.get('#'+IDs.persesDashboardEditVariablesModalBuiltinButton).should('have.attr', 'aria-expanded', 'false').click();
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('#'+IDs.persesDashboardEditVariablesModalBuiltinButton).should('have.attr', 'aria-expanded', 'true')
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('#'+IDs.persesDashboardEditVariablesModalBuiltinButton).click();
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('#'+IDs.persesDashboardEditVariablesModalBuiltinButton).should('have.attr', 'aria-expanded', 'false');

    cy.log(`3.6. Add variable`);
    persesDashboardsEditVariables.clickButton('Add Variable');
    persesDashboardsEditVariables.addTextVariable('TextVariable', true, 'Test', 'Test', 'Test');
    persesDashboardsEditVariables.clickButton('Add');

    cy.log(`3.7. Apply changes`);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`3.8. Save dashboard`);
    persesDashboardsPage.clickEditActionButton('Save');
    
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);

    cy.log(`3.9. Search and type variable`);
    persesDashboardsPage.searchAndTypeVariable('TextVariable', '');

  });

  it(`4.${perspective.name} perspective - Edit Toolbar - Edit Variables - Visibility, Move up/down, Edit and Delete Variable`, () => {
    cy.log(`4.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`4.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`4.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`4.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();

    cy.log(`4.5. Click on Edit Variables button`);
    persesDashboardsPage.clickEditActionButton('EditVariables');

    cy.log(`4.6. Toggle variable visibility`);
    persesDashboardsEditVariables.toggleVariableVisibility(0, false);

    cy.log(`4.7. Move variable up`);
    persesDashboardsEditVariables.moveVariableUp(1);

    cy.log(`4.8. Click on Edit variable button`);
    persesDashboardsEditVariables.clickEditVariableButton(0);

    cy.log(`4.9. Edit list variable`);
    //https://issues.redhat.com/browse/OU-1159 - Custom All Value is not working
    persesDashboardsEditVariables.addListVariable('ListVariable123', false, false, '123', 'Test123', 'Test123', undefined, undefined);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`4.10. Delete variable`);
    persesDashboardsEditVariables.clickDeleteVariableButton(2);
    persesDashboardsEditVariables.clickButton('Apply');

    cy.log(`4.11. Save dashboard`);
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`4.12. Search and select variable`);
    //https://issues.redhat.com/browse/OU-1159 - Custom All Value is not working, so selecting "All" for now
    persesDashboardsPage.searchAndSelectVariable('ListVariable123', 'All');

    cy.log(`4.13. Assert variable not be visible`);
    persesDashboardsPage.assertVariableNotBeVisible('cluster');

    cy.log(`4.14. Assert variable not exist`);
    persesDashboardsPage.assertVariableNotExist('TextVariable');

    cy.log(`4.15. Recover dashboard`);
    persesDashboardsPage.clickEditButton();

    cy.log(`4.16. Click on Edit Variables button`);
    persesDashboardsPage.clickEditActionButton('EditVariables');

    cy.log(`4.16. Toggle variable visibility`);
    persesDashboardsEditVariables.toggleVariableVisibility(1, true);

    cy.log(`4.17. Delete variable`);
    persesDashboardsEditVariables.clickDeleteVariableButton(0);

    cy.log(`4.17. Apply changes`);
    persesDashboardsEditVariables.clickButton('Apply');
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`4.18. Assert variable be visible`);
    persesDashboardsPage.assertVariableBeVisible('cluster');

    cy.log(`4.19. Assert variable not exist`);
    persesDashboardsPage.assertVariableNotExist('TextVariable');

  });

  it(`5.${perspective.name} perspective - Edit Toolbar - Edit Variables - Add Variable - Required field validation`, () => {
    cy.log(`5.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`5.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`5.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`5.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('EditVariables');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('button').contains('Add Variable').should('be.visible').click();
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputName+'"]').clear();
    persesDashboardsEditVariables.clickButton('Add');
    persesDashboardsEditVariables.assertRequiredFieldValidation('Name');
    persesDashboardsEditVariables.clickButton('Cancel');
    persesDashboardsEditVariables.clickButton('Cancel');
  });

  /**TODO: https://issues.redhat.com/browse/OU-1054 is targeted for COO1.5.0, so, commenting all Datasources related scenarios
  it(`6.${perspective.name} perspective - Edit Toolbar - Edit Datasources - Add and Delete Prometheus Datasource`, () => {
    cy.log(`6.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`6.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`6.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`6.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('EditDatasources');

    cy.log(`6.5. Verify existing datasources`);
    persesDashboardsEditDatasources.assertDatasource(0, 'PrometheusLocal', 'PrometheusDatasource', '');

    cy.log(`6.6. Add datasource`);
    persesDashboardsEditDatasources.clickButton('Add Datasource');
    persesDashboardsEditDatasources.addDatasource('Datasource1', true, 'Prometheus Datasource', 'Datasource1', 'Datasource1');
    persesDashboardsEditDatasources.clickButton('Add');
    persesDashboardsEditDatasources.assertDatasource(1, 'Datasource1', 'PrometheusDatasource', 'Datasource1');

    cy.log(`6.7. Add second datasource`);
    persesDashboardsEditDatasources.clickButton('Add Datasource');
    persesDashboardsEditDatasources.addDatasource('Datasource2', true, 'Prometheus Datasource', 'Datasource2', 'Datasource2');
    persesDashboardsEditDatasources.clickButton('Add');
    persesDashboardsEditDatasources.assertDatasource(2, 'Datasource2', 'PrometheusDatasource', 'Datasource2');

    cy.log(`6.8. Delete first datasource`);
    persesDashboardsEditDatasources.clickDeleteDatasourceButton(1);
    persesDashboardsEditDatasources.assertDatasourceNotExist('Datasource1');

    persesDashboardsEditDatasources.clickButton('Apply');
    //https://issues.redhat.com/browse/OU-1160 - Datasource is not saved
    // persesDashboardsPage.clickEditActionButton('Save');
  });

  it(`7.${perspective.name} perspective - Edit Toolbar - Edit Datasources - Edit Prometheus Datasource`, () => {
    cy.log(`7.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`7.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`7.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`7.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('EditDatasources');

    cy.log(`7.5. Verify existing datasources`);
    persesDashboardsEditDatasources.assertDatasource(0,'PrometheusLocal', 'PrometheusDatasource', '');

    cy.log(`7.6. Edit datasource`);
    persesDashboardsEditDatasources.clickEditDatasourceButton(0);
    persesDashboardsEditDatasources.addDatasource('PrometheusLocal', false, 'Prometheus Datasource', 'Datasource1', 'Datasource1');
    persesDashboardsEditDatasources.clickButton('Apply');
    persesDashboardsEditDatasources.assertDatasource(0,'PrometheusLocal', 'PrometheusDatasource', 'Datasource1');
    persesDashboardsEditDatasources.clickButton('Cancel');
    persesDashboardsPage.clickEditActionButton('Cancel');

  });

  // it(`8.${perspective.name} perspective - Edit Toolbar - Edit Datasources - Add Tempo Datasource`, () => {
  // });

  it(`8.${perspective.name} perspective - Edit Toolbar - Edit Datasources - Required field validation`, () => {
    cy.log(`8.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`8.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`8.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`8.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('EditDatasources');

    cy.log(`8.5. Add datasource`);
    persesDashboardsEditDatasources.clickButton('Add Datasource');

    cy.log(`8.6. Clear out Name field`);
    cy.get('input[name="'+editPersesDashboardsAddDatasource.inputName+'"]').clear();
    persesDashboardsEditDatasources.clickButton('Add');

    cy.log(`8.7. Assert required field validation`);
    persesDashboardsEditDatasources.assertRequiredFieldValidation('Name');
    persesDashboardsEditDatasources.clickButton('Cancel');

    cy.log(`8.8. Cancel changes`);
    persesDashboardsEditDatasources.clickButton('Cancel');
    persesDashboardsPage.clickEditActionButton('Cancel');

  });
*/

  it(`6.${perspective.name} perspective - Edit Toolbar - Add Panel Group`, () => {
    cy.log(`6.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`6.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`6.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`6.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.clickEditActionButton('AddGroup');

    cy.log(`6.5. Add panel group`);
    persesDashboardsPanelGroup.addPanelGroup('PanelGroup1', 'Open', '');

    cy.log(`6.6. Save panel group`);
    persesDashboardsPage.clickEditActionButton('Save');
    persesDashboardsPage.panelGroupHeaderAssertion('PanelGroup1', 'Open');

    cy.log(`6.7. Back and check panel group`);
    //TODO: START testing more to check if it is time constraint or cache issue
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    persesDashboardsPage.panelGroupHeaderAssertion('PanelGroup1', 'Open');

  });

  it(`7.${perspective.name} perspective - Edit Toolbar - Edit Panel Group`, () => {
    cy.log(`7.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`7.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`7.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`7.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup1', 'edit');
    persesDashboardsPanelGroup.editPanelGroup('PanelGroup2', 'Closed', '');
    persesDashboardsPage.clickEditActionButton('Save');
    persesDashboardsPage.panelGroupHeaderAssertion('PanelGroup2', 'Closed');

    cy.log(`7.5. Back and check panel group`);
    //TODO: START testing more to check if it is time constraint or cache issue
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    persesDashboardsPage.panelGroupHeaderAssertion('PanelGroup2', 'Closed');

  });

  it(`8.${perspective.name} perspective - Edit Toolbar - Move Panel Group Down and Up`, () => {
    cy.log(`8.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`8.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`8.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`8.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup2', 'moveDown');
    
    cy.log(`8.5. Save panel group`);
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`8.6. Assert panel group order`);
    persesDashboardsPage.assertPanelGroupOrder('Row 1', 0);
    persesDashboardsPage.assertPanelGroupOrder('PanelGroup2', 1);
    persesDashboardsPage.assertPanelGroupOrder('Row 2', 2);

    cy.log(`8.7. Back and check panel group order`);
    //TODO: START testing more to check if it is time constraint or cache issue
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    persesDashboardsPage.assertPanelGroupOrder('Row 1', 0);
    persesDashboardsPage.assertPanelGroupOrder('PanelGroup2', 1);
    persesDashboardsPage.assertPanelGroupOrder('Row 2', 2);

    cy.log(`8.8. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();

    cy.log(`8.9. Move panel group up`);
    persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup2', 'moveUp');
    persesDashboardsPage.clickEditActionButton('Save');

    cy.log(`8.10. Assert panel group order`);
    persesDashboardsPage.assertPanelGroupOrder('PanelGroup2', 0);
    persesDashboardsPage.assertPanelGroupOrder('Row 1', 1);
    persesDashboardsPage.assertPanelGroupOrder('Row 2', 2);
    
    cy.log(`8.11. Back and check panel group order`);
    //TODO: START testing more to check if it is time constraint or cache issue
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    persesDashboardsPage.assertPanelGroupOrder('PanelGroup2', 0);
    persesDashboardsPage.assertPanelGroupOrder('Row 1', 1);
    persesDashboardsPage.assertPanelGroupOrder('Row 2', 2);
  });

  it(`9.${perspective.name} perspective - Edit Toolbar - Delete Panel Group`, () => {
    cy.log(`9.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`9.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`9.3. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();

    cy.log(`9.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup2', 'delete');
    persesDashboardsPanelGroup.clickDeletePanelGroupButton();
    persesDashboardsPage.clickEditActionButton('Save');
    persesDashboardsPage.assertPanelGroupNotExist('PanelGroup2');

    cy.log(`9.5. Back and check panel group`);
    //TODO: START testing more to check if it is time constraint or cache issue
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    persesDashboardsPage.assertPanelGroupNotExist('PanelGroup2');
  });

}
