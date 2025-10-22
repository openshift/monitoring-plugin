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
        aboutModal(): Chainable<Element>;
        podImage(pod: string, namespace: string): Chainable<Element>;
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
    cy.log('Changing Namespace to: ' + namespace);
    cy.byLegacyTestID('namespace-bar-dropdown').find('button').scrollIntoView().should('be.visible').click();
    cy.get('[data-test="showSystemSwitch"]').then(($element)=> {
      if ($element.attr('data-checked-state') !== 'true') {
        cy.byTestID('showSystemSwitch').siblings('span').eq(0).should('be.visible').click();
      }
    });
    cy.byTestID('dropdown-text-filter').type(namespace);
    cy.byTestID('dropdown-menu-item-link').contains(namespace).should('be.visible').click();
    cy.log('Namespace changed to: ' + namespace);
  });

  Cypress.Commands.add('aboutModal', () => {
    cy.log('Getting OCP version');
    cy.byTestID('help-dropdown-toggle').should('be.visible').click();
    cy.byTestID('application-launcher-item').contains('About').should('be.visible').click();
    cy.byAriaLabel('About modal').find('div[class*="co-select-to-copy"]').eq(0).should('be.visible').then(($ocpversion) => {
      cy.log('OCP version: ' + $ocpversion.text());
    });
    cy.byAriaLabel('Close Dialog').should('be.visible').click();

  });

  Cypress.Commands.overwrite('log', (log, ...args) => {
    if (Cypress.browser.isHeadless && Cypress.env('DEBUG')) {
      // Log to the terminal using the custom task
      return cy.task('log', args, { log: false }).then(() => {
        // The original cy.log is still executed but its output is hidden from the
        // command log in headless mode
        return log(...args);
      });
    } else {
      // In headed mode, use the original cy.log behavior
      return log(...args);
    }
  });

  Cypress.Commands.add('podImage', (pod: string, namespace: string) => {
    cy.log('Get pod image');
    cy.clickNavLink(['Workloads', 'Pods']);
    cy.changeNamespace(namespace);
    cy.byTestID('name-filter-input').should('be.visible').type(pod);
    cy.get(`a[data-test^="${pod}"]`).eq(0).as('podLink').click();
    cy.get('@podLink').should('be.visible').click();
    cy.byPFRole('rowgroup').find('td').eq(1).scrollIntoView().should('be.visible').then(($td) => {
      cy.log('Pod image: ' + $td.text());
      
    });
    cy.log('Get pod image completed');
  });

  
