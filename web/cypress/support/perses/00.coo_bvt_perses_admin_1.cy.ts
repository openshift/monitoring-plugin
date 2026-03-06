import { persesDashboardsAcceleratorsCommonMetricsPanels, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesMUIDataTestIDs } from '../../../src/components/data-test';
import { listPersesDashboardsPage } from '../../views/list-perses-dashboards';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runBVTCOOPersesTests1(perspective: PerspectiveConfig) {
  testBVTCOOPerses1(perspective);
}

export function testBVTCOOPerses1(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - Dashboards (Perses) page`, () => {
    cy.log(`1.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2]);
    persesDashboardsPage.shouldBeLoaded();
  });

  it(`2.${perspective.name} perspective - Accelerators common metrics dashboard `, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses) > Accelerators common metrics dashboard`);
    cy.changeNamespace('openshift-cluster-observability-operator');
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2]);
    cy.wait(2000);
    persesDashboardsPage.clickDashboardDropdown(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0] as keyof typeof persesDashboardsDashboardDropdownCOO);
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-cluster').should('be.visible');
    persesDashboardsPage.panelGroupHeaderAssertion('Accelerators');
    persesDashboardsPage.panelHeadersAcceleratorsCommonMetricsAssertion();
    persesDashboardsPage.expandPanel(persesDashboardsAcceleratorsCommonMetricsPanels.GPU_UTILIZATION);
    persesDashboardsPage.collapsePanel(persesDashboardsAcceleratorsCommonMetricsPanels.GPU_UTILIZATION);
  });

  it(`3.${perspective.name} perspective - Perses Dashboard Sample dashboard`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses) > Perses Dashboard Sample dashboard`);
    cy.changeNamespace('perses-dev');
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
    cy.wait(2000);
    persesDashboardsPage.clickDashboardDropdown(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] as keyof typeof persesDashboardsDashboardDropdownPersesDev);
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-job').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-instance').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-interval').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.variableDropdown+'-text').should('be.visible');
    persesDashboardsPage.panelGroupHeaderAssertion('Row 1');
    persesDashboardsPage.expandPanel('RAM Used');
    persesDashboardsPage.collapsePanel('RAM Used');
    persesDashboardsPage.statChartValueAssertion('RAM Used', true);
    persesDashboardsPage.searchAndSelectVariable('job', 'node-exporter');
    persesDashboardsPage.statChartValueAssertion('RAM Used', false);
  
  });

}
