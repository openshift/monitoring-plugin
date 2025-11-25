import { alerts } from '../../fixtures/monitoring/alert';
import { runAllRegressionAlertsTests } from '../../support/monitoring/01.reg_alerts.cy';
import { runAllRegressionAlertsTestsNamespace } from '../../support/monitoring/04.reg_alerts_namespace.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';

// Set constants for the operators that need to be installed for tests.
const MCP = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

const KBV = {
  namespace: 'openshift-cnv',
  packageName: 'kubevirt-hyperconverged',
  config: {
    kind: 'HyperConverged',
    name: 'kubevirt-hyperconverged',
  },
  crd: {
    kubevirt: 'kubevirts.kubevirt.io',
    hyperconverged: 'hyperconvergeds.hco.kubevirt.io',
  }
};

describe('Installation: COO and setting up Monitoring Plugin', { tags: ['@virtualization', '@slow'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  it('1. Installation: COO and setting up Monitoring Plugin', () => {
    cy.log('Installation: COO and setting up Monitoring Plugin');
  });
});

describe('IVT: Monitoring UIPlugin + Virtualization', { tags: ['@virtualization', '@slow'] }, () => {

  before(() => {
    cy.beforeBlockVirtualization(KBV);
  });

  it('1. Virtualization perspective - Observe Menu', () => {
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
  });
});

describe('Regression: Monitoring - Alerts (Virtualization)', { tags: ['@virtualization', '@alerts'] }, () => {

  beforeEach(() => {
    cy.visit('/');
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    cy.changeNamespace("All Projects");
    alerts.getWatchdogAlert();
  });
  // Run tests in Virtualization perspective
  runAllRegressionAlertsTests({
    name: 'Virtualization',
  });

});

describe('Regression: Monitoring - Alerts Namespaced (Virtualization)', { tags: ['@virtualization', '@alerts'] }, () => {

  beforeEach(() => {
    cy.visit('/');
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    cy.changeNamespace(MP.namespace);
    alerts.getWatchdogAlert();
    
  });
  // Run tests in Virtualization perspective
  runAllRegressionAlertsTestsNamespace({
    name: 'Virtualization',

  });

});