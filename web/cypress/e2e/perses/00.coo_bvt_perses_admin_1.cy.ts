import { nav } from '../../views/nav';
//TODO: rename after customizable-dashboards gets merged
import { runBVTCOOPersesTests1 } from '../../support/perses/00.coo_bvt_perses_admin_1.cy';
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

//TODO: change tag to @smoke, @dashboards, @perses when customizable-dashboards gets merged
describe('BVT: COO - Dashboards (Perses) - Administrator perspective', { tags: ['@smoke-', '@dashboards-', '@perses-'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
  });

  //TODO: rename after customizable-dashboards gets merged
  runBVTCOOPersesTests1({
    name: 'Administrator',
  });

});