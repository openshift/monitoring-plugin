import { editPersesDashboardsAddVariable, persesMUIDataTestIDs, IDs } from '../../../src/components/data-test';
import { persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from "../../views/list-perses-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';
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
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();
    persesDashboardsPage.assertEditModeButtons();
    persesDashboardsPage.assertEditModePanelGroupButtons('Headlines');
    //already expanded
    persesDashboardsPage.assertPanelActionButtons('CPU Usage');
    // tiny panel and modal is opened. So, expand first and then assert the buttons and finally collapse
    // due to modal is opened and page is refreshed, it is not easy to assert buttons in the modal
    persesDashboardsPage.assertPanelActionButtons('CPU Utilisation');

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
    cy.wait(2000);
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
    persesDashboardsPage.clickSaveDashboardButton(true, true, true);
    //TODO: START testing more to check if it is time constraint or cache issue
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
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
    
    //TODO: START testing more to check if it is time constraint or cache issue
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    persesDashboardsPage.backToListPersesDashboardsPage();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);

    cy.log(`3.9. Search and type variable`);
    persesDashboardsPage.searchAndTypeVariable('TextVariable', undefined);
    //TODO: END testing more to check if it is time constraint or cache issue

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
    persesDashboardsEditVariables.clickDiscardChangesButton();
    persesDashboardsEditVariables.clickButton('Cancel');
  });


  it(`6.${perspective.name} perspective - Edit Toolbar - Edit Datasources - Add Prometheus Datasource`, () => {
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
    persesDashboardsEditDatasources.assertDatasource('PrometheusLocal', 'PrometheusDatasource', '');

    cy.log(`6.6. Add datasource`);
    persesDashboardsEditDatasources.clickButton('Add Datasource');
    persesDashboardsEditDatasources.addDatasource('Datasource1', true, 'Prometheus Datasource', 'Datasource1', 'Datasource1');
    persesDashboardsEditDatasources.clickButton('Add');
    persesDashboardsEditDatasources.clickButton('Apply');
    //https://issues.redhat.com/browse/OU-1160 - Datasource is not saved
    // persesDashboardsPage.clickEditActionButton('Save');
    // persesDashboardsPage.clickSaveDashboardButton(true, true, true);
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
    persesDashboardsEditDatasources.assertDatasource('PrometheusLocal', 'PrometheusDatasource', '');

    cy.log(`7.6. Edit datasource`);
    persesDashboardsEditDatasources.clickEditDatasourceButton(0);
    persesDashboardsEditDatasources.addDatasource('PrometheusLocal', false, 'Prometheus Datasource', 'Datasource1', 'Datasource1');
    persesDashboardsEditDatasources.clickButton('Apply');
    persesDashboardsEditDatasources.assertDatasource('PrometheusLocal', 'PrometheusDatasource', 'Datasource1');
    persesDashboardsEditDatasources.clickButton('Cancel');
    persesDashboardsPage.clickEditActionButton('Cancel');
    persesDashboardsPage.clickDiscardChangesButton();

  });

  // it(`8.${perspective.name} perspective - Edit Toolbar - Edit Datasources - Add Tempo Datasource`, () => {
  // });

  // it(`4.${perspective.name} perspective - Edit Toolbar - Add Panel`, () => {

  // });

  // it(`5.${perspective.name} perspective - Edit Toolbar - Add Panel Group`, () => {

  // });

  // it(`6.${perspective.name} perspective - Panel Group Toolbar - Add Panel to Panel Group`, () => {

  // });

  // it(`7.${perspective.name} perspective - Panel Group Toolbar - Edit Panel Group`, () => {

  // });

  // it(`8.${perspective.name} perspective - Panel Group Toolbar - Delete Panel Group`, () => {

  // });

  // it(`9.${perspective.name} perspective - Panel Group Toolbar - Move Panel Group Down`, () => {

  // });

  // it(`10.${perspective.name} perspective - Panel Group Toolbar - Move Panel Group Up`, () => {

  // });

  // it(`11.${perspective.name} perspective - Panel Toolbar - Edit Panel`, () => {

  // });

  // it(`12.${perspective.name} perspective - Panel Toolbar - Duplicate Panel`, () => {

  // });

  // it(`13.${perspective.name} perspective - Panel Toolbar - Delete Panel`, () => {

  // });

  // it(`14.${perspective.name} perspective - Perform changes and Cancel`, () => {

  // });

  // it(`15.${perspective.name} perspective - Perform changes and Save`, () => {

  // });

  /** TODO: OU-886 Mark dashboards and datasources created using CRD as readonly
  it(`X.${perspective.name} perspective - Try to editAccelerators and APM dashboards`, () => {

  });
  */

}
