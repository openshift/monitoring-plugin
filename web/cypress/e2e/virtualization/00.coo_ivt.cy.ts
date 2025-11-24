import { runBVTMonitoringTests } from '../../support/monitoring/00.bvt_monitoring.cy';
import { runBVTMonitoringTestsNamespace } from '../../support/monitoring/00.bvt_monitoring_namespace.cy';
import { guidedTour } from '../../views/tour';
import { alerts } from '../../fixtures/monitoring/alert';
import { nav } from '../../views/nav';
import { commonPages } from '../../views/common';

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

describe('Installation: Virtualization', { tags: ['@virtualization', '@slow'] }, () => {

  before(() => {
    cy.beforeBlockVirtualization(KBV);
  });

  it('1. Virtualization perspective - Observe Menu', () => {
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
  });
});

describe('IVT: Monitoring + Virtualization', { tags: ['@smoke', '@virtualization'] }, () => {

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace("All Projects");
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    alerts.getWatchdogAlert();
  });

  // Run tests in Administrator perspective
  runBVTMonitoringTests({
    name: 'Virtualization',
  });

});