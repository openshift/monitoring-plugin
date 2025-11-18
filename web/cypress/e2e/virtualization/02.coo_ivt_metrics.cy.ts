import { alerts } from '../../fixtures/monitoring/alert';
import { runAllRegressionMetricsTests } from '../../support/monitoring/02.reg_metrics.cy';
import { runAllRegressionMetricsTestsNamespace } from '../../support/monitoring/05.reg_metrics_namespace.cy';
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

describe('Installation: COO and setting up Monitoring Plugin', () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  it('1. Installation: COO and setting up Monitoring Plugin', () => {
    cy.log('Installation: COO and setting up Monitoring Plugin');
  });
});

describe('IVT: Monitoring UIPlugin + Virtualization', () => {

  before(() => {
    cy.beforeBlockVirtualization(KBV);
  });

  it('1. Virtualization perspective - Observe Menu', () => {
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
  });
});

describe('Regression: Monitoring - Metrics (Virtualization)', () => {

  beforeEach(() => {
    cy.visit('/');
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace("All Projects");
    alerts.getWatchdogAlert();
  });

  runAllRegressionMetricsTests({
    name: 'Virtualization',
  });

});

describe('Regression: Monitoring - Metrics Namespaced (Virtualization)', () => {

  beforeEach(() => {
    cy.visit('/');
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace(MP.namespace);
    alerts.getWatchdogAlert();
  });

  runAllRegressionMetricsTestsNamespace({
    name: 'Virtualization',
  });

});