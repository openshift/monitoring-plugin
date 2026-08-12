import { nav } from '../../views/nav';
//TODO: rename after customizable-dashboards gets merged
import { runBVTCOOPersesTests1 } from '../../support/perses/00.coo_bvt_perses_admin.cy';
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

describe(
  'BVT: COO - Dashboards (Perses) - Core platform perspective',
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
    });

    //TODO: rename after customizable-dashboards gets merged
    runBVTCOOPersesTests1({
      name: 'Core platform',
    });
  },
);
