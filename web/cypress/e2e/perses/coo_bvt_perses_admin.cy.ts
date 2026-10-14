import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
//TODO: rename after customizable-dashboards gets merged
import { testBVTCOOPerses1 } from '../../support/perses/coo_bvt_perses_admin.cy';

describe(
  'BVT: COO - Dashboards (Perses) - Core platform perspective',
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
    });

    //TODO: rename after customizable-dashboards gets merged
    testBVTCOOPerses1(CustomerPerspectiveName.CorePlatform);
  },
);
