import { Classes, DataTestIDs, LegacyTestIDs } from "../../../src/components/data-test";
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
        assertNamespace(namespace: string, exists: boolean): Chainable<Element>;
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
    cy.wait(2000);
    cy.get('body').then(($body) => {
      const hasNamespaceBarDropdown =
        $body.find('[data-test-id="' + LegacyTestIDs.NamespaceBarDropdown + '"]').length > 0;
      if (hasNamespaceBarDropdown) {
        cy.byLegacyTestID(LegacyTestIDs.NamespaceBarDropdown)
          .find('button')
          .scrollIntoView()
          .should('be.visible');
        cy.byLegacyTestID(LegacyTestIDs.NamespaceBarDropdown)
          .find('button')
          .scrollIntoView()
          .should('be.visible')
          .click({ force: true });
      } else {
        cy.get(Classes.NamespaceDropdown).scrollIntoView().should('be.visible');
        cy.get(Classes.NamespaceDropdown)
          .scrollIntoView()
          .should('be.visible')
          .click({ force: true });
      }
    });
    cy.get('body').then(($body) => {
      const hasShowSystemSwitch =
        $body.find('[data-test="' + DataTestIDs.NamespaceDropdownShowSwitch + '"]').length > 0;
      if (hasShowSystemSwitch) {
        cy.get('[data-test="' + DataTestIDs.NamespaceDropdownShowSwitch + '"]').then(($element) => {
          if ($element.attr('data-checked-state') !== 'true') {
            cy.byTestID(DataTestIDs.NamespaceDropdownShowSwitch)
              .siblings('span')
              .eq(0)
              .should('be.visible');
            cy.byTestID(DataTestIDs.NamespaceDropdownShowSwitch)
              .siblings('span')
              .eq(0)
              .should('be.visible')
              .click({ force: true });
          }
        });
      }
    });
    cy.byTestID(DataTestIDs.NamespaceDropdownTextFilter).type(namespace, { delay: 100 });
    cy.byTestID(DataTestIDs.NamespaceDropdownMenuLink).contains(namespace).should('be.visible');
    cy.byTestID(DataTestIDs.NamespaceDropdownMenuLink)
      .contains(namespace)
      .should('be.visible')
      .click({ force: true });
    cy.log('Namespace changed to: ' + namespace);
  });

  Cypress.Commands.add('aboutModal', () => {
    cy.log('Getting OCP version');
    if (Cypress.env('LOGIN_USERNAME') === 'kubeadmin') {
      cy.byTestID(DataTestIDs.MastHeadHelpIcon).should('be.visible');
      cy.byTestID(DataTestIDs.MastHeadHelpIcon).should('be.visible').click({force: true});
      cy.byTestID(DataTestIDs.MastHeadApplicationItem).contains('About').should('be.visible').click();
      cy.byAriaLabel('About modal').find('div[class*="co-select-to-copy"]').eq(0).should('be.visible').then(($ocpversion) => {
        cy.log('OCP version: ' + $ocpversion.text());
      });
    cy.byAriaLabel('Close Dialog').should('be.visible').click();
  }
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
  cy.switchPerspective('Core platform');
  cy.clickNavLink(['Workloads', 'Pods']);
  cy.byTestID('page-heading').contains('Pods').should('be.visible');
  cy.changeNamespace(namespace);

  const dataViewFiltersSelector = '[data-ouia-component-id="DataViewFilters"]';
  const legacyFilterSelector = '[data-test="name-filter-input"]';
  const nameFilterPlaceholder = '[placeholder="Filter by name"]';

  // Wait for either filter variant to appear in the DOM (retries automatically)
  cy.get(`${dataViewFiltersSelector}, ${legacyFilterSelector}`, { timeout: 30000 })
    .should('exist')
    .then(($el) => {
      if ($el.filter(dataViewFiltersSelector).length > 0) {
        // DataViewFilters variant — ensure the Name filter input is available
        cy.get('body').then(($body) => {
          if ($body.find(nameFilterPlaceholder).length > 0) {
            cy.get(nameFilterPlaceholder).scrollIntoView().should('be.visible').type(pod);
          } else {
            cy.byOUIAID('DataViewFilters')
              .find('button')
              .contains('Status')
              .scrollIntoView()
              .should('be.visible')
              .click();
            cy.byOUIAID('OUIA-Generated-Menu')
              .find('button')
              .contains('Name')
              .scrollIntoView()
              .should('be.visible')
              .click();
            cy.get(nameFilterPlaceholder).scrollIntoView().should('be.visible').type(pod);
          }
        });
      } else {
        // Legacy filter variant
        cy.get(legacyFilterSelector).scrollIntoView().should('be.visible').type(pod);
      }
    });

  cy.get(`a[data-test^="${pod}"]`).eq(0).should('be.visible').click();
  cy.byPFRole('rowgroup').find('td').eq(1).scrollIntoView().should('be.visible').then(($td) => {
    cy.log('Pod image: ' + $td.text());
  });
  cy.log('Get pod image completed');
});

Cypress.Commands.add('assertNamespace', (namespace: string, exists: boolean) => {
  cy.log('Asserting Namespace: ' + namespace + ' exists: ' + exists);
  cy.get('body').then(($body) => {
    const hasNamespaceBarDropdown =
      $body.find('[data-test-id="' + LegacyTestIDs.NamespaceBarDropdown + '"]').length > 0;
    if (hasNamespaceBarDropdown) {
      cy.byLegacyTestID(LegacyTestIDs.NamespaceBarDropdown)
        .find('button')
        .scrollIntoView()
        .should('be.visible');
      cy.byLegacyTestID(LegacyTestIDs.NamespaceBarDropdown)
        .find('button')
        .scrollIntoView()
        .should('be.visible')
        .click({ force: true });
    } else {
      cy.get(Classes.NamespaceDropdown).scrollIntoView().should('be.visible');
      cy.get(Classes.NamespaceDropdown)
        .scrollIntoView()
        .should('be.visible')
        .click({ force: true });
    }
  });
});

