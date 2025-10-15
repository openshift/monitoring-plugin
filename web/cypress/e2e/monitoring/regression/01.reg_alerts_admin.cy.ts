import { alerts } from '../../../fixtures/monitoring/alert';
import { runAllRegressionAlertsTests } from '../../../support/monitoring/01.reg_alerts.cy';
import { runAllRegressionAlertsTestsNamespace } from '../../../support/monitoring/04.reg_alerts_namespace.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';
import { guidedTour } from '../../../views/tour';

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
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    alerts.getWatchdogAlert();
    cy.changeNamespace("All Projects");
  });

  // Run tests in Administrator perspective
  runAllRegressionAlertsTests({
    name: 'Administrator',
  });

});

describe('Regression: Monitoring - Alerts Namespaced (Administrator)', { tags: ['@monitoring', '@alerts'] }, () => {

    before(() => {
      cy.beforeBlock(MP);
    });

    beforeEach(() => {
      cy.visit('/');
      guidedTour.close();
      cy.validateLogin();
      alerts.getWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.getWatchdogAlert();
      cy.changeNamespace(MP.namespace);
    });
  
    // Run tests in Administrator perspective
    runAllRegressionAlertsTestsNamespace({
      name: 'Administrator',
    });
  
});

