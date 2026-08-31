import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { runCOOCreatePersesTests } from '../../support/perses/03.coo_create_perses_admin.cy';
import { operatorAuthUtils } from '../../support/commands/auth-commands';

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

    runCOOCreatePersesTests(CustomerPerspectiveName.CorePlatform);
  },
);
