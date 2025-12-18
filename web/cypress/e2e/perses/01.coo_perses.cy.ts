import { nav } from '../../views/nav';
import { runBVTCOOPersesTests } from '../../support/perses/00.coo_bvt_perses.cy';

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

describe('BVT: COO - Dashboards (Perses) - Administrator perspective', { tags: ['@smoke', '@dashboards'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.changeNamespace(MCP.namespace);
  });

  runBVTCOOPersesTests({
    name: 'Administrator',
  });

});