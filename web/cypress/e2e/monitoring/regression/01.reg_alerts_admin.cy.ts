import { alerts } from '../../../fixtures/monitoring/alert';
import { runAllRegressionCorePlatformAlertsTests } from '../../../support/monitoring/01.reg_alerts.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

// Test suite for Core platform perspective
describe(
  'Regression: Monitoring - Alerts (Core platform)',
  { tags: ['@alerting', '@metrics'] },
  () => {
    before(() => {
      cy.beforeBlock(MP);
      cy.switchPerspective('Core platform');
    });

    beforeEach(() => {
      alerts.getWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.getWatchdogAlert();
    });

    // Run tests in Core platform perspective
    runAllRegressionCorePlatformAlertsTests({
      name: 'Core platform',
    });
  },
);
