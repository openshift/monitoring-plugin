import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import {
  runCOOListPersesDuplicateDashboardTests,
  runCOOListPersesTests,
} from '../../support/perses/01.coo_list_perses_admin.cy';
import { runCOOListPersesTestsNamespace } from '../../support/perses/01.coo_list_perses_admin_namespace.cy';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/operators';

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe(
  'COO - Dashboards (Perses) - List perses dashboards',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR, {
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    runCOOListPersesTests(CustomerPerspectiveName.CorePlatform);

    runCOOListPersesDuplicateDashboardTests(CustomerPerspectiveName.CorePlatform);
  },
);

//TODO: change tag to @dashboards when customizable-dashboards gets merged
describe(
  'COO - Dashboards (Perses) - List perses dashboards - Namespace',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    runCOOListPersesTestsNamespace(CustomerPerspectiveName.CorePlatform);
  },
);
