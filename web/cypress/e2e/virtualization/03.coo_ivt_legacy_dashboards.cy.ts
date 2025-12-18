import { alerts } from '../../fixtures/monitoring/alert';
import { runAllRegressionLegacyDashboardsTests } from '../../support/monitoring/03.reg_legacy_dashboards.cy';
import { runAllRegressionLegacyDashboardsTestsNamespace } from '../../support/monitoring/06.reg_legacy_dashboards_namespace.cy';
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

describe('Regression: Monitoring - Legacy Dashboards (Virtualization)', { tags: ['@virtualization', '@dashboards'] }, () => {

  beforeEach(() => {
    cy.switchPerspective('Virtualization');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    commonPages.titleShouldHaveText('Dashboards');
    cy.changeNamespace("All Projects");
  });

  runAllRegressionLegacyDashboardsTests({
    name: 'Virtualization',
  });

});

describe('Regression: Monitoring - Legacy Dashboards Namespaced (Virtualization)', { tags: ['@virtualization', '@dashboards'] }, () => {
  beforeEach(() => {
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    commonPages.titleShouldHaveText('Dashboards');
    cy.changeNamespace(MP.namespace);
  });

  runAllRegressionLegacyDashboardsTestsNamespace({
    name: 'Virtualization',
  });
});