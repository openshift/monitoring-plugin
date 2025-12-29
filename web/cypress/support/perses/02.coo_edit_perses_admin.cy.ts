import { persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from "../../views/list-perses-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';

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

  it(`2.${perspective.name} perspective - Edit Toolbar - Edit Variables`, () => {

  });

  it(`3.${perspective.name} perspective - Edit Toolbar - Edit Datasources`, () => {

  });

  it(`4.${perspective.name} perspective - Edit Toolbar - Add Panel`, () => {

  });

  it(`5.${perspective.name} perspective - Edit Toolbar - Add Panel Group`, () => {

  });

  it(`6.${perspective.name} perspective - Panel Group Toolbar - Add Panel to Panel Group`, () => {

  });

  it(`7.${perspective.name} perspective - Panel Group Toolbar - Edit Panel Group`, () => {

  });

  it(`8.${perspective.name} perspective - Panel Group Toolbar - Delete Panel Group`, () => {

  });

  it(`9.${perspective.name} perspective - Panel Group Toolbar - Move Panel Group Down`, () => {

  });

  it(`10.${perspective.name} perspective - Panel Group Toolbar - Move Panel Group Up`, () => {

  });

  it(`11.${perspective.name} perspective - Panel Toolbar - Edit Panel`, () => {

  });

  it(`12.${perspective.name} perspective - Panel Toolbar - Duplicate Panel`, () => {

  });

  it(`13.${perspective.name} perspective - Panel Toolbar - Delete Panel`, () => {

  });

  it(`14.${perspective.name} perspective - Perform changes and Cancel`, () => {

  });

  it(`15.${perspective.name} perspective - Perform changes and Save`, () => {

  });

  /** TODO: OU-886 Mark dashboards and datasources created using CRD as readonly
  it(`X.${perspective.name} perspective - Try to editAccelerators and APM dashboards`, () => {

  });
  */

}
