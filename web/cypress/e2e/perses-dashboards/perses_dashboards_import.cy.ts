import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/shared/nav';
import { operatorAuthUtils } from '../../support/shared/commands/auth-commands';
import { testCOOImportPerses } from '../../support/perses/perses_import_admin.cy';

describe(
  'COO - Dashboards (Perses) - Import perses dashboard',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      operatorAuthUtils.loginAndAuth();
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
      cy.setupPersesExtraDashboards();
    });

    beforeEach(() => {
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
