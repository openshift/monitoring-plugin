// 02.acm_perses.cy.ts
// E2E test for validating ACM Perses integration with Cluster Observability Operator (COO)
import { nav } from 'cypress/views/nav';
import '../../support/commands/auth-commands';
import { testBVTCOOPerses1 } from 'cypress/support/perses/00.coo_bvt_perses_admin.cy';
import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/operators';

describe('ACM - Perses', { tags: ['@perses-dashboards', '@acm', '@coo'] }, () => {
  before(() => {
    cy.beforeBlockACM(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
    cy.switchPerspective('Core platform');
    cy.cleanupPersesTestDashboardsBeforeTests();
  });

  beforeEach(() => {
    cy.switchPerspective('Fleet management');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
  });

  testBVTCOOPerses1(CustomerPerspectiveName.FleetManagement, 'Dashboards');
});
