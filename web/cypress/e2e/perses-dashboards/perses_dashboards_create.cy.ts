import { nav } from '../../views/shared/nav';
import { runCOOCreatePersesTests } from '../../support/perses/perses_create_admin.cy';
import { operatorAuthUtils } from '../../support/shared/commands/auth-commands';

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

    runCOOCreatePersesTests({
      name: 'Core platform',
    });
  },
);
