import { IDs, editPersesDashboardsAddPanel } from '../../../src/components/data-test';
import { persesDashboardsAddListPanelType, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from "../../views/list-perses-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesDashboardsEditDatasources } from '../../views/perses-dashboards-edit-datasources';
import { persesDashboardsEditVariables } from '../../views/perses-dashboards-edit-variables';
import { persesDashboardsPanel } from '../../views/perses-dashboards-panel';
import { persesDashboardsPanelGroup } from '../../views/perses-dashboards-panelgroup';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOOEditPersesTests1(perspective: PerspectiveConfig) {
  testCOOEditPerses1(perspective);
}

export function testCOOEditPerses1(perspective: PerspectiveConfig) {
  
    it(`13.${perspective.name} perspective - Edit Toolbar - Add Panel`, () => {
      cy.log(`13.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`13.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`13.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
  
      //TODO: OU-1064 - After it gets fixed, change addPanel to cleanup the fulfilment of the form
      const panelTypeKeys = Object.keys(persesDashboardsAddListPanelType) as (keyof typeof persesDashboardsAddListPanelType)[];
      //TODO: OU-1166 - After it gets fixed, uncomment Markdown and Pie Chart in constants.ts
      panelTypeKeys.forEach((typeKey) => {
        const panelName = persesDashboardsAddListPanelType[typeKey]; // e.g., 'Bar Chart'
  
        cy.log(`13.4. Click on Edit button`);
        cy.wait(2000);
        persesDashboardsPage.clickEditButton();
  
        cy.log(`13.5. Click on Add Group - PanelGroup ` + panelName);
        persesDashboardsPage.clickEditActionButton('AddGroup');
        persesDashboardsPanelGroup.addPanelGroup('PanelGroup ' + panelName, 'Open', '');
        persesDashboardsPage.clickEditActionButton('Save');
  
        cy.log(`13.6. Click on Edit button`);
        persesDashboardsPage.clickEditButton();
  
        cy.log(`13.7. Click on Add Panel button` + panelName);
        persesDashboardsPage.clickEditActionButton('AddPanel');
        persesDashboardsPanel.addPanelShouldBeLoaded();
        persesDashboardsPanel.addPanel(panelName, 'PanelGroup ' + panelName, panelName);
        persesDashboardsPage.assertPanel(panelName, 'PanelGroup ' + panelName, 'Open');
        persesDashboardsPage.clickEditActionButton('Save');
      });
    });
  
    it(`14.${perspective.name} perspective - Edit Toolbar - Edit Panel`, () => {
      cy.log(`14.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`14.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`14.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
  
      cy.log(`14.4. Click on Edit button`);
      cy.wait(2000);
      persesDashboardsPage.clickEditButton();
  
      const panelTypeKeys = Object.keys(persesDashboardsAddListPanelType) as (keyof typeof persesDashboardsAddListPanelType)[];
      const lastKey = panelTypeKeys[panelTypeKeys.length - 1]; // Get the last KEY from the array
      const lastPanelName = persesDashboardsAddListPanelType[lastKey]; // Use the KEY to get the VALUE
  
      cy.log(`14.4. Click on Edit Panel button` + lastPanelName + ' to Panel1');
      persesDashboardsPage.clickPanelAction(lastPanelName, 'edit');
      persesDashboardsPanel.editPanel('Panel1', 'PanelGroup ' + lastPanelName, persesDashboardsAddListPanelType.BAR_CHART, 'Description1');
      persesDashboardsPage.assertPanel('Panel1', 'PanelGroup ' + lastPanelName, 'Open');
      persesDashboardsPage.clickEditActionButton('Save');
  
      cy.log(`14.5. Click on Edit Panel button from Panel 1 to` + lastPanelName);
      persesDashboardsPage.clickEditButton();
  
      persesDashboardsPage.clickPanelAction('Panel1', 'edit');
      persesDashboardsPanel.editPanel(lastPanelName, 'PanelGroup ' + lastPanelName, lastPanelName, 'Description1');
      persesDashboardsPage.assertPanel(lastPanelName, 'PanelGroup ' + lastPanelName, 'Open');
      persesDashboardsPage.clickEditActionButton('Save');
  
    });
  
  
    it(`15.${perspective.name} perspective - Edit Toolbar - Delete Panel`, () => {
      cy.log(`15.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`15.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`15.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
  
      const panelTypeKeys = Object.keys(persesDashboardsAddListPanelType) as (keyof typeof persesDashboardsAddListPanelType)[];
  
      panelTypeKeys.reverse().forEach((typeKey) => {
        const panelName = persesDashboardsAddListPanelType[typeKey]; // e.g., 'Bar Chart'
        cy.log(`15.4. Delete Panel` + panelName);
        persesDashboardsPage.clickEditButton();
        persesDashboardsPanel.deletePanel(panelName);
        persesDashboardsPanel.clickDeletePanelButton();
  
        cy.log(`15.5. Delete Panel Group` + panelName);
        persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup ' + panelName, 'delete');
        persesDashboardsPanelGroup.clickDeletePanelGroupButton();
        persesDashboardsPage.clickEditActionButton('Save');
      });
    });
  
    
    //TODO: OU-1164 - After it gets fixed, cleanup the fulfilment of the form
    it(`16.${perspective.name} perspective - Edit Toolbar - Add Panel - Required field validation`, () => {
      cy.log(`16.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`16.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`16.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
  
      cy.log(`16.4. Click on Edit button`);
      cy.wait(2000);
      persesDashboardsPage.clickEditButton();
  
      cy.log(`16.5. Click on Add Panel Group button`);
      persesDashboardsPage.clickEditActionButton('AddGroup');
      persesDashboardsPanelGroup.addPanelGroup('PanelGroup Required Field Validation', 'Open', '');
  
      cy.log(`16.6. Click on Add Panel button`);
      persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup Required Field Validation', 'addPanel');
      
      cy.get('input[name="'+editPersesDashboardsAddPanel.inputName+'"]').clear().type('Required Field Validation');
   
      persesDashboardsPanel.clickDropdownAndSelectOption('Type', persesDashboardsAddListPanelType.BAR_CHART);
      cy.get('input[name="'+editPersesDashboardsAddPanel.inputName+'"]').clear().type('Required Field Validation');
      persesDashboardsPanel.clickDropdownAndSelectOption('Type', persesDashboardsAddListPanelType.BAR_CHART);
      cy.get('input[name="'+editPersesDashboardsAddPanel.inputName+'"]').clear();
      cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').find('h2').siblings('div').find('button').contains('Add').should('be.visible').click();
  
      cy.log(`16.7. Assert required field validation`);
      persesDashboardsPanel.assertRequiredFieldValidation('Name');
      persesDashboardsPanel.clickButton('Cancel');
      persesDashboardsPage.clickEditActionButton('Cancel');
    });
  

    it(`17.${perspective.name} perspective - Edit Toolbar - Perform changes and Cancel`, () => {
      cy.log(`17.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();

      cy.log(`17.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
      listPersesDashboardsPage.countDashboards('1');

      cy.log(`17.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]);
      //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
      // persesDashboardsPage.shouldBeLoaded1();

      cy.log(`17.4. Click on Edit button`);
      cy.wait(2000);
      persesDashboardsPage.clickEditButton();
      persesDashboardsPage.clickEditActionButton('EditVariables');
      persesDashboardsEditVariables.clickButton('Add Variable');
      //https://issues.redhat.com/browse/OU-1159 - Custom All Value is not working
      persesDashboardsEditVariables.addListVariable('ListVariable', true, true, 'AAA', 'Test', 'Test', undefined, undefined);


      cy.log(`17.5. Add variable`);
      persesDashboardsEditVariables.clickButton('Add');

      cy.log(`17.6. Apply changes`);
      persesDashboardsEditVariables.clickButton('Apply');

      cy.log(`17.7. Assert Variable before cancelling`);
      persesDashboardsPage.searchAndSelectVariable('ListVariable', 'All');

      cy.log(`17.8. Click on Edit Datasources button`);
      persesDashboardsPage.clickEditActionButton('EditDatasources');

      cy.log(`17.9. Add datasource`);
      persesDashboardsEditDatasources.clickButton('Add Datasource');
      persesDashboardsEditDatasources.addDatasource('Datasource1', true, 'Prometheus Datasource', 'Datasource1', 'Datasource1');
      persesDashboardsEditDatasources.clickButton('Add');
      persesDashboardsEditDatasources.assertDatasource(0, 'Datasource1', 'PrometheusDatasource', 'Datasource1');

      persesDashboardsEditDatasources.clickButton('Apply');

      cy.log(`17.11. Click on Add Panel Group button`);
      persesDashboardsPage.clickEditActionButton('AddGroup');
      persesDashboardsPanelGroup.addPanelGroup('PanelGroup Perform Changes and Cancel', 'Open', '');

      cy.log(`17.12. Click on Add Panel button`);
      persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup Perform Changes and Cancel', 'addPanel');
      persesDashboardsPanel.addPanel('Panel Perform Changes and Cancel', 'PanelGroup Perform Changes and Cancel', 'Bar Chart');

      cy.log(`17.13. Click on Cancel button`);
      persesDashboardsPage.clickEditActionButton('Cancel');

      cy.log(`17.14. Assert variable not exist`);
      persesDashboardsPage.assertVariableNotExist('ListVariable');

      //TODO: OU-1167 - After it gets fixed, change to assertDatasourceNotExist
      cy.log(`17.15. Assert datasource not exist`);
      persesDashboardsPage.clickEditButton();
      persesDashboardsPage.clickEditActionButton('EditDatasources');
      // persesDashboardsEditDatasources.assertDatasourceNotExist('Datasource1');
      persesDashboardsEditDatasources.clickButton('Cancel');

      cy.log(`17.16. Assert panel group not exist`);
      persesDashboardsPage.assertPanelGroupNotExist('PanelGroup Perform Changes and Cancel');

      cy.log(`17.17. Assert panel not exist`);
      persesDashboardsPage.assertPanelNotExist('Panel Perform Changes and Cancel');

    });

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
