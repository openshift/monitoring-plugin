import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { testCOORBACPersesTestsDevUser1 } from '../../support/perses/coo_rbac_perses_user1.cy';

describe(
  'RBAC User1: COO - Dashboards (Perses) - Administrator perspective',
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
      cy.setupPersesRBACandExtraDashboards();
    });

    /**
     * RBAC permissions for dev user1 (bound directly to the user, no group)
     * - Cluster-wide: perses-prometheus-api-editor, persesglobaldatasource-viewer-role
     * - observ-test: view, persesdashboard-viewer-role, persesdatasource-viewer-role
     * - openshift-cluster-observability-operator: view, persesdashboard-editor-role,
     *   persesdatasource-editor-role
     * - openshift-monitoring: view
     */
    beforeEach(() => {
      cy.restoreLogin(
        Cypress.env('LOGIN_IDP_DEV_USER'),
        Cypress.env('LOGIN_USERNAME1'),
        Cypress.env('LOGIN_PASSWORD1'),
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
    testCOORBACPersesTestsDevUser1(CustomerPerspectiveName.CorePlatform);
  },
);
