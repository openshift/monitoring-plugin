// E2E test for validating ACM Alerting UI integration with Cluster Observability Operator (COO)
import '../../support/shared/commands/auth-commands';
import { troubleshootingPanelPage } from '../../views/shared/troubleshooting-panel';
import { incidentsPage } from '../../views/incidents/incidents-page';
import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { commonPages } from '../../views/shared/common';
import { nav } from '../../views/shared/nav';
import { acmAlertingPage } from '../../views/alerts/acm-alerting-page';
import {
  testAlertsFleetManagementRegression,
  testAlertsRegression,
} from '../../support/alerts/alerts_regressions.cy';
import { listPage } from '../../views/shared/list-page';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/shared/operators';

const expectedAlerts = ['Watchdog', 'Watchdog-spoke', 'ClusterCPUHealth-jb'];

describe('ACM Alerting UI', { tags: ['@alerting', '@acm', '@coo'] }, () => {
  before(() => {
    cy.beforeBlockACM(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
  });

  it('Navigate to Fleet Management > Observe > Alerting', () => {
    // check monitoring-plugin UI is not been affected
    cy.switchPerspective('Core platform');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    nav.tabs.switchTab('Incidents');
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace('All Projects');
    // switch to Fleet Management page
    cy.switchPerspective('Fleet management');
    // close pop-up window
    cy.closeOnboardingModalIfPresent();
    commonPages.titleShouldHaveText('Clusters');
    // click side menu -> Observe -> Alerting
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    // confirm Alerting page loading completed
    acmAlertingPage.shouldBeLoaded();
    listPage.filter.clearAllFilters();
    // check test alerts exist
    expectedAlerts.forEach((alert) => {
      cy.contains('a[data-test-id="alert-resource-link"]', alert, { timeout: 120000 }).should(
        'be.visible',
      );
    });
    cy.log('Verified all expected alerts are visible on the Alerting page');
    cy.log('ACM Alerting UI test completed successfully');
  });

  it('Visual validation for features that should not be displayed under Fleet management perspective', () => {
    // check Incidents page is not displayed under Fleet management perspective
    cy.log('Incidents page should not be displayed under Fleet management perspective');
    cy.switchPerspective('Fleet management');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    incidentsPage.incidentsPageShouldNotBeVisible();

    // check Signal correlation option is not displayed under Fleet management perspective
    cy.log('Signal correlation option should not be displayed under Fleet management perspective');
    troubleshootingPanelPage.signalCorrelationShouldNotBeVisible();
  });

  testAlertsFleetManagementRegression(CustomerPerspectiveName.FleetManagement, 'Watchdog-spoke');
  testAlertsRegression(
    CustomerPerspectiveName.FleetManagement,
    'Watchdog-spoke',
    CLUSTER_MONITORING_OPERATOR.namespace,
  );
});
