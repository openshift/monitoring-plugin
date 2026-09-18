import { nav } from '../../views/shared/nav';
import { legacyDashboardsPage } from '../../views/legacy-dashboards/legacy-dashboards';
import {
  LegacyDashboardsDashboardDropdown,
  MetricsPageQueryInput,
  WatchdogAlert,
} from '../../fixtures/shared/cluster-monitoring-operator/constants';
import { Classes, DataTestIDs, LegacyDashboardPageTestIDs } from '@/shared/constants/data-test';
import { metricsPage } from '../../views/metrics/metrics';
import { alertingRuleDetailsPage } from '../../views/alerts/alerting-rule-details-page';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import type { CustomerPerspective } from '@/shared/constants/perspective';
import { alertsListPage } from '../../views/alerts/alerts-list-page';
import { commonPages } from '../../views/shared/common';

export function testLegacyDashboardsRegression(perspectiveName: CustomerPerspective) {
  it(`${perspectiveName} perspective - Dashboards (legacy)`, () => {
    cy.log('1.1 Dashboards page loaded');
    legacyDashboardsPage.shouldBeLoaded();

    cy.log('1.2 Time range dropdown');
    legacyDashboardsPage.timeRangeDropdownAssertion();

    cy.log('1.3 Refresh interval dropdown');
    legacyDashboardsPage.refreshIntervalDropdownAssertion();

    cy.log('1.4 Dashboard dropdown');
    legacyDashboardsPage.dashboardDropdownAssertion(LegacyDashboardsDashboardDropdown);

    legacyDashboardsPage.clickDashboardDropdown('API_PERFORMANCE');

    cy.log('1.5 Dashboard API Performance panels');
    legacyDashboardsPage.dashboardAPIPerformancePanelAssertion();

    cy.log('1.6 Inspect - API Request Duration by Verb - 99th Percentile');
    cy.byTestID(LegacyDashboardPageTestIDs.Inspect)
      .eq(0)
      .scrollIntoView()
      .should('be.visible')
      .click();
    metricsPage.shouldBeLoadedWithGraph();
    cy.get(Classes.MetricsPageQueryInput)
      .eq(0)
      .should('contain', MetricsPageQueryInput.API_REQUEST_DURATION_BY_VERB_99TH_PERCENTILE_QUERY);
  });

  it(`${perspectiveName} perspective - Dashboards (legacy) - Inspect and Export as CSV`, () => {
    cy.log('2.1 Kebab dropdown - Export as CSV');
    legacyDashboardsPage.clickKebabDropdown(0);
    cy.byTestID(LegacyDashboardPageTestIDs.ExportAsCsv).should('be.visible');
    cy.byPFRole('menuitem').should('not.have.attr', 'disabled');
    legacyDashboardsPage.exportAsCSV(true, 'graphData.csv');

    cy.log('2.2 Empty state');
    legacyDashboardsPage.clickDashboardDropdown('K8S_COMPUTE_RESOURCES_POD');
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound)
      .eq(0)
      .scrollIntoView()
      .should('be.visible');
    legacyDashboardsPage.clickKebabDropdown(0);
    cy.byTestID(LegacyDashboardPageTestIDs.ExportAsCsv).should('be.visible');
    cy.byPFRole('menuitem').should('have.attr', 'disabled');
  });

  it(`${perspectiveName} perspective - Dashboards (legacy) - No kebab dropdown`, () => {
    cy.log('3.1 Single Stat - No kebab dropdown');
    legacyDashboardsPage.clickDashboardDropdown('K8S_COMPUTE_RESOURCES_NAMESPACE_PODS');
    cy.byLegacyTestID('chart-1')
      .find('[data-test="' + DataTestIDs.KebabDropdownButton + '"]')
      .should('not.exist');

    cy.log('3.2 Table - No kebab dropdown');
    legacyDashboardsPage.clickDashboardDropdown('PROMETHEUS_OVERVIEW');
    cy.byLegacyTestID('chart-1')
      .find('[data-test="' + DataTestIDs.KebabDropdownButton + '"]')
      .should('not.exist');
  });

  it(
    `${perspectiveName} perspective - OU-897 - ` +
      'Hide Graph / Show Graph on Metrics, Alert Details and Dashboards',
    () => {
      cy.log('4.1 Observe > Metrics > Hide Graph');
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      metricsPage.shouldBeLoaded();
      metricsPage.clickHideGraphButton();
      cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');

      cy.log('4.2 Observe > Dashboards - Verify graph is visible');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');

      cy.log('4.3 Observe > Alerting rule details - Verify graph is visible');
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
      alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      alertsListPage.ARRows.countShouldBe(1);
      alertsListPage.ARRows.clickAlertingRule();
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      alertingRuleDetailsPage.clickHideGraphButton();
      cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
      alertingRuleDetailsPage.clickShowGraphButton();
      cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
      alertingRuleDetailsPage.clickHideGraphButton();
      cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');

      cy.log('4.4 Observe > Alert details - Verify graph is visible');
      cy.byTestID(DataTestIDs.AlertResourceLink).first().click();
      cy.byTestID(DataTestIDs.MetricHideShowGraphButton)
        .contains('Hide graph')
        .should('be.visible');
      cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
      cy.byTestID(DataTestIDs.MetricHideShowGraphButton)
        .contains('Hide graph')
        .should('be.visible')
        .click();
      cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
      cy.byTestID(DataTestIDs.MetricHideShowGraphButton)
        .contains('Show graph')
        .should('be.visible')
        .click();
      cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
      cy.byTestID(DataTestIDs.MetricHideShowGraphButton)
        .contains('Hide graph')
        .should('be.visible')
        .click();
      cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');

      cy.log('4.5 Observe > Metrics > Hide Graph');
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      metricsPage.shouldBeLoaded();

      cy.log('4.6 Observe > Dashboards - Verify graph is visible');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    },
  );
}
