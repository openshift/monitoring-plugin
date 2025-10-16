/**
 * EXAMPLE: Regression Alerts Tests - Both Perspectives
 * 
 * This file demonstrates how to run the same regression tests
 * in BOTH perspectives within a single file.
 */

import { runAllRegressionAlertsTests } from '../../../support/monitoring/01.reg_alerts.cy';
import { runAllRegressionAlertsTestsNamespace } from '../../../support/monitoring/04.reg_alerts_namespace.cy';
import { nav } from '../../../views/nav';
import { guidedTour } from '../../../views/tour';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

// Test suite for Administrator perspective
describe('Regression: Monitoring - Alerts (Administrator)', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.visit('/');
    cy.switchPerspective('Administrator');
    guidedTour.closeKubevirtTour();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace("All Projects");
  });

  // Run tests in Administrator perspective
  runAllRegressionAlertsTests({
    name: 'Administrator',
  });

});

describe('Regression: Monitoring - Alerts Namespaced (Administrator)', () => {

    before(() => {
      cy.beforeBlock(MP);
    });

    beforeEach(() => {
      cy.visit('/');
      cy.switchPerspective('Administrator');
      guidedTour.closeKubevirtTour();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      cy.changeNamespace(MP.namespace);
    });
  
    // Run tests in Administrator perspective
    runAllRegressionAlertsTestsNamespace({
      name: 'Administrator',
    });
  
});

