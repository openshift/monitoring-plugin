import { runAllRegressionLegacyDashboardsTests } from '../../../support/monitoring/03.reg_legacy_dashboards.cy';
import { runAllRegressionLegacyDashboardsTestsNamespace } from '../../../support/monitoring/06.reg_legacy_dashboards_namespace.cy';
import { nav } from '../../../views/nav';
import { guidedTour } from '../../../views/tour';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

// Test suite for Administrator perspective
describe('Regression: Monitoring - Legacy Dashboards (Administrator)', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    cy.changeNamespace("All Projects");
  });

  // Run tests in Administrator perspective
  runAllRegressionLegacyDashboardsTests({
    name: 'Administrator',
  });

});

// Test suite for Administrator perspective
describe('Regression: Monitoring - Legacy Dashboards Namespaced (Administrator)', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    cy.changeNamespace(MP.namespace);
  });

  // Run tests in Administrator perspective
  runAllRegressionLegacyDashboardsTestsNamespace({
    name: 'Administrator',
  });

});

