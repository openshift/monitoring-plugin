import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;

export {};

declare global {
  namespace Cypress {
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
      bySemanticElement(element: string, text?: string): Chainable<JQuery<HTMLElement>>;
      byAriaLabel(label: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>>;
      byPFRole(role: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>>;
    }
  }
}


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

  Cypress.Commands.add('bySemanticElement', (element: string, text?: string) => {
    if (text) {
      return cy.get(element).contains(text);
    }
    return cy.get(element);
  });

  Cypress.Commands.add(
    'byAriaLabel',
    (label: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
      return cy.get(`[aria-label="${label}"]`, options);
    }
  );

  Cypress.Commands.add(
    'byPFRole',
    (role: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
      return cy.get(`[role="${role}"]`, options);
    }
  );
