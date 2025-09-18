import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';


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

describe('BVT: COO', () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);

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
