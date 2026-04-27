import { Classes, DataTestIDs, LegacyTestIDs } from '../../../src/components/data-test';
export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      waitUntilWithCustomTimeout(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fn: () => any,
        options: { interval: number; timeout: number; timeoutMessage: string },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ): Cypress.Chainable<any>;
      clickNavLink(path: string[]): Chainable<Element>;
      changeNamespace(namespace: string): Chainable<Element>;
      aboutModal(): Chainable<Element>;
      podImage(pod: string, namespace: string): Chainable<Element>;
      assertNamespace(namespace: string, exists: boolean): Chainable<Element>;
      checkForAlertRecursively(attemptsLeft?: number): Chainable<Element>;
    }
  }
}

// Custom waitUntil with timeout message
Cypress.Commands.add(
  'waitUntilWithCustomTimeout',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fn: () => any, options: { interval: number; timeout: number; timeoutMessage: string }) => {
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
  },
);

Cypress.Commands.add('clickNavLink', (path: string[]) => {
  cy.get('#page-sidebar')
    .contains(path[0])
    .then(($navItem) => {
      if ($navItem.attr('aria-expanded') !== 'true') {
        cy.wrap($navItem).click({ force: true });
      }
    });
  if (path.length === 2) {
    cy.get('#page-sidebar').contains(path[1]).click({ force: true });
  }
});

Cypress.Commands.add('changeNamespace', (namespace: string) => {
  cy.log('Changing Namespace to: ' + namespace);
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
      cy.waitUntil(
        () => {
          cy.get(Classes.NamespaceDropdown)
            .scrollIntoView()
            .should('be.visible')
            .click({ force: true });
          return cy
            .get('body')
            .then(
              ($b) =>
                $b.find('[data-test="' + DataTestIDs.NamespaceDropdownTextFilter + '"]').length > 0,
            );
        },
        { timeout: 10000, interval: 1000 },
      );
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
  cy.byTestID(DataTestIDs.NamespaceDropdownTextFilter).clear().type(namespace, { delay: 100 });
  cy.byTestID(DataTestIDs.NamespaceDropdownMenuLink).contains(namespace).should('be.visible');
  cy.byTestID(DataTestIDs.NamespaceDropdownMenuLink)
    .contains(namespace)
    .should('be.visible')
    .click({ force: true });
  cy.get('body').then(($body) => {
    cy.log('Checking namespace: ' + namespace);
    const hasNamespaceBarDropdown =
      $body.find('[data-test-id="' + LegacyTestIDs.NamespaceBarDropdown + '"]').length > 0;
    if (hasNamespaceBarDropdown) {
      cy.byLegacyTestID(LegacyTestIDs.NamespaceBarDropdown).should('contain.text', namespace);
    } else {
      cy.get(Classes.NamespaceDropdown).should('contain.text', namespace);
    }
  });
  cy.log('Namespace changed to: ' + namespace);
});

Cypress.Commands.add('aboutModal', () => {
  cy.log('Getting OCP version');
  if (Cypress.env('LOGIN_USERNAME') === 'kubeadmin') {
    cy.byTestID(DataTestIDs.MastHeadHelpIcon).should('be.visible');
    cy.byTestID(DataTestIDs.MastHeadHelpIcon).should('be.visible').click({ force: true });
    cy.wait(3000);
    cy.byTestID(DataTestIDs.MastHeadApplicationItem).contains('About').should('be.visible').click();
    cy.byAriaLabel('About modal')
      .find('div[class*="co-select-to-copy"]')
      .eq(0)
      .should('be.visible')
      .then(($ocpversion) => {
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
  cy.switchPerspective('Core platform', 'Administrator');
  cy.clickNavLink(['Workloads', 'Pods']);
  cy.byTestID('page-heading').contains('Pods').should('be.visible');
  cy.changeNamespace(namespace);
  // Wait for the pod table to load after namespace change so the page stabilizes
  cy.get('table tbody tr, [data-ouia-component-id="DataViewTable"] tbody tr', {
    timeout: 30000,
  }).should('have.length.greaterThan', 0);
  // Re-check for DataViewFilters after the table has stabilized
  cy.get('body').then(($body) => {
    const hasDataViewFilters = $body.find('[data-ouia-component-id="DataViewFilters"]').length > 0;
    let filterSelector: string;
    if (hasDataViewFilters) {
      const hasFilterByName = $body.find('[placeholder="Filter by name"]').length > 0;
      filterSelector = '[placeholder="Filter by name"]';
      if (!hasFilterByName) {
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
      }
    } else {
      filterSelector = '[data-test="name-filter-input"]';
    }
    // Separate the visibility assertion from the type action so Cypress
    // re-queries the element for each command independently.
    cy.get(filterSelector).scrollIntoView().should('be.visible');
    cy.get(filterSelector).type(pod);
  });
  cy.get(`a[data-test^="${pod}"]`).eq(0).as('podLink').click();
  cy.byPFRole('rowgroup')
    .find('td')
    .eq(1)
    .scrollIntoView()
    .should('be.visible')
    .then(($td) => {
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
      cy.waitUntil(
        () => {
          cy.get(Classes.NamespaceDropdown)
            .scrollIntoView()
            .should('be.visible')
            .click({ force: true });
          return cy
            .get('body')
            .then(
              ($b) =>
                $b.find('[data-test="' + DataTestIDs.NamespaceDropdownTextFilter + '"]').length > 0,
            );
        },
        { timeout: 10000, interval: 1000 },
      );
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
  cy.byTestID(DataTestIDs.NamespaceDropdownTextFilter).clear();
  cy.byTestID(DataTestIDs.NamespaceDropdownTextFilter).clear().type(namespace, { delay: 100 });
  if (exists) {
    cy.log('Namespace: ' + namespace + ' exists');
    cy.byTestID(DataTestIDs.NamespaceDropdownMenuLink).contains(namespace).should('be.visible');
  } else {
    cy.log('Namespace: ' + namespace + ' does not exist');
    cy.byTestID(DataTestIDs.NamespaceDropdownMenuLink).should('not.exist');
  }

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
      cy.get(Classes.NamespaceDropdownExpanded).scrollIntoView().should('be.visible');
      cy.get(Classes.NamespaceDropdownExpanded)
        .scrollIntoView()
        .should('be.visible')
        .click({ force: true });
    }
  });
});

Cypress.Commands.add('checkForAlertRecursively', (attemptsLeft = 24) => {
  cy.get('body', { timeout: 10000 }).then(($body) => {
    if (
      $body.find('.pf-v5-c-alert, .pf-v6-c-alert').length > 0 &&
      $body.text().includes('Web console update is available')
    ) {
      cy.log('Web console update alert found');
      cy.get('.pf-v5-c-alert, .pf-v6-c-alert')
        .contains('Web console update is available')
        .should('exist');
    } else if (attemptsLeft > 0) {
      cy.log(
        `Alert not found, checking again in 5 seconds... (${attemptsLeft} attempts remaining)`,
      );
      cy.wait(5000);
      cy.checkForAlertRecursively(attemptsLeft - 1);
    } else {
      cy.log('No web console update alert found after 2 minutes, continuing...');
    }
  });
});
