import { IDs, editPersesDashboardsAddPanel } from '../../../src/components/data-test';
import { persesDashboardsAddListPanelType, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from "../../views/perses-dashboards-list-dashboards";
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
  
    it(`10.${perspective.name} perspective - Edit Toolbar - Add Panel`, () => {
      cy.log(`10.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`10.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`10.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
  
      const panelTypeKeys = Object.keys(persesDashboardsAddListPanelType) as (keyof typeof persesDashboardsAddListPanelType)[];
      panelTypeKeys.forEach((typeKey) => {
        const panelName = persesDashboardsAddListPanelType[typeKey]; // e.g., 'Bar Chart'
  
        cy.log(`10.4. Click on Edit button`);
        persesDashboardsPage.clickEditButton();
  
        cy.log(`10.5. Click on Add Group - PanelGroup ` + panelName);
        persesDashboardsPage.clickEditActionButton('AddGroup');
        persesDashboardsPanelGroup.addPanelGroup('PanelGroup ' + panelName, 'Open', '');
        persesDashboardsPage.clickEditActionButton('Save');
  
        cy.log(`10.6. Click on Edit button`);
        persesDashboardsPage.clickEditButton();
  
        cy.log(`10.7. Click on Add Panel button` + panelName);
        persesDashboardsPage.clickEditActionButton('AddPanel');
        persesDashboardsPanel.addPanelShouldBeLoaded();
        persesDashboardsPanel.addPanel(panelName, 'PanelGroup ' + panelName, panelName);
        persesDashboardsPage.assertPanel(panelName, 'PanelGroup ' + panelName, 'Open');
        persesDashboardsPage.clickEditActionButton('Save');
      });
    });
  
    it(`11.${perspective.name} perspective - Edit Toolbar - Edit Panel`, () => {
      cy.log(`11.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`11.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`11.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
  
      cy.log(`11.4. Click on Edit button`);
      cy.wait(2000);
      persesDashboardsPage.clickEditButton();
  
      const panelTypeKeys = Object.keys(persesDashboardsAddListPanelType) as (keyof typeof persesDashboardsAddListPanelType)[];
      const lastKey = panelTypeKeys[panelTypeKeys.length - 1]; // Get the last KEY from the array
      const lastPanelName = persesDashboardsAddListPanelType[lastKey]; // Use the KEY to get the VALUE
  
      cy.log(`11.5. Click on Edit Panel button` + lastPanelName + ' to Panel1');
      persesDashboardsPage.clickPanelAction(lastPanelName, 'edit');
      persesDashboardsPanel.editPanel('Panel1', 'PanelGroup ' + lastPanelName, persesDashboardsAddListPanelType.BAR_CHART, 'Description1');
      persesDashboardsPage.assertPanel('Panel1', 'PanelGroup ' + lastPanelName, 'Open');
      persesDashboardsPage.clickEditActionButton('Save');
  
      cy.log(`11.6. Click on Edit Panel button from Panel 1 to` + lastPanelName);
      persesDashboardsPage.clickEditButton();
  
      persesDashboardsPage.clickPanelAction('Panel1', 'edit');
      persesDashboardsPanel.editPanel(lastPanelName, 'PanelGroup ' + lastPanelName, lastPanelName, 'Description1');
      persesDashboardsPage.assertPanel(lastPanelName, 'PanelGroup ' + lastPanelName, 'Open');
      persesDashboardsPage.clickEditActionButton('Save');
  
    });
  
    it(`12.${perspective.name} perspective - Edit Toolbar - Delete Panel`, () => {
      cy.log(`12.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`12.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`12.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
  
      const panelTypeKeys = Object.keys(persesDashboardsAddListPanelType) as (keyof typeof persesDashboardsAddListPanelType)[];
  
      panelTypeKeys.reverse().forEach((typeKey) => {
        const panelName = persesDashboardsAddListPanelType[typeKey]; // e.g., 'Bar Chart'
        cy.log(`12.4. Delete Panel` + panelName);
        persesDashboardsPage.clickEditButton();
        persesDashboardsPanel.deletePanel(panelName);
        persesDashboardsPanel.clickDeletePanelButton();
  
        cy.log(`12.5. Delete Panel Group` + panelName);
        persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup ' + panelName, 'delete');
        persesDashboardsPanelGroup.clickDeletePanelGroupButton();
        persesDashboardsPage.clickEditActionButton('Save');
      });
    });

    it(`13.${perspective.name} perspective - Edit Toolbar - Duplicate Panel`, () => {
      cy.log(`13.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`13.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('1');

      cy.log(`13.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);

      cy.log(`13.4. Click on Edit button`);
      cy.wait(2000);
      persesDashboardsPage.clickEditButton();

      cy.log(`13.5. Collapse Row 1 Panel Group`);
      persesDashboardsPage.collapsePanelGroup('Row 1');

      cy.log(`13.6. Click on Duplicate Panel button`);
      persesDashboardsPage.clickPanelAction('Legend Example', 'duplicate');

      cy.log(`13.7. Assert duplicated panel`);
      persesDashboardsPage.assertDuplicatedPanel('Legend Example', 2);

    });
  
    it(`14.${perspective.name} perspective - Edit Toolbar - Perform changes and Cancel`, () => {
      cy.log(`14.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();

      cy.log(`14.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0]);
      listPersesDashboardsPage.countDashboards('1');

      cy.log(`14.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0]);
      //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
      // persesDashboardsPage.shouldBeLoaded1();

      cy.log(`14.4. Click on Edit button`);
      cy.wait(2000);
      persesDashboardsPage.clickEditButton();
      persesDashboardsPage.clickEditActionButton('EditVariables');
      persesDashboardsEditVariables.clickButton('Add Variable');
      //https://issues.redhat.com/browse/OU-1159 - Custom All Value is not working
      persesDashboardsEditVariables.addListVariable('ListVariable', true, true, 'AAA', 'Test', 'Test', undefined, undefined);

      cy.log(`14.5. Add variable`);
      persesDashboardsEditVariables.clickButton('Add');

      cy.log(`14.6. Apply changes`);
      persesDashboardsEditVariables.clickButton('Apply');

      cy.log(`14.7. Assert Variable before cancelling`);
      persesDashboardsPage.searchAndSelectVariable('ListVariable', 'All');

      cy.log(`14.8. Click on Add Panel Group button`);
      persesDashboardsPage.clickEditActionButton('AddGroup');
      persesDashboardsPanelGroup.addPanelGroup('PanelGroup Perform Changes and Cancel', 'Open', '');

      cy.log(`14.9. Click on Add Panel button`);
      persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup Perform Changes and Cancel', 'addPanel');
      persesDashboardsPanel.addPanel('Panel Perform Changes and Cancel', 'PanelGroup Perform Changes and Cancel', 'Bar Chart');

      cy.log(`14.10. Click on Cancel button`);
      persesDashboardsPage.clickEditActionButton('Cancel');

      cy.log(`14.11. Assert variable not exist`);
      persesDashboardsPage.assertVariableNotExist('ListVariable');

      cy.log(`14.12. Assert panel group not exist`);
      persesDashboardsPage.assertPanelGroupNotExist('PanelGroup Perform Changes and Cancel');

      cy.log(`14.13. Assert panel not exist`);
      persesDashboardsPage.assertPanelNotExist('Panel Perform Changes and Cancel');

    });

  /**
   * OU-886 Mark dashboards and datasources created using CRD as readonly
   * 
   * Admin user and dev users with persesdashboard-editor-role will be able to edit dashboards using CRD.
   * 
   */ 
  it(`15.${perspective.name} perspective - Try to editAccelerators and APM dashboards`, () => {
      cy.log(`15.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();

      cy.log(`15.2. Filter by Name`);
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
      listPersesDashboardsPage.countDashboards('1');

      cy.log(`15.3. Click on a dashboard`);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
      //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
      // persesDashboardsPage.shouldBeLoaded1();

      cy.log(`15.4. Click on Edit button`);
      cy.wait(2000);
      persesDashboardsPage.clickEditButton();
      persesDashboardsPage.clickEditActionButton('EditVariables');
      persesDashboardsEditVariables.clickButton('Add Variable');
      //https://issues.redhat.com/browse/OU-1159 - Custom All Value is not working
      persesDashboardsEditVariables.addListVariable('ListVariable', true, true, 'AAA', 'Test', 'Test', undefined, undefined);

      cy.log(`15.5. Add variable`);
      persesDashboardsEditVariables.clickButton('Add');

      cy.log(`15.6. Apply changes`);
      persesDashboardsEditVariables.clickButton('Apply');

      cy.log(`15.7. Assert Variable before saving`);
      persesDashboardsPage.searchAndSelectVariable('ListVariable', 'All');

      cy.log(`15.8. Click on Add Panel Group button`);
      persesDashboardsPage.clickEditActionButton('AddGroup');
      persesDashboardsPanelGroup.addPanelGroup('PanelGroup Perform Changes and Save', 'Open', '');

      cy.log(`15.9. Click on Add Panel button`);
      persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup Perform Changes and Save', 'addPanel');
      persesDashboardsPanel.addPanel('Panel Perform Changes and Save', 'PanelGroup Perform Changes and Save', 'Bar Chart');

      cy.log(`15.10. Click on Save button`);
      persesDashboardsPage.clickEditActionButton('Save');

      cy.log(`15.11. Back and check panel group`);
      persesDashboardsPage.backToListPersesDashboardsPage();
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
      listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);

      cy.log(`15.12. Assert Variable before deleting`);
      persesDashboardsPage.searchAndSelectVariable('ListVariable', 'All');

      cy.log(`15.13. Assert panel group exists`);
      persesDashboardsPage.panelGroupHeaderAssertion('PanelGroup Perform Changes and Save', 'Open');

      cy.log(`15.14. Assert panel exists`);
      persesDashboardsPage.assertPanel('Panel Perform Changes and Save', 'PanelGroup Perform Changes and Save', 'Open');

      cy.log(`15.15. Click on Edit button`);
      persesDashboardsPage.clickEditButton();

      cy.log(`15.16. Delete variable`);
      persesDashboardsPage.clickEditActionButton('EditVariables');
      persesDashboardsEditVariables.clickDeleteVariableButton(1);
      persesDashboardsEditVariables.clickButton('Apply');
      persesDashboardsPage.assertVariableNotExist('ListVariable');

      cy.log(`15.17. Delete panel group`);
      persesDashboardsPanelGroup.clickPanelGroupAction('PanelGroup Perform Changes and Save', 'delete');
      persesDashboardsPanelGroup.clickDeletePanelGroupButton();
      persesDashboardsPage.clickEditActionButton('Save');
      persesDashboardsPage.assertPanelGroupNotExist('PanelGroup Perform Changes and Save');

    });

}