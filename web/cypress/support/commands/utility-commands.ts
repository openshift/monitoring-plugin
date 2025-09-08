export {};

declare global {
    namespace Cypress {
      interface Chainable {
        waitUntilWithCustomTimeout(
          fn: () => any,
          options: { interval: number; timeout: number; timeoutMessage: string }
        ): Cypress.Chainable<any>;
        clickNavLink(path: string[]): Chainable<Element>;
        changeNamespace(namespace: string): Chainable<Element>;
        }
    }
  }

// Custom waitUntil with timeout message
Cypress.Commands.add('waitUntilWithCustomTimeout', (
    fn: () => any,
    options: { interval: number; timeout: number; timeoutMessage: string }
  ) => {
    const { timeoutMessage, ...waitOptions } = options;
  
    // Set up custom error handling before the waitUntil call
    cy.on('fail', (err) => {
      if (err.message.includes('Timed out retrying')) {
        // Create a new error with the custom message
        const customError = new Error(timeoutMessage);
        customError.stack = err.stack;
        throw customError;
      }
      // For any other errors, re-throw them unchanged
      throw err;
    });
  
    // Execute the waitUntil with the original options (without timeoutMessage)
    return cy.waitUntil(fn, waitOptions);
  
  });


  Cypress.Commands.add('clickNavLink', (path: string[]) => {
    cy.get('#page-sidebar')
      .contains(path[0])
      .then(($navItem) => {
        if ($navItem.attr('aria-expanded') !== 'true') {
          cy.wrap($navItem).click({force: true});
        }
      });
    if (path.length === 2) {
      cy.get('#page-sidebar')
        .contains(path[1])
        .click({force: true});
    }
  });

  Cypress.Commands.add('changeNamespace', (namespace: string) => {
    cy.byLegacyTestID('namespace-bar-dropdown').find('button').scrollIntoView().should('be.visible').click();
    cy.get('[data-test="showSystemSwitch"]').then(($element)=> {
      if ($element.attr('data-checked-state') !== 'true') {
        cy.byTestID('showSystemSwitch').siblings('span').eq(0).should('be.visible').click();
      }
    });
    cy.byTestID('dropdown-text-filter').type(namespace);
    cy.byTestID('dropdown-menu-item-link').contains(namespace).should('be.visible').click();
    
  });
