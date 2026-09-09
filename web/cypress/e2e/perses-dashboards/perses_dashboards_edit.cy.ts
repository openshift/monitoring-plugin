import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/shared/nav';
import { operatorAuthUtils } from '../../support/shared/commands/auth-commands';
import { testCOOEditPerses } from '../../support/perses/perses_edit_admin.cy';
import { testCOOEditPerses1 } from '../../support/perses/perses_edit_admin_1.cy';

describe(
  'COO - Dashboards (Perses) - Edit perses dashboard',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      operatorAuthUtils.loginAndAuth();
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    testCOOEditPerses(CustomerPerspectiveName.CorePlatform);

    testCOOEditPerses1(CustomerPerspectiveName.CorePlatform);
  },
);
