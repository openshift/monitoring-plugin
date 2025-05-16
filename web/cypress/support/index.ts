import './nav';
import './selectors';
// import './login';
import './commands';

export const checkErrors = () =>
  cy.window().then((win) => {
    assert.isTrue(!win.windowError, win.windowError);
  });
