import { nav } from '../../../views/nav';
import common = require('mocha/lib/interfaces/common');
import { legacyDashboardsPage } from '../../../views/legacy-dashboards';
import { API_PERFORMANCE_DASHBOARD_PANELS, MetricsPageQueryInput, LegacyDashboardsDashboardDropdown } from '../../../fixtures/monitoring/constants';
import { Classes, LegacyDashboardPageTestIDs, DataTestIDs } from '../../../../src/components/data-test';
import { metricsPage } from '../../../views/metrics';
// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Monitoring - Dashboards (Legacy)', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  after(() => {
    cy.afterBlock(MP);
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
    legacyDashboardsPage.dashboardDropdownAssertion();

    cy.log('1.5 Dashboard API Performance panels');
    for (const panel of Object.values(API_PERFORMANCE_DASHBOARD_PANELS)) {
      legacyDashboardsPage.dashboardAPIPerformancePanelAssertion(panel);
    }

  });

  it('2. Admin perspective - Dashboards (legacy) - Inspect and Export as CSV', () => {
    cy.log('2.1 Inspect - API Request Duration by Verb - 99th Percentile');
    cy.byTestID(LegacyDashboardPageTestIDs.Inspect).eq(0).scrollIntoView().should('be.visible').click();
    metricsPage.shouldBeLoadedWithGraph();
    cy.get(Classes.MetricsPageQueryInput).eq(0).should('contain', MetricsPageQueryInput.API_REQUEST_DURATION_BY_VERB_99TH_PERCENTILE_QUERY);

    cy.log('2.2 Kebab dropdown - Export as CSV');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    legacyDashboardsPage.clickKebabDropdown(0);
    cy.byTestID(LegacyDashboardPageTestIDs.ExportAsCsv).should('be.visible');
    cy.byPFRole('menuitem').should('not.have.attr', 'disabled');
    legacyDashboardsPage.exportAsCSV(true, 'graphData.csv');

    cy.log('2.3 Empty state');
    legacyDashboardsPage.clickDashboardDropdown('K8S_COMPUTE_RESOURCES_POD');
    cy.byTestID(DataTestIDs.MetricGraphNoDatapointsFound).eq(0).scrollIntoView().should('be.visible');
    legacyDashboardsPage.clickKebabDropdown(0);
    cy.byTestID(LegacyDashboardPageTestIDs.ExportAsCsv).should('be.visible');
    cy.byPFRole('menuitem').should('have.attr', 'disabled');
    
  });

  it('3. Admin perspective - Dashboards (legacy) - No kebab dropdown', () => {
    cy.log('3.1 Single Stat - No kebab dropdown');
    legacyDashboardsPage.clickDashboardDropdown('K8S_COMPUTE_RESOURCES_NAMESPACE_PODS');
    cy.byLegacyTestID('chart-1').find('[data-test="'+DataTestIDs.KebabDropdownButton+'"]').should('not.exist');

    cy.log('3.2 Table - No kebab dropdown');
    legacyDashboardsPage.clickDashboardDropdown('PROMETHEUS_OVERVIEW');
    cy.byLegacyTestID('chart-1').find('[data-test="'+DataTestIDs.KebabDropdownButton+'"]').should('not.exist');

  });

});

