import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { testCOORBACPersesTestsDevUser5 } from '../../support/perses/coo_rbac_perses_user5.cy';
import { operatorAuthUtils } from '../../support/commands/auth-commands';

describe(
  'RBAC Group containing User5: COO - Dashboards (Perses) - Administrator perspective',
  { tags: ['@perses-dashboards', '@coo'] },
  () => {
    before(() => {
      //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - when it gets fixed, installation can be don using non-admin user
      // Step 1: Grant temporary cluster-admin role to dev user for COO/Perses installation
      // cy.log('Granting temporary cluster-admin role to dev user for setup');
      // cy.adminCLI(
      //   `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
      // );

      // Step 2: Setup COO and Perses dashboards (requires admin privileges)
      operatorAuthUtils.loginAndAuth();
      cy.switchPerspective('Core platform');
      cy.cleanupPersesTestDashboardsBeforeTests();
      cy.setupPersesRBACandExtraDashboardsForGroup();

      //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - when it gets fixed, installation can be don using non-admin user
      // Step 3: Remove cluster-admin role - dev user now has limited permissions
      // cy.log('Removing cluster-admin role from dev user');
      // cy.adminCLI(
      //   `oc adm policy remove-cluster-role-from-user cluster-admin ` +
      //     `${Cypress.env('LOGIN_USERNAME')}`,
      // );
    });

    /**
     * RBAC permissions for Group5 (perses-e2e-group5 / dev user5)
     * - Cluster-wide: perses-prometheus-api-editor, persesglobaldatasource-viewer-role
     * - openshift-monitoring: admin
     */
    beforeEach(() => {
      cy.restoreLogin(
        Cypress.env('LOGIN_IDP_DEV_USER'),
        Cypress.env('LOGIN_USERNAME5'),
        Cypress.env('LOGIN_PASSWORD5'),
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
    testCOORBACPersesTestsDevUser5(CustomerPerspectiveName.CorePlatform);
  },
);
