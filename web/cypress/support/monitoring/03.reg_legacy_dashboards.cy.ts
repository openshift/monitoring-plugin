import { legacyDashboardsPage } from '../../views/legacy-dashboards';
import { LegacyDashboardsDashboardDropdown, MetricsPageQueryInput, WatchdogAlert } from '../../fixtures/monitoring/constants';
import { Classes, DataTestIDs, LegacyTestIDs } from '../../../src/components/data-test';
import { metricsPage } from '../../views/metrics';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runAllRegressionLegacyDashboardsTests(perspective: PerspectiveConfig) {
  testLegacyDashboardsRegression(perspective);
}

export function testLegacyDashboardsRegression(perspective: PerspectiveConfig) {

  it(`${perspective.name} perspective - Dashboards (legacy)`, () => {
    cy.log('1.1 Dashboards page loaded');
    legacyDashboardsPage.shouldBeLoaded();

    cy.log('1.2 Time range dropdown');
    legacyDashboardsPage.timeRangeDropdownAssertion();

    cy.log('1.3 Refresh interval dropdown');
    legacyDashboardsPage.refreshIntervalDropdownAssertion();

    cy.log('1.4 Dashboard dropdown');
    legacyDashboardsPage.dashboardDropdownAssertion(LegacyDashboardsDashboardDropdown);

    legacyDashboardsPage.clickDashboardDropdown('API_PERFORMANCE' as keyof typeof LegacyDashboardsDashboardDropdown);

    cy.log('1.5 Dashboard API Performance panels');
    legacyDashboardsPage.dashboardAPIPerformancePanelAssertion();

    cy.log('1.6 Inspect - API Request Duration by Verb - 99th Percentile');
    cy.byAriaLabel('Inspect').eq(0).scrollIntoView().should('be.visible').click();
    metricsPage.shouldBeLoadedWithGraph();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.API_REQUEST_DURATION_BY_VERB_99TH_PERCENTILE_QUERY);

  });

  it(`${perspective.name} perspective - Dashboards (legacy) - Inspect and Export as CSV`, () => {
    cy.log('2.1 Kebab dropdown - Export as CSV');
    legacyDashboardsPage.clickKebabDropdown(0);
    cy.byPFRole('menuitem').contains('Export as CSV').should('not.have.attr', 'disabled');
    legacyDashboardsPage.exportAsCSV(true, 'graphData.csv');

    cy.log('2.2 Empty state');
    legacyDashboardsPage.clickDashboardDropdown('K8S_COMPUTE_RESOURCES_POD');
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).eq(0).scrollIntoView().should('be.visible');
    cy.byLegacyTestID(LegacyTestIDs.KebabButton).should('not.exist');

  });

  it(`${perspective.name} perspective - Dashboards (legacy) - No kebab dropdown`, () => {
    cy.log('3.1 Single Stat - No kebab dropdown');
    legacyDashboardsPage.clickDashboardDropdown('K8S_COMPUTE_RESOURCES_NAMESPACE_PODS');
    cy.byLegacyTestID('chart-1').find('[data-test-id="' + LegacyTestIDs.KebabButton + '"]').should('not.exist');

    cy.log('3.2 Table - No kebab dropdown');
    legacyDashboardsPage.clickDashboardDropdown('PROMETHEUS_OVERVIEW');
    cy.byLegacyTestID('chart-1').find('[data-test-id="' + LegacyTestIDs.KebabButton + '"]').should('not.exist');

  });

  // it(`${perspective.name} perspective - OU-897 - Hide Graph / Show Graph on Metrics, Alert Details and Dashboards`, () => 
  // This bug was not backported to legacy dashboards for 4.19- versions.
  // });

}