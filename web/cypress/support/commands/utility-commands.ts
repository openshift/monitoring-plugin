export {};

declare global {
    namespace Cypress {
      interface Chainable {
        waitUntilWithCustomTimeout(
          fn: () => any,
          options: { interval: number; timeout: number; timeoutMessage: string }
        ): Cypress.Chainable<any>;
        clickNavLink(path: string[]): Chainable<Element>;
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
          cy.wrap($navItem).click();
        }
      });
    if (path.length === 2) {
      cy.get('#page-sidebar')
        .contains(path[1])
        .click();
    }
  });
