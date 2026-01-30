import { nav } from '../../views/nav';
import { runCOORBACPersesTestsDevUser1 } from '../../support/perses/99.coo_rbac_perses_user1.cy';


// Set constants for the operators that need to be installed for tests.
const MCP = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

//TODO: change tag to @smoke, @dashboards, @perses when customizable-dashboards gets merged
describe('BVT: COO - Dashboards (Perses) - Administrator perspective', { tags: ['@smoke-', '@dashboards-', '@perses-dev'] }, () => {

  before(() => {
    //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - when it gets fixed, installation can be don using non-admin user
    // Step 1: Grant temporary cluster-admin role to dev user for COO/Perses installation
    // cy.log('Granting temporary cluster-admin role to dev user for setup');
    // cy.adminCLI(
    //   `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    // );

    // Step 2: Setup COO and Perses dashboards (requires admin privileges)
    cy.beforeBlockCOO(MCP, MP);
    cy.setupPersesRBACandExtraDashboards();

    //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - when it gets fixed, installation can be don using non-admin user
    // Step 3: Remove cluster-admin role - dev user now has limited permissions
    // cy.log('Removing cluster-admin role from dev user');
    // cy.adminCLI(
    //   `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    // );

    // Step 4: Clear Cypress session cache and logout
    // This is critical because beforeBlockCOO uses cy.session() which caches the login state
    cy.log('Clearing Cypress session cache to ensure fresh login');
    Cypress.session.clearAllSavedSessions();
    
    // Clear all cookies and storage to fully reset browser state
    cy.clearAllCookies();
    cy.clearAllLocalStorage();
    cy.clearAllSessionStorage();

    // Step 5: Re-login as dev user (now without cluster-admin role)
    // Using cy.relogin() because it doesn't require oauthurl and handles the login page directly
    cy.log('Re-logging in as dev user with limited permissions');
    cy.relogin(
      Cypress.env('LOGIN_IDP_DEV_USER'),
      Cypress.env('LOGIN_USERNAME1'),
      Cypress.env('LOGIN_PASSWORD1'),
    );
    cy.validateLogin();
    cy.closeOnboardingModalIfPresent();
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
  });

  after(() => {
    cy.cleanupExtraDashboards();
  });

  //TODO: rename after customizable-dashboards gets merged
  runCOORBACPersesTestsDevUser1({
    name: 'Administrator',
  });

});