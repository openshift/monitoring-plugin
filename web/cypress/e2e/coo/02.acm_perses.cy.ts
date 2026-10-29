// 02.acm_perses.cy.ts
// E2E test for validating ACM Perses integration with Cluster Observability Operator (COO)
import { nav } from 'cypress/views/nav';
import '../../support/commands/auth-commands';
import { testBVTCOOPerses1 } from 'cypress/support/perses/00.coo_bvt_perses_admin.cy';
import { CustomerPerspectiveName } from '@/shared/constants/perspective';

describe('ACM - Perses', { tags: ['@perses-dashboards', '@acm', '@coo'] }, () => {
  before(() => {
    cy.beforeBlockACM();
    cy.switchPerspective('Core platform');
    cy.cleanupPersesTestDashboardsBeforeTests();
  });

  beforeEach(() => {
    cy.switchPerspective('Fleet management');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
  });

  testBVTCOOPerses1(CustomerPerspectiveName.FleetManagement, 'Dashboards');
});
