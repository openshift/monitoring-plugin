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

describe(
  'RBAC User1: COO - Dashboards (Perses) - Administrator perspective',
  { tags: ['@perses', '@perses-dev'] },
  () => {
    before(() => {
      // Setup COO and Perses dashboards (requires admin privileges)
      cy.beforeBlockCOO(MCP, MP, { dashboards: true, troubleshootingPanel: false });
      cy.cleanupPersesTestDashboardsBeforeTests();
      cy.setupPersesRBACandExtraDashboards();

      // Clear Cypress session cache and logout
      // This is critical because beforeBlockCOO uses cy.session() which caches the login state
      cy.log('Clearing Cypress session cache to ensure fresh login');
      cy.then(() => {
        Cypress.session.clearAllSavedSessions();
      });

      // Clear all cookies and storage to fully reset browser state
      cy.clearAllCookies();
      cy.clearAllLocalStorage();
      cy.clearAllSessionStorage();

      // Re-login as dev user (now without cluster-admin role)
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
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      cy.wait(2000);
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    });

    after(() => {
      cy.cleanupExtraDashboards();
    });

    //TODO: rename after customizable-dashboards gets merged
    runCOORBACPersesTestsDevUser1({
      name: 'Administrator',
    });
  },
);
