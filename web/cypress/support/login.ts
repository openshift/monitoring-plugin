export {}; // needed in files which don't have an import to trigger ES6 module usage
declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      login(username, password);
    }
  }
}

// any command added below, must be added to global Cypress interface above

function login(username: string, password: string) {
  cy.log('Login')
  cy.visit('/')
 
  // Login to your AAD tenant.
  cy.origin(

   'https://oauth-openshift.apps.emurasak-419a.qe.devcluster.openshift.com',
    {
      args: {
        username,
        password
      },
    },
    ({ username, password }) => {
      cy.get('body').then( ($provider) => {
        if ($provider.find('a[title="Log in with kube:admin"]').length > 0) {
          cy.get('a[title="Log in with kube:admin"]').click();
        }
      })
      
      cy.get('input[name="username"]').type(username, {
        log: false,
      }),
        cy.get('input[name="password"]').type(password, {
          log: false,
      }),
      cy.get('button[type="submit"]').click()
    }
  )
}

Cypress.Commands.add('login', (username, password) => {
  //cy.session is used to reuse the same previous session due to ocp performance issues to load first time
  // cy.session([username,password], () =>
  // {
    login(username, password);
  // })
  
})
