import { runAllRegressionMetricsTests1 } from '../../../support/monitoring/02.reg_metrics_1.cy';
import { runAllRegressionMetricsTestsNamespace1 } from '../../../support/monitoring/05.reg_metrics_namespace_1.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics (Administrator)', { tags: ['@monitoring', '@metrics'] }, () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.validateLogin();
    cy.switchPerspective('Core platform', 'Administrator');
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace("All Projects");
  });

  // Run tests in Administrator perspective
  runAllRegressionMetricsTests1({
    name: 'Administrator',
  });

});

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics Namespaced (Administrator)', { tags: ['@monitoring', '@metrics'] }, () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace(MP.namespace);
  });

  // Run tests in Administrator perspective
  runAllRegressionMetricsTestsNamespace1({
    name: 'Administrator',
  });

});

