import { nav } from '../../views/nav';
import {
  runCOOListPersesDuplicateDashboardTests,
  runCOOListPersesTests,
} from '../../support/perses/01.coo_list_perses_admin.cy';
import { runCOOListPersesTestsNamespace } from '../../support/perses/01.coo_list_perses_admin_namespace.cy';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';

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

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe(
  'COO - Dashboards (Perses) - List perses dashboards',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(MCP, CLUSTER_MONITORING_OPERATOR, {
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    runCOOListPersesTests({
      name: 'Core platform',
    });

    runCOOListPersesDuplicateDashboardTests({
      name: 'Core platform',
    });
  },
);

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe(
  'COO - Dashboards (Perses) - List perses dashboards - Namespace',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(MCP, CLUSTER_MONITORING_OPERATOR);
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    runCOOListPersesTestsNamespace({
      name: 'Core platform',
    });
  },
);
