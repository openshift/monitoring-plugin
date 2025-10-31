import { persesDashboardsAcceleratorsCommonMetricsPanels, persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/monitoring/constants';
import { commonPages } from '../../views/common';
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesDataTestIDs } from '../../../src/components/data-test';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runBVTCOOPersesTests(perspective: PerspectiveConfig) {
  testBVTCOOPerses(perspective);
}

export function testBVTCOOPerses(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - Dashboards (Perses) page`, () => {
    cy.log(`1.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    persesDashboardsPage.shouldBeLoaded();

    persesDashboardsPage.timeRangeDropdownAssertion();
    persesDashboardsPage.refreshIntervalDropdownAssertion();
    persesDashboardsPage.dashboardDropdownAssertion(persesDashboardsDashboardDropdownCOO);
    cy.wait(1000);
    cy.changeNamespace('perses-dev');
    persesDashboardsPage.dashboardDropdownAssertion(persesDashboardsDashboardDropdownPersesDev);
  });

  it(`2.${perspective.name} perspective - Accelerators common metrics dashboard `, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses) > Accelerators common metrics dashboard`);
    cy.changeNamespace('openshift-cluster-observability-operator');
    persesDashboardsPage.clickDashboardDropdown(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0] as keyof typeof persesDashboardsDashboardDropdownCOO);
    cy.byDataTestID(persesDataTestIDs.variableDropdown+'-cluster').should('be.visible');
    persesDashboardsPage.panelGroupHeaderAssertion('Accelerators');
    persesDashboardsPage.panelHeadersAcceleratorsCommonMetricsAssertion();
    persesDashboardsPage.expandCollapsePanel(persesDashboardsAcceleratorsCommonMetricsPanels.GPU_UTILIZATION);
    persesDashboardsPage.expandCollapsePanel(persesDashboardsAcceleratorsCommonMetricsPanels.GPU_UTILIZATION);
  });

  it(`3.${perspective.name} perspective - Perses Dashboard Sample dashboard`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses) > Perses Dashboard Sample dashboard`);
    cy.changeNamespace('perses-dev');
    persesDashboardsPage.clickDashboardDropdown(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] as keyof typeof persesDashboardsDashboardDropdownPersesDev);
    cy.byDataTestID(persesDataTestIDs.variableDropdown+'-job').should('be.visible');
    cy.byDataTestID(persesDataTestIDs.variableDropdown+'-instance').should('be.visible');
    cy.byDataTestID(persesDataTestIDs.variableDropdown+'-interval').should('be.visible');
    cy.byDataTestID(persesDataTestIDs.variableDropdown+'-text').should('be.visible');
    persesDashboardsPage.panelGroupHeaderAssertion('Row 1');
    persesDashboardsPage.expandCollapsePanel('RAM Used');
    persesDashboardsPage.expandCollapsePanel('RAM Used');
    persesDashboardsPage.statChartValueAssertion('RAM Used', true);
    persesDashboardsPage.searchAndSelectVariable('job', 'node-exporter');
    persesDashboardsPage.statChartValueAssertion('RAM Used', false);
  
  });

}
