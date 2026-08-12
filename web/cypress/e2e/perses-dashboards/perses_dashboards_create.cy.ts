import { nav } from '../../views/nav';
import { runCOOCreatePersesTests } from '../../support/perses/03.coo_create_perses_admin.cy';
import { operatorAuthUtils } from '../../support/commands/auth-commands';

// Set constants for the operators that need to be installed for tests.
// const MCP = {
//   namespace: 'openshift-cluster-observability-operator',
//   packageName: 'cluster-observability-operator',
//   operatorName: 'Cluster Observability Operator',
//   config: {
//     kind: 'UIPlugin',
//     name: 'monitoring',
//   },
// };

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe(
  'COO - Dashboards (Perses) - Create perses dashboard',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      operatorAuthUtils.loginAndAuth();
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
      cy.setupPersesExtraDashboards();
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
      name: 'Core platform',
    });
  },
);
