import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { testCOOEditPerses1 } from '../../support/perses/coo_edit_perses_admin_1.cy';
import { testCOOEditPerses } from '../../support/perses/coo_edit_perses_admin.cy';
import { operatorAuthUtils } from '../../support/commands/auth-commands';

describe(
  'COO - Dashboards (Perses) - Edit perses dashboard',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      operatorAuthUtils.loginAndAuth();
      cy.cleanupPersesTestDashboardsBeforeTests();
    });

    beforeEach(() => {
      cy.restoreLogin();
      cy.switchPerspective('Core platform');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    testCOOEditPerses(CustomerPerspectiveName.CorePlatform);

    testCOOEditPerses1(CustomerPerspectiveName.CorePlatform);
  },
);
