import './nav';
import './selectors';
import './commands';

export const checkErrors = () =>
  cy.window().then((win) => {
    assert.isTrue(!win.windowError, win.windowError);
  });

  Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from failing the test
    // on a JavaScript exception
    if (err.message.includes('ResizeObserver loop completed with undelivered notifications')) {
      return false
    }
  });