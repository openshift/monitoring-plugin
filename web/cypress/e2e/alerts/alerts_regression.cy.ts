import { runAllRegressionCorePlatformAlertsTests } from '../../support/alerts/alerts_regressions.cy';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import { runAllRegressionAlertsTestsNamespace } from '../../support/alerts/alerts_regressions_namespaced.cy';
import { commonPages } from '../../views/shared/common';
import { nav } from '../../views/shared/nav';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/shared/operators';

// Test suite for Core platform perspective
describe(
  'Regression: Monitoring - Alerts (Core platform)',
  { tags: ['@alerting', '@metrics'] },
  () => {
    before(() => {
      cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
      cy.switchPerspective('Core platform');
    });

    beforeEach(() => {
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
    });

    // Run tests in Core platform perspective
    runAllRegressionCorePlatformAlertsTests({
      name: 'Administrator',
    });
  },
);

describe(
  'Regression: Monitoring - Alerts Namespaced (Administrator)',
  { tags: ['@alerting'] },
  () => {
    before(() => {
      cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    runAllRegressionAlertsTestsNamespace({
      name: 'Administrator',
    });
  },
);
