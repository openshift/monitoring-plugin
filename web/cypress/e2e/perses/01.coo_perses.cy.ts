import { nav } from '../../views/nav';
import { runBVTCOOPersesTests } from '../../support/perses/00.coo_bvt_perses.cy';
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

describe('BVT: COO - Dashboards (Perses) - Administrator perspective', { tags: ['@smoke', '@dashboards'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
  });

  runBVTCOOPersesTests({
    name: 'Administrator',
  });

});