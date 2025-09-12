import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';


// Set constants for the operators that need to be installed for tests.
const KBV = {
  namespace: 'openshift-cnv',
  packageName: 'kubevirt-hyperconverged',
  operatorName: 'kubevirt-hyperconverged-operator.v4.19.0',
  config: {
    kind: 'HyperConverged',
    name: 'kubevirt-hyperconverged',
  },
};

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

describe('IVT: Monitoring UIPlugin + Virtualization', () => {

  before(() => {
    cy.afterBlockCOO(MCP, MP); // Following best practices, the cleanup is done before the test block
    cy.afterBlockVirtualization(KBV);
    cy.beforeBlockCOO(MCP, MP);
    cy.beforeBlockVirtualization(KBV);

  });


  after(() => {
    cy.afterBlockCOO(MCP, MP);
    cy.afterBlockVirtualization(KBV);
  });

  it('1. Admin perspective - Observe Menu', () => {
    cy.log('Admin perspective - Observe Menu and verify all submenus');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    nav.tabs.switchTab('Silences');
    nav.tabs.switchTab('Alerting rules');
    // nav.tabs.switchTab('Incidents');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    commonPages.titleShouldHaveText('Dashboards');

  });

  /**
   * TODO: To be replaced by COO validation such as Dashboards (Perses) scenarios
   */

});
