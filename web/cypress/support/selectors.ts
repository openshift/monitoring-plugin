/* eslint-disable @typescript-eslint/no-use-before-define */
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;

export {};
declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      byTestID(
        selector: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<Element>;
      byOUIAID(selector: string): Chainable<Element>;
      byClass(selector: string): Chainable<Element>;
      byLegacyTestID(
        selector: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      byDataID(selector: string): Chainable<JQuery<HTMLElement>>;
      bySemanticElement(element: string, text?: string): Chainable<JQuery<HTMLElement>>;
      byAriaLabel(label: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>>;
      byPFRole(role: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>>;
      byDataTestID(
        selector: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<Element>;
    }
  }
}

// any command added below, must be added to global Cypress interface above
Cypress.Commands.add('byOUIAID', (selector: string) => cy.get(`[data-ouia-component-id^="${selector}"]`));

Cypress.Commands.add('byClass', (selector: string) => cy.get(`[class="${selector}"]`));

Cypress.Commands.add(
  'byTestID',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test="${selector}"]`, options);
  },
);

//MaterialUI data-testid selectors
Cypress.Commands.add('byDataTestID', (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
  cy.get(`[data-testid="${selector}"]`, options);
});

// deprecated!  new IDs should use 'data-test', ie. `cy.byTestID(...)`
Cypress.Commands.add('byLegacyTestID', (selector: string) =>
  cy.get(`[data-test-id="${selector}"]`),
);

Cypress.Commands.add('byDataID', (selector: string) => cy.get(`[data-id="${selector}"]`));

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