import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';



export { };
declare global {
  namespace Cypress {
    interface Chainable {
      switchPerspective(...perspectives: string[]);
      uiLogin(provider: string, username: string, password: string, oauthurl?: string);
      uiLogout();
      cliLogin(username?, password?, hostapi?);
      cliLogout();
      login(provider?: string, username?: string, password?: string, oauthurl?: string): Chainable<Element>;
      loginNoSession(provider: string, username: string, password: string, oauthurl: string): Chainable<Element>;
      adminCLI(command: string, options?);
      executeAndDelete(command: string);
      validateLogin(): Chainable<Element>;
      relogin(provider: string, username: string, password: string): Chainable<Element>;
    }
  }
}


// Core login function (used by both session and non-session versions)
function performLogin(
  provider: string,
  username: string,
  password: string,
  oauthurl: string
): void {
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
}

Cypress.Commands.add('validateLogin', () => {
  cy.log('validateLogin');
  cy.visit('/');
  cy.wait(2000);
  cy.byTestID("username", { timeout: 120000 }).should('be.visible');
  cy.wait(10000);
  guidedTour.close();
});

// Session-wrapped login
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
        performLogin(provider, username, password, oauthurl);
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

// Non-session login (for use within sessions)
Cypress.Commands.add('loginNoSession', (provider: string, username: string, password: string, oauthurl: string) => {
  performLogin(provider, username, password, oauthurl);
  cy.validateLogin();
});

Cypress.Commands.add('switchPerspective', (...perspectives: string[]) => {
  /* If side bar is collapsed then expand it
  before switching perspecting */
  cy.wait(2000);
  cy.get('body').then((body) => {
    if (body.find('.pf-m-collapsed').length > 0) {
      cy.get('#nav-toggle').click();
    }
  });
  nav.sidenav.switcher.changePerspectiveTo(...perspectives);
  cy.wait(3000);
  guidedTour.close();
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
      cy.get('h1').should('have.text', 'Login');
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

// Relogin command for use after clearing sessions
// Fetches OAuth URL and uses cy.origin() for cross-origin login like the other login commands
Cypress.Commands.add('relogin', (provider: string, username: string, password: string) => {
  cy.log('Commands relogin - fetching OAuth URL and performing fresh login');
  
  cy.uiLogout();
  // Get the OAuth URL from the cluster (same as performLoginAndAuth does)
  cy.exec(
    `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
  ).then((result) => {
    if (result.stderr !== '') {
      throw new Error(`Failed to get OAuth URL: ${result.stderr}`);
    }
    
    const oauth = result.stdout;
    const oauthurl = new URL(oauth);
    const oauthorigin = oauthurl.origin;
    cy.log(`OAuth origin: ${oauthorigin}`);
    
    // Now perform login using cy.origin() for cross-origin OAuth
    cy.clearCookie('openshift-session-token');
    cy.visit(Cypress.config('baseUrl'));
    
    // Use cy.origin() for cross-origin login (OAuth is on a different domain)
    cy.origin(
      oauthorigin,
      { args: { provider, username, password } },
      ({ provider, username, password }) => {
        // Wait for login page to load
        cy.get('[data-test-id="login"]', { timeout: 60000 }).should('be.visible');
        
        // Select the IDP if available
        cy.get('body').then(($body) => {
          if ($body.text().includes(provider)) {
            cy.contains(provider).should('be.visible').click();
          }
        });
        
        // Fill in login form
        cy.get('#inputUsername', { timeout: 30000 }).should('be.visible').type(username);
        cy.get('#inputPassword').type(password);
        cy.get('button[type=submit]').click();
      }
    );
    
    // Wait for successful login back on the main origin
    cy.byTestID('username', { timeout: 120000 }).should('be.visible');
    cy.switchPerspective('Administrator');
  });
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
      cy.wait(1000);
      cy.byTestID('log-out').should('be.visible');
      cy.wait(1000);
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
  const kubeconfig = Cypress.env('KUBECONFIG_PATH');
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