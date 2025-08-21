import './nav';
import './selectors';
import './commands';
import './alert-injection';
import './prometheus-query-mocks';

export const checkErrors = () =>
  cy.window().then((win) => {
    assert.isTrue(!win.windowError, win.windowError);
  });


  // Ignore benign ResizeObserver errors globally so they don't fail tests
// See: https://docs.cypress.io/api/cypress-api/catalog-of-events#Uncaught-Exceptions
Cypress.on('uncaught:exception', (err) => {
  const message = err?.message || String(err || '');
  if (
    message.includes('ResizeObserver loop limit exceeded') ||
    message.includes('ResizeObserver loop completed with undelivered notifications') ||
    message.includes('ResizeObserver')
  ) {
    return false;
  }
  // allow other errors to fail the test
});