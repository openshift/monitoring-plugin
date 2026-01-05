import { editPersesDashboardsAddVariable, persesMUIDataTestIDs, IDs, editPersesDashboardsAddDatasource } from '../../../src/components/data-test';
import { persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from "../../views/list-perses-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';
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

    cy.log(`13.4. Click on Edit button`);
    cy.wait(2000);
    persesDashboardsPage.clickEditButton();

    cy.log(`13.4. Click on Add Group`);
    persesDashboardsPage.clickEditActionButton('AddGroup');
    persesDashboardsPanelGroup.addPanelGroup('PanelGroup1', 'Open', '');
    persesDashboardsPage.clickEditActionButton('Save');
    
    cy.log(`13.5. Click on Add Panel button`);
    persesDashboardsPage.clickEditActionButton('AddPanel');
    persesDashboardsPanel.addPanelShouldBeLoaded();

    cy.log(`13.6. Add panel`);
    persesDashboardsPanel.addPanel('Panel1', 'Open', '');
    persesDashboardsPage.clickEditActionButton('Save');
    persesDashboardsPage.assertPanel('Panel1', 'Open');
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
