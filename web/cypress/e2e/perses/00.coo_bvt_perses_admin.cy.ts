import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
//TODO: rename after customizable-dashboards gets merged
import { runBVTCOOPersesTests1 } from '../../support/perses/00.coo_bvt_perses_admin.cy';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/operators';

describe(
  'BVT: COO - Dashboards (Perses) - Core platform perspective',
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
    });

    //TODO: rename after customizable-dashboards gets merged
    runBVTCOOPersesTests1(CustomerPerspectiveName.CorePlatform);
  },
);
