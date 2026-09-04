import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../../views/nav';
import { operatorAuthUtils } from '../../../support/commands/auth-commands';
import { testCOORBACPersesTestsDevUser5 } from '../../../support/perses/rbac/perses_user5.cy';

describe(
  'RBAC User5: COO - Dashboards (Perses) - Administrator perspective',
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
      cy.setupPersesRBACandExtraDashboards();

      //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - when it gets fixed, installation can be don using non-admin user
      // Step 3: Remove cluster-admin role - dev user now has limited permissions
      // cy.log('Removing cluster-admin role from dev user');
      // cy.adminCLI(
      //   `oc adm policy remove-cluster-role-from-user cluster-admin ` +
      //     `${Cypress.env('LOGIN_USERNAME')}`,
      // );

      // Step 4: Clear Cypress session cache and logout
      // This is critical because beforeBlockCOO uses cy.session() which caches the login state
      cy.log('Clearing Cypress session cache to ensure fresh login');
      cy.then(() => {
        Cypress.session.clearAllSavedSessions();
      });

      // Clear all cookies and storage to fully reset browser state
      cy.clearAllCookies();
      cy.clearAllLocalStorage();
      cy.clearAllSessionStorage();

      // Step 5: Re-login as dev user (now without cluster-admin role)
      // Using cy.relogin() because it doesn't require oauthurl and handles the login page directly
      cy.log('Re-logging in as dev user with limited permissions');
      cy.relogin(
        Cypress.env('LOGIN_IDP_DEV_USER'),
        Cypress.env('LOGIN_USERNAME5'),
        Cypress.env('LOGIN_PASSWORD5'),
      );
      cy.validateLogin();
      cy.closeOnboardingModalIfPresent();
    });

    beforeEach(() => {
      cy.switchPerspective('Core platform');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      cy.wait(2000);
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(2000);
      cy.changeNamespace('All Projects');
    });

    after(() => {
      cy.cleanupExtraDashboards();
    });

    //TODO: rename after customizable-dashboards gets merged
    testCOORBACPersesTestsDevUser5(CustomerPerspectiveName.CorePlatform);
  },
);
