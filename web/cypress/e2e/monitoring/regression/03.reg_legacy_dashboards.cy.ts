import { nav } from '../../../views/nav';
import common = require('mocha/lib/interfaces/common');
import { legacyDashboardsPage } from '../../../views/legacy-dashboards';
import { API_PERFORMANCE_DASHBOARD_PANELS, LegacyDashboardsDashboardDropdown, MetricsPageQueryInput, WatchdogAlert } from '../../../fixtures/monitoring/constants';
import { Classes, LegacyDashboardPageTestIDs, DataTestIDs } from '../../../../src/components/data-test';
import { metricsPage } from '../../../views/metrics';
import { alertingRuleDetailsPage } from '../../../views/alerting-rule-details-page';
import { alerts } from '../../../fixtures/monitoring/alert';
import { listPage } from '../../../views/list-page';
import { commonPages } from '../../../views/common';
// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Monitoring - Dashboards (Legacy)', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace("All Projects");
  });

  it('1. Admin perspective - Dashboards (legacy)', () => {
    cy.log('1.1 Dashboards page loaded');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    legacyDashboardsPage.shouldBeLoaded();

    cy.log('1.2 Time range dropdown');
    legacyDashboardsPage.timeRangeDropdownAssertion();

    cy.log('1.3 Refresh interval dropdown');
    legacyDashboardsPage.refreshIntervalDropdownAssertion();

    cy.log('1.4 Dashboard dropdown');
    legacyDashboardsPage.dashboardDropdownAssertion(LegacyDashboardsDashboardDropdown);

    cy.log('1.5 Dashboard API Performance panels');
    for (const panel of Object.values(API_PERFORMANCE_DASHBOARD_PANELS)) {
      legacyDashboardsPage.dashboardAPIPerformancePanelAssertion(panel);
    }

    cy.log('1.6 Inspect - API Request Duration by Verb - 99th Percentile');
    cy.byTestID(LegacyDashboardPageTestIDs.Inspect).eq(0).scrollIntoView().should('be.visible').click();
    metricsPage.shouldBeLoadedWithGraph();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.API_REQUEST_DURATION_BY_VERB_99TH_PERCENTILE_QUERY);

  });

  it('2. Admin perspective - Dashboards (legacy) - Inspect and Export as CSV', () => {
    cy.log('2.1 Kebab dropdown - Export as CSV');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    legacyDashboardsPage.clickKebabDropdown(0);
    cy.byTestID(LegacyDashboardPageTestIDs.ExportAsCsv).should('be.visible');
    cy.byPFRole('menuitem').should('not.have.attr', 'disabled');
    legacyDashboardsPage.exportAsCSV(true, 'graphData.csv');

    cy.log('2.2 Empty state');
    legacyDashboardsPage.clickDashboardDropdown('K8S_COMPUTE_RESOURCES_POD');
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).eq(0).scrollIntoView().should('be.visible');
    legacyDashboardsPage.clickKebabDropdown(0);
    cy.byTestID(LegacyDashboardPageTestIDs.ExportAsCsv).should('be.visible');
    cy.byPFRole('menuitem').should('have.attr', 'disabled');
    
  });

  it('3. Admin perspective - Dashboards (legacy) - No kebab dropdown', () => {
    cy.log('3.1 Single Stat - No kebab dropdown');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    legacyDashboardsPage.clickDashboardDropdown('K8S_COMPUTE_RESOURCES_NAMESPACE_PODS');
    cy.byLegacyTestID('chart-1').find('[data-test="'+DataTestIDs.KebabDropdownButton+'"]').should('not.exist');

    cy.log('3.2 Table - No kebab dropdown');
    legacyDashboardsPage.clickDashboardDropdown('PROMETHEUS_OVERVIEW');
    cy.byLegacyTestID('chart-1').find('[data-test="'+DataTestIDs.KebabDropdownButton+'"]').should('not.exist');

  });

  it('4. Admin perspective - OU-897 - Hide Graph / Show Graph on Metrics, Alert Details and Dashboards', () => {
    cy.log('4.1 Observe > Metrics > Hide Graph');
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    metricsPage.shouldBeLoaded();
    metricsPage.clickHideGraphButton();
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
    
    cy.log('4.2 Observe > Dashboards - Verify graph is visible');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    
    cy.log('4.3 Observe > Alerting rule details - Verify graph is visible');
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    alerts.getWatchdogAlert();
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);
    listPage.ARRows.clickAlertingRule();
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    alertingRuleDetailsPage.clickHideGraphButton();
    cy.wait(2000);
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
    alertingRuleDetailsPage.clickShowGraphButton();
    cy.wait(2000);
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    cy.wait(2000);
    alertingRuleDetailsPage.clickHideGraphButton();
    cy.wait(2000);
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
    cy.wait(2000);

    cy.log('4.4 Observe > Alert details - Verify graph is visible');
    cy.byTestID(DataTestIDs.AlertResourceLink).first().click();
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).contains('Hide graph').should('be.visible');
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).contains('Hide graph').should('be.visible').click();
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).contains('Show graph').should('be.visible').click();
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    cy.byTestID(DataTestIDs.MetricHideShowGraphButton).contains('Hide graph').should('be.visible').click();
    cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
   
    cy.log('4.5 Observe > Metrics > Hide Graph');
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    metricsPage.shouldBeLoaded();
    
    cy.log('4.6 Observe > Dashboards - Verify graph is visible');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');

  });

});

