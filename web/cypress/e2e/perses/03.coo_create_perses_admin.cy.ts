import { nav } from '../../views/nav';
import { runCOOCreatePersesTests } from '../../support/perses/03.coo_create_perses_admin.cy';

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
describe('COO - Dashboards (Perses) - Create perses dashboard', { tags: ['@perses', '@dashboards-'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
    cy.setupPersesRBACandExtraDashboards();
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.wait(5000);
    cy.changeNamespace('All Projects');
  });

  after(() => {
    cy.cleanupExtraDashboards();
  });

  runCOOCreatePersesTests({ 
    name: 'Administrator',
  });

});


