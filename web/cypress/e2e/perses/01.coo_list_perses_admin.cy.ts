import { nav } from '../../views/nav';
import { runCOOListPersesTests } from '../../support/perses/01.coo_list_perses_admin.cy';
import { runCOOListPersesTestsNamespace } from '../../support/perses/01.coo_list_perses_admin_namespace.cy';

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
describe('COO - Dashboards (Perses) - List perses dashboards', { tags: ['@perses', '@dashboards-'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.changeNamespace('All Projects');
  });

  runCOOListPersesTests({
    name: 'Administrator',
  });

});

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe('COO - Dashboards (Perses) - List perses dashboards - Namespace', { tags: ['@perses', '@dashboards-'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    cy.changeNamespace('All Projects');
  });

  runCOOListPersesTestsNamespace({
    name: 'Administrator',
  });

});

