// 02.acm_perses.cy.ts
// E2E test for validating ACM Perses integration with Cluster Observability Operator (COO)
import { nav } from 'cypress/views/nav';
import '../../support/commands/auth-commands';
import { runBVTCOOPersesTests1 } from 'cypress/support/perses/00.coo_bvt_perses_admin.cy';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';

const MCP = {
  namespace: Cypress.env('COO_NAMESPACE'),
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

describe('ACM - Perses', { tags: ['@perses-dashboards', '@acm', '@coo'] }, () => {
  before(() => {
    cy.beforeBlockACM(MCP, CLUSTER_MONITORING_OPERATOR);
    cy.switchPerspective('Core platform');
    cy.cleanupPersesTestDashboardsBeforeTests();
  });

  beforeEach(() => {
    cy.switchPerspective('Fleet management');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
  });

  runBVTCOOPersesTests1({
    name: 'Fleet management',
    dashboardsPageName: 'Dashboards',
  });
});
