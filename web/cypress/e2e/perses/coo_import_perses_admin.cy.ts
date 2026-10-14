import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { testCOOImportPerses } from '../../support/perses/coo_import_perses_admin.cy';
import { operatorAuthUtils } from '../../support/commands/auth-commands';

describe(
  'COO - Dashboards (Perses) - Import perses dashboard',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      operatorAuthUtils.loginAndAuth();
      cy.cleanupPersesTestDashboardsBeforeTests();
      cy.setupPersesExtraDashboards();
    });

    beforeEach(() => {
      cy.restoreLogin();
      cy.switchPerspective('Core platform');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      cy.wait(2000);
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    after(() => {
      cy.cleanupExtraDashboards();
    });

    testCOOImportPerses(CustomerPerspectiveName.CorePlatform);
  },
);
