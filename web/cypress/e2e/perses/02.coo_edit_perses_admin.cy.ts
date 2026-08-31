import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { runCOOEditPersesTests1 } from '../../support/perses/02.coo_edit_perses_admin_1.cy';
import { runCOOEditPersesTests } from '../../support/perses/02.coo_edit_perses_admin.cy';
import { operatorAuthUtils } from '../../support/commands/auth-commands';

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

    runCOOEditPersesTests(CustomerPerspectiveName.CorePlatform);

    runCOOEditPersesTests1(CustomerPerspectiveName.CorePlatform);
  },
);
