import { alerts } from '../../fixtures/monitoring/alert';
import { runAllRegressionMetricsTests2 } from '../../support/monitoring/02.reg_metrics_2.cy';
import { runAllRegressionMetricsTestsNamespace2 } from '../../support/monitoring/05.reg_metrics_namespace_2.cy';
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
  });
});

describe('Regression: Monitoring - Metrics (Virtualization)', { tags: ['@virtualization', '@metrics'] }, () => {

  beforeEach(() => {
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace("All Projects");
    alerts.getWatchdogAlert();
  });

  runAllRegressionMetricsTests2({
    name: 'Virtualization',
  });

});

describe('Regression: Monitoring - Metrics Namespaced (Virtualization)', { tags: ['@virtualization', '@metrics'] }, () => {

  beforeEach(() => {
    cy.switchPerspective('Virtualization');
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace(MP.namespace);
    alerts.getWatchdogAlert();
  });

  runAllRegressionMetricsTestsNamespace2({
    name: 'Virtualization',
  });

});