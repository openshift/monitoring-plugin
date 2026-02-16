import { alerts } from '../../../fixtures/monitoring/alert';
import { runAllRegressionAlertsTests } from '../../../support/monitoring/01.reg_alerts.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

// Test suite for Administrator perspective
describe('Regression: Monitoring - Alerts (Administrator)', { tags: ['@monitoring', '@alerts'] }, () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    commonPages.projectDropdownShouldNotExist();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    commonPages.projectDropdownShouldNotExist();
    alerts.getWatchdogAlert();
  });

  // Run tests in Administrator perspective
  runAllRegressionAlertsTests({
    name: 'Administrator',
  });

});


