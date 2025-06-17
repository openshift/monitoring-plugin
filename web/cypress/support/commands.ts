/* eslint-disable @typescript-eslint/no-use-before-define */
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;
import { guidedTour } from '../views/tour';
import './nav';

export {};
declare global {
  interface Chainable {
    byTestID(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<Element>;
    byTestActionID(selector: string): Chainable<JQuery<HTMLElement>>;
    byLegacyTestID(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>>;
    byButtonText(selector: string): Chainable<JQuery<HTMLElement>>;
    byDataID(selector: string): Chainable<JQuery<HTMLElement>>;
    byTestSelector(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>>;
    byTestDropDownMenu(selector: string): Chainable<JQuery<HTMLElement>>;
    byTestOperatorRow(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>>;
    byTestSectionHeading(selector: string): Chainable<JQuery<HTMLElement>>;
    byTestOperandLink(selector: string): Chainable<JQuery<HTMLElement>>;
    byOUIAID(selector: string): Chainable<Element>;
    byClass(selector: string): Chainable<Element>;
  }
}

declare global {
  interface Chainable {
    switchPerspective(perspective: string);
    uiLogin(provider: string, username: string, password: string);
    uiLogout();
    cliLogin(username?, password?, hostapi?);
    cliLogout();
    adminCLI(command: string, options?);
    login(provider?: string, username?: string, password?: string): Chainable<Element>;
    executeAndDelete(command: string);
  }
}

// Any command added below, must be added to global Cypress interface above

Cypress.Commands.add(
  'byTestID',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test="${selector}"]`, options);
  },
);

Cypress.Commands.add('byTestActionID', (selector: string) =>
  cy.get(`[data-test-action="${selector}"]:not([disabled])`),
);

// Deprecated!  new IDs should use 'data-test', ie. `cy.byTestID(...)`
Cypress.Commands.add(
  'byLegacyTestID',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test-id="${selector}"]`, options);
  },
);

Cypress.Commands.add('byButtonText', (selector: string) => {
  cy.get('button[type="button"]').contains(`${selector}`);
});

Cypress.Commands.add('byDataID', (selector: string) => {
  cy.get(`[data-id="${selector}"]`);
});

Cypress.Commands.add(
  'byTestSelector',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test-selector="${selector}"]`, options);
  },
);

Cypress.Commands.add('byTestDropDownMenu', (selector: string) => {
  cy.get(`[data-test-dropdown-menu="${selector}"]`);
});

Cypress.Commands.add('byTestOperatorRow', (selector: string, options?: object) => {
  cy.get(`[data-test-operator-row="${selector}"]`, options);
});

Cypress.Commands.add('byTestSectionHeading', (selector: string) => {
  cy.get(`[data-test-section-heading="${selector}"]`);
});

Cypress.Commands.add('byTestOperandLink', (selector: string) => {
  cy.get(`[data-test-operand-link="${selector}"]`);
});

Cypress.Commands.add('byOUIAID', (selector: string) => cy.get(`[data-ouia-component-id^="${selector}"]`));

Cypress.Commands.add('byClass', (selector: string) => cy.get(`[class="${selector}"]`));

Cypress.Commands.add(
  'login',
  (
    provider: string = Cypress.env('LOGIN_IDP'),
    username: string = Cypress.env('LOGIN_USERNAME'),
    password: string = Cypress.env('LOGIN_PASSWORD'),
    oauthurl: string,
  ) => {
    cy.session(
      [provider, username],
      () => {
        cy.visit(Cypress.config('baseUrl'));
        cy.log('Session - after visiting');
        cy.window().then(
          (
            win: any, // eslint-disable-line @typescript-eslint/no-explicit-any
          ) => {
            // Check if auth is disabled (for a local development environment)
            if (win.SERVER_FLAGS?.authDisabled) {
              cy.task('log', '  skipping login, console is running with auth disabled');
              return;
            }
            cy.exec(
              `oc get node --selector=hypershift.openshift.io/managed --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            ).then((result) => {
              cy.log(result.stdout);
              cy.task('log', result.stdout);
              if (result.stdout.includes('Ready')) {
                cy.log(`Attempting login via cy.origin to: ${oauthurl}`);
                cy.task('log', `Attempting login via cy.origin to: ${oauthurl}`);
                cy.origin(
                  oauthurl,
                  { args: { username, password } },
                  ({ username, password }) => {
                    cy.get('#inputUsername').type(username);
                    cy.get('#inputPassword').type(password);
                    cy.get('button[type=submit]').click();
                  },
                );
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
                  }
                );
              }
            });
          },
        );
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.byTestID("username", {timeout: 120000}).should('be.visible');
          guidedTour.close();
        },
      },
    );
  },
);

const kubeconfig = Cypress.env('KUBECONFIG_PATH');
Cypress.Commands.add('switchPerspective', (perspective: string) => {
  /* If side bar is collapsed then expand it
  before switching perspecting */
  cy.get('body').then((body) => {
    if (body.find('.pf-m-collapsed').length > 0) {
      cy.get('#nav-toggle').click();
    }
  });
  nav.sidenav.switcher.changePerspectiveTo(perspective);
  nav.sidenav.switcher.shouldHaveText(perspective);
});

// To avoid influence from upstream login change
Cypress.Commands.add('uiLogin', (provider: string, username: string, password: string) => {
  cy.log('Commands uiLogin');
  cy.clearCookie('openshift-session-token');
  cy.visit('/');
  cy.window().then(
    (
      win: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) => {
      if (win.SERVER_FLAGS?.authDisabled) {
        cy.task('log', 'Skipping login, console is running with auth disabled');
        return;
      }
      cy.get('[data-test-id="login"]').should('be.visible');
      cy.get('body').then(($body) => {
        if ($body.text().includes(provider)) {
          cy.contains(provider).should('be.visible').click();
        } else if ($body.find('li.idp').length > 0) {
          //Using the last idp if doesn't provider idp name
          cy.get('li.idp').last().click();
        }
      });
      cy.get('#inputUsername').type(username);
      cy.get('#inputPassword').type(password);
      cy.get('button[type=submit]').click();
      cy.byTestID('username', { timeout: 120000 }).should('be.visible');
    },
  );
  cy.switchPerspective('Administrator');
});

Cypress.Commands.add('uiLogout', () => {
  cy.window().then(
    (
      win: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) => {
      if (win.SERVER_FLAGS?.authDisabled) {
        cy.log('Skipping logout, console is running with auth disabled');
        return;
      }
      cy.log('Log out UI');
      cy.byTestID('username').click();
      cy.byTestID('log-out').should('be.visible');
      cy.byTestID('log-out').click({ force: true });
    },
  );
});

Cypress.Commands.add('cliLogin', (username?, password?, hostapi?) => {
  const loginUsername = username || Cypress.env('LOGIN_USERNAME');
  const loginPassword = password || Cypress.env('LOGIN_PASSWORD');
  const hostapiurl = hostapi || Cypress.env('HOST_API');
  cy.exec(
    `oc login -u ${loginUsername} -p ${loginPassword} ${hostapiurl} --insecure-skip-tls-verify=true`,
    { failOnNonZeroExit: false },
  ).then((result) => {
    cy.log(result.stderr);
    cy.log(result.stdout);
  });
});

Cypress.Commands.add('cliLogout', () => {
  cy.exec(`oc logout`, { failOnNonZeroExit: false }).then((result) => {
    cy.log(result.stderr);
    cy.log(result.stdout);
  });
});

Cypress.Commands.add('adminCLI', (command: string) => {
  cy.log(`Run admin command: ${command}`);
  cy.exec(`${command} --kubeconfig ${kubeconfig}`);
});

Cypress.Commands.add('executeAndDelete', (command: string) => {
  cy.exec(command, { failOnNonZeroExit: false })
    .then(result => {
      if (result.code !== 0) {
        cy.task('logError', `Command "${command}" failed: ${result.stderr || result.stdout}`);
      } else {
        cy.task('log', `Command "${command}" executed successfully`);
      }
    });
});