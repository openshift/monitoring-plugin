import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { testCOORBACPersesTestsDevUser2 } from '../../support/perses/coo_rbac_perses_user2.cy';

describe(
  'RBAC Group containing user2: COO - Dashboards (Perses) - Administrator perspective',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      // Setup COO and Perses dashboards (requires admin privileges)
      cy.ensureMonitoringConsolePlugin({
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
      cy.setupPersesRBACandExtraDashboardsForGroup();
    });

    /**
     * RBAC permissions for Group2 (perses-e2e-group2 / dev user2)
     * - Cluster-wide: perses-prometheus-api-editor, persesglobaldatasource-viewer-role
     * - perses-dev: view, persesdashboard-viewer-role, persesdatasource-viewer-role
     * - openshift-monitoring: view
     */
    beforeEach(() => {
      cy.restoreLogin(
        Cypress.env('LOGIN_IDP_DEV_USER'),
        Cypress.env('LOGIN_USERNAME2'),
        Cypress.env('LOGIN_PASSWORD2'),
      );
      cy.closeOnboardingModalIfPresent();
      cy.switchPerspective('Core platform');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      cy.wait(2000);
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    });

    after(() => {
      cy.cleanupExtraDashboards();
    });

    //TODO: rename after customizable-dashboards gets merged
    testCOORBACPersesTestsDevUser2(CustomerPerspectiveName.CorePlatform);
  },
);
