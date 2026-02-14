import { nav } from '../../views/nav';
import { runCOOEditPersesTests1 } from '../../support/perses/02.coo_edit_perses_admin_1.cy';
import { runCOOEditPersesTests } from '../../support/perses/02.coo_edit_perses_admin.cy';

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

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe('COO - Dashboards (Perses) - Edit perses dashboard', { tags: ['@perses', '@dashboards-'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.wait(5000);
    cy.changeNamespace('All Projects');
  });

  runCOOEditPersesTests({ 
    name: 'Administrator',
  });

  runCOOEditPersesTests1({
    name: 'Administrator',
  });

});


