import { runAllRegressionMetricsTests } from '../../../support/monitoring/02.reg_metrics.cy';
import { runAllRegressionMetricsTestsNamespace } from '../../../support/monitoring/05.reg_metrics_namespace.cy';
import { nav } from '../../../views/nav';
import { guidedTour } from '../../../views/tour';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics (Administrator)', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    cy.changeNamespace("All Projects");
  });

  // Run tests in Administrator perspective
  runAllRegressionMetricsTests({
    name: 'Administrator',
  });

});

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics Namespaced (Administrator)', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    cy.changeNamespace(MP.namespace);
  });

  // Run tests in Administrator perspective
  runAllRegressionMetricsTestsNamespace({
    name: 'Administrator',
  });

});

