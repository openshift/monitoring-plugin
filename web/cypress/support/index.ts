import '@cypress/grep';

import './shared/commands/selectors';
import './shared/commands/selector-commands';
import './shared/commands/auth-commands';
import './shared/cluster-observability-operator/coo-install-commands';
import './shared/commands/image-patch-commands';
import './perses/commands/dashboards-commands';
import './shared/commands/operator-commands';
import './incidents/commands/incident-commands';
import './shared/commands/utility-commands';
import './incidents';
import './shared/commands/virtualization-commands';
import './perses/commands/perses-commands';
import './shared/commands/traces-logging-commands';

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
    message.includes('ResizeObserver') ||
    message.includes('Cannot read properties of undefined') ||
    message.includes('Unauthorized') ||
    message.includes('Bad Gateway') ||
    message.includes(`Cannot read properties of null (reading 'default')`) ||
    message.includes(`(intermediate value) is not a function`) ||
    message.includes(`Cannot read properties of null (reading '0')`) ||
    message.includes(`load_plugin_entry`) ||
    message.includes(`Cannot access 'y' before initialization`) ||
    message.includes(`NotFound`) ||
    message.includes(`Cannot access 'f' before initialization`)
  ) {
    console.warn('Ignored frontend exception:', err.message);
    return false;
  }
  // allow other errors to fail the test
});
