import { CLUSTER_MONITORING_OPERATOR } from '../../../support/operators';
import { alerts } from '../../../fixtures/monitoring/alert';
import { runAllRegressionCorePlatformAlertsTests } from '../../../support/monitoring/01.reg_alerts.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';

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
      name: 'Core platform',
    });
  },
);
