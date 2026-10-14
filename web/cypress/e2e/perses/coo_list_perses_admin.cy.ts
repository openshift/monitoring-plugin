import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import {
  testCOOListPerses,
  testCOOListPersesDuplicateDashboard,
} from '../../support/perses/coo_list_perses_admin.cy';
import { testCOOListPersesNamespace } from '../../support/perses/coo_list_perses_admin_namespace.cy';

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe(
  'COO - Dashboards (Perses) - List perses dashboards',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      cy.ensureMonitoringConsolePlugin({
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.cleanupPersesTestDashboardsBeforeTests();
    });

    beforeEach(() => {
      cy.restoreLogin();
      cy.switchPerspective('Core platform');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    testCOOListPerses(CustomerPerspectiveName.CorePlatform);

    testCOOListPersesDuplicateDashboard(CustomerPerspectiveName.CorePlatform);
  },
);

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe(
  'COO - Dashboards (Perses) - List perses dashboards - Namespace',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      cy.ensureMonitoringConsolePlugin();
      cy.cleanupPersesTestDashboardsBeforeTests();
    });

    beforeEach(() => {
      cy.restoreLogin();
      cy.switchPerspective('Core platform');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    testCOOListPersesNamespace(CustomerPerspectiveName.CorePlatform);
  },
);
