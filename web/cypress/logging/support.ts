import { TestIds } from '@/features/logging/utils/test-ids';
import '../support/selectors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      setLogQueryInput(query: string): Chainable<void>;
    }
  }
}

// Harness coverage deliberately fails on application exceptions.
Cypress.on('uncaught:exception', (error) => {
  if (error.message.includes('ResizeObserver loop')) return false;
});
Cypress.Commands.add('setLogQueryInput', (query: string) => {
  cy.byTestID(TestIds.LogsQueryInput)
    .find('textarea')
    .then(($textarea) => {
      const textarea = $textarea[0] as HTMLTextAreaElement;
      const win = textarea.ownerDocument.defaultView ?? window;
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        win.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      nativeValueSetter?.call(textarea, query);
      textarea.dispatchEvent(new win.Event('input', { bubbles: true }));
    });
  cy.byTestID(TestIds.LogsQueryInput).find('textarea').should('have.value', query);
  cy.location('search').should((search) => {
    expect(new URLSearchParams(search).get('q')).to.eq(query.trim());
  });
  cy.byTestID(TestIds.LogsQueryInput).should('have.attr', 'data-test-query', query.trim());
});
