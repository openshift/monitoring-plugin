import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  KUBEVIRT_HYPERCONVERGED_OPERATOR,
} from '../operators';

export {};
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      switchPerspective(...perspectives: string[]): Chainable<void>;
      login(
        provider?: string,
        username?: string,
        password?: string,
        oauthurl?: string,
        isHypershift?: boolean,
      ): Chainable<Element>;
      adminCLI(command: string, options?: Partial<ExecOptions>): Chainable<Exec>;
      executeAndDelete(command: string): Chainable<void>;
      validateLogin(): Chainable<Element>;
      restoreLogin(provider?: string, username?: string, password?: string): Chainable<void>;
    }
  }
}

// ── Auth orchestration (RBAC + OAuth discovery + login) ────────────
// Moved from operator-commands.ts so all auth concerns live in one file.

export const operatorAuthUtils = {
  performLoginAndAuth(): void {
    if (`${Cypress.env('LOGIN_USERNAME')}` === 'kubeadmin') {
      cy.adminCLI(
        `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
      );
    } else {
      cy.adminCLI(`oc project openshift-monitoring`);
      cy.adminCLI(
        `oc adm policy add-role-to-user monitoring-edit ${Cypress.env(
          'LOGIN_USERNAME',
        )} -n openshift-monitoring`,
      );
      cy.adminCLI(
        'oc adm policy add-role-to-user monitoring-alertmanager-edit ' +
          `--role-namespace openshift-monitoring ${Cypress.env('LOGIN_USERNAME')}`,
      );
      cy.adminCLI(
        `oc adm policy add-role-to-user view ${Cypress.env(
          'LOGIN_USERNAME',
        )} -n openshift-monitoring`,
      );
      cy.adminCLI(`oc project default`);
      cy.adminCLI(
        `oc adm policy add-role-to-user monitoring-edit ${Cypress.env(
          'LOGIN_USERNAME',
        )} -n default`,
      );
      cy.adminCLI(
        'oc adm policy add-role-to-user monitoring-alertmanager-edit ' +
          `--role-namespace default ${Cypress.env('LOGIN_USERNAME')}`,
      );
      cy.adminCLI(
        `oc adm policy add-role-to-user view ${Cypress.env('LOGIN_USERNAME')} -n default`,
      );
    }
    cy.adminCLI(
      `oc get oauthclient openshift-browser-client -o go-template ` +
        `--template="{{index .redirectURIs 0}}"`,
    ).then((result) => {
      if (result.stderr === '') {
        const oauth = result.stdout;
        const oauthurl = new URL(oauth);
        const oauthorigin = oauthurl.origin;
        cy.log(oauthorigin);
        cy.wrap(oauthorigin as string).as('oauthorigin');
      } else {
        throw new Error(`Execution of oc get oauthclient failed
          Exit code: ${result.code}
          Stdout:\n${result.stdout}
          Stderr:\n${result.stderr}`);
      }
    });
    let isHypershift = false;
    cy.adminCLI(`oc get node --selector=hypershift.openshift.io/managed`).then((result) => {
      isHypershift = result.stdout.includes('Ready');
    });
    cy.get('@oauthorigin').then((oauthorigin) => {
      cy.login(
        Cypress.env('LOGIN_IDP'),
        Cypress.env('LOGIN_USERNAME'),
        Cypress.env('LOGIN_PASSWORD'),
        oauthorigin as unknown as string,
        isHypershift,
      );
    });
  },

  loginAndAuth(): void {
    cy.log('Before block');
    operatorAuthUtils.performLoginAndAuth();
    cy.visit('/');
  },

  generateCOOSessionKey(): string[] {
    const baseKey = [
      Cypress.env('LOGIN_IDP'),
      Cypress.env('LOGIN_USERNAME'),
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      CLUSTER_OBSERVABILITY_OPERATOR.operatorName,
      CLUSTER_OBSERVABILITY_OPERATOR.packageName,
      CLUSTER_MONITORING_OPERATOR.namespace,
      CLUSTER_MONITORING_OPERATOR.operatorName,
    ];
    const envVars = [
      Cypress.env('SKIP_ALL_INSTALL'),
      Cypress.env('SKIP_COO_INSTALL'),
      Cypress.env('COO_UI_INSTALL'),
      Cypress.env('KONFLUX_COO_BUNDLE_IMAGE'),
      Cypress.env('CUSTOM_COO_BUNDLE_IMAGE'),
      Cypress.env('FBC_STAGE_COO_IMAGE'),
      Cypress.env('MP_IMAGE'),
      Cypress.env('MCP_CONSOLE_IMAGE'),
      Cypress.env('CHA_IMAGE'),
    ];
    return [...baseKey, ...envVars.map((v) => v || '')];
  },

  generateMPSessionKey(): string[] {
    const baseKey = [
      Cypress.env('LOGIN_IDP'),
      Cypress.env('LOGIN_USERNAME'),
      CLUSTER_MONITORING_OPERATOR.namespace,
      CLUSTER_MONITORING_OPERATOR.operatorName,
    ];
    const envVars = [Cypress.env('SKIP_ALL_INSTALL'), Cypress.env('MP_IMAGE')];
    return [...baseKey, ...envVars.map((v) => v || '')];
  },

  generateKNVSessionKey(): string[] {
    const baseKey = [
      Cypress.env('LOGIN_IDP'),
      Cypress.env('LOGIN_USERNAME'),
      KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace,
      KUBEVIRT_HYPERCONVERGED_OPERATOR.packageName,
    ];
    const envVars = [Cypress.env('SKIP_CNV_INSTALL'), Cypress.env('CNV_UI_INSTALL')];
    return [...baseKey, ...envVars.map((v) => v || '')];
  },

  generateTracesLoggingSessionKey(
    operatorType: string,
    operator: { namespace: string; packageName: string },
  ): string[] {
    const baseKey = [
      Cypress.env('LOGIN_IDP'),
      Cypress.env('LOGIN_USERNAME'),
      operatorType,
      operator.namespace,
      operator.packageName,
    ];
    const envVars = [Cypress.env('SKIP_COO_INSTALL')];
    return [...baseKey, ...envVars.map((v) => v || '')];
  },
};

// Core login function (used by both session and non-session versions)
function performLogin(
  provider: string,
  username: string,
  password: string,
  oauthurl: string,
  isHypershift: boolean,
): void {
  cy.visit(Cypress.config('baseUrl'));
  cy.log('Session - after visiting');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.window().then((win: any) => {
    // Check if auth is disabled (for a local development environment)
    if (win.SERVER_FLAGS?.authDisabled) {
      cy.task('log', '  skipping login, console is running with auth disabled');
      return;
    }
    if (isHypershift) {
      cy.log(`Attempting login via cy.origin to: ${oauthurl}`);
      cy.task('log', `Attempting login via cy.origin to: ${oauthurl}`);
      cy.origin(oauthurl, { args: { username, password } }, ({ username, password }) => {
        cy.get('#inputUsername').type(username);
        cy.get('#inputPassword').type(password);
        cy.get('button[type=submit]').click();
      });
    } else {
      cy.task('log', `  Logging in as ${username} using fallback on ${oauthurl}`);
      cy.origin(
        oauthurl,
        { args: { provider, username, password } },
        ({ provider, username, password }) => {
          cy.get('[data-test-id="login"]').should('be.visible');
          cy.get('body').then(($body) => {
            if ($body.text().includes(provider)) {
              cy.contains(provider).should('be.visible').click();
            }
          });
          cy.get('#inputUsername').type(username);
          cy.get('#inputPassword').type(password);
          cy.get('button[type=submit]').click();
        },
      );
    }
  });
}

Cypress.Commands.add('validateLogin', () => {
  cy.log('validateLogin');
  cy.visit('/');
  cy.wait(2000);
  cy.byTestID('username', { timeout: 120000 }).should('be.visible');
  cy.wait(10000);
  guidedTour.close();
});

Cypress.Commands.add('restoreLogin', (provider?: string, username?: string, password?: string) => {
  if (!provider && !username && !password) {
    operatorAuthUtils.loginAndAuth();
    cy.visit('/');
    return;
  }

  cy.adminCLI(
    'oc get oauthclient openshift-browser-client -o go-template ' +
      '--template="{{index .redirectURIs 0}}"',
  ).then((result) => {
    const origin = new URL(result.stdout).origin;
    cy.adminCLI('oc get node --selector=hypershift.openshift.io/managed').then((nodeResult) => {
      cy.login(
        provider || Cypress.env('LOGIN_IDP'),
        username || Cypress.env('LOGIN_USERNAME'),
        password || Cypress.env('LOGIN_PASSWORD'),
        origin,
        nodeResult.stdout.includes('Ready'),
      );
      cy.visit('/');
    });
  });
});

// Session-wrapped login
Cypress.Commands.add(
  'login',
  (
    provider: string = Cypress.env('LOGIN_IDP'),
    username: string = Cypress.env('LOGIN_USERNAME'),
    password: string = Cypress.env('LOGIN_PASSWORD'),
    oauthurl: string,
    isHypershift: boolean = false,
  ) => {
    cy.session(
      [provider, username],
      () => {
        performLogin(provider, username, password, oauthurl, isHypershift);
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.validateLogin();
        },
      },
    );
  },
);

Cypress.Commands.add('switchPerspective', (...perspectives: string[]) => {
  cy.log('switchPerspective - ' + perspectives.join(', '));
  /* If side bar is collapsed then expand it
  before switching perspecting */
  cy.waitUntil(
    () => {
      return cy.byTestID('username', { timeout: 120000 }).should('be.visible');
    },
    { timeout: 120000 },
  );
  cy.get('body').then((body) => {
    if (body.find('.pf-m-collapsed').length > 0) {
      cy.get('#nav-toggle').click();
    }
  });
  nav.sidenav.switcher.changePerspectiveTo(...perspectives);
  cy.wait(3000);
  guidedTour.close();
});

Cypress.Commands.add(
  'adminCLI',
  (command: string, options?: Partial<Cypress.ExecOptions>): Cypress.Chainable<Cypress.Exec> => {
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');
    cy.log(`Run admin command: ${command}`);
    return cy.exec(`${command} --kubeconfig ${kubeconfig}`, options);
  },
);

Cypress.Commands.add('executeAndDelete', (command: string) => {
  cy.exec(command, { failOnNonZeroExit: false }).then((result) => {
    if (result.code !== 0) {
      cy.task('logError', `Command "${command}" failed: ${result.stderr || result.stdout}`);
    } else {
      cy.task('log', `Command "${command}" executed successfully`);
    }
  });
});
